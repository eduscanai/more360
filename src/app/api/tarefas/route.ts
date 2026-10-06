import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  status: z.enum(["a_fazer", "em_andamento", "concluida"]).optional(),
  priority: z.enum(["baixa", "media", "alta"]).optional(),
  due_date: z.string().trim().optional().nullable(),
  assignee_name: z.string().trim().optional().nullable(),
  is_personal: z.boolean().optional(),
});

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Tarefa pessoal (is_personal=true) só aparece pra quem criou — é uma nota
  // privada, não uma tarefa de equipe. Qualquer role vê as não-pessoais.
  const rows = await query(
    `select id, title, description, status, priority, due_date, assignee_name, is_personal, created_by, created_at, updated_at
     from tasks
     where is_personal = false or created_by = $1
     order by
       case status when 'a_fazer' then 0 when 'em_andamento' then 1 else 2 end,
       due_date nulls last,
       created_at desc`,
    [session.sub]
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await query(
    `insert into tasks (title, description, status, priority, due_date, assignee_name, is_personal, created_by)
     values ($1, $2, coalesce($3, 'a_fazer'), coalesce($4, 'media'), $5, $6, coalesce($7, false), $8)
     returning id, title, description, status, priority, due_date, assignee_name, is_personal, created_by, created_at, updated_at`,
    [
      d.title,
      d.description || null,
      d.status,
      d.priority,
      d.due_date || null,
      d.assignee_name || null,
      d.is_personal,
      session.sub,
    ]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
