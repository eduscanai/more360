import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";
import type { SessionPayload } from "@/lib/session";

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  status: z.enum(["a_fazer", "em_andamento", "concluida"]).optional(),
  priority: z.enum(["baixa", "media", "alta"]).optional(),
  due_date: z.string().trim().optional().nullable(),
  assignee_name: z.string().trim().optional().nullable(),
  is_personal: z.boolean().optional(),
});

async function guard(): Promise<SessionPayload | null> {
  try {
    return await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

/** Tarefa pessoal só pode ser vista/editada por quem criou — mesma regra do GET. */
async function assertVisible(id: string, session: SessionPayload) {
  const rows = await query<{ is_personal: boolean; created_by: string | null }>(
    "select is_personal, created_by from tasks where id = $1",
    [id]
  );
  const task = rows[0];
  if (!task) return { ok: false as const, status: 404 as const, error: "Tarefa não encontrada." };
  if (task.is_personal && task.created_by !== session.sub) {
    return { ok: false as const, status: 404 as const, error: "Tarefa não encontrada." };
  }
  return { ok: true as const };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const visible = await assertVisible(id, session);
  if (!visible.ok) return NextResponse.json({ error: visible.error }, { status: visible.status });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await query(
    `update tasks set
       title = coalesce($1, title),
       description = coalesce($2, description),
       status = coalesce($3, status),
       priority = coalesce($4, priority),
       due_date = coalesce($5, due_date),
       assignee_name = coalesce($6, assignee_name),
       is_personal = coalesce($7, is_personal)
     where id = $8
     returning id, title, description, status, priority, due_date, assignee_name, is_personal, created_by, created_at, updated_at`,
    [d.title, d.description, d.status, d.priority, d.due_date, d.assignee_name, d.is_personal, id]
  );
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const visible = await assertVisible(id, session);
  if (!visible.ok) return NextResponse.json({ error: visible.error }, { status: visible.status });

  await query("delete from tasks where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
