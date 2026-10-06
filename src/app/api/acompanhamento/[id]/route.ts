import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sector: z.enum(["mkt", "gestao", "operacao", "rh"]).optional(),
  status: z.enum(["no_prazo", "em_risco", "atrasado"]).optional(),
  owner_name: z.string().trim().optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  target_date: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

async function guard() {
  try {
    return await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await query(
    `update tracking_projects set
       name = coalesce($1, name),
       sector = coalesce($2, sector),
       status = coalesce($3, status),
       owner_name = coalesce($4, owner_name),
       start_date = coalesce($5, start_date),
       target_date = coalesce($6, target_date),
       notes = coalesce($7, notes)
     where id = $8
     returning id, name, sector, status, owner_name, start_date, target_date, notes, created_at, updated_at`,
    [d.name, d.sector, d.status, d.owner_name, d.start_date, d.target_date, d.notes, id]
  );
  if (!row) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from tracking_projects where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
