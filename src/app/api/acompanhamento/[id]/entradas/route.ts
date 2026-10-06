import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  entry_date: z.string().trim().optional().nullable(),
  progress_percent: z.coerce.number().min(0).max(100),
  note: z.string().trim().optional().nullable(),
});

// Histórico só cresce (sem PATCH/DELETE de entrada individual) — cada
// registro é um "checkpoint" do dia, igual ao diário original do blueprint.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const { id } = await params;
  const rows = await query(
    `select id, project_id, entry_date, progress_percent, note, created_at
     from tracking_entries
     where project_id = $1
     order by entry_date desc, created_at desc`,
    [id]
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const { id } = await params;

  const project = await query<{ id: string }>("select id from tracking_projects where id = $1", [id]);
  if (project.length === 0) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const [row] = await query(
    `insert into tracking_entries (project_id, entry_date, progress_percent, note, created_by)
     values ($1, coalesce($2, current_date), $3, $4, $5)
     returning id, project_id, entry_date, progress_percent, note, created_at`,
    [id, d.entry_date || null, d.progress_percent, d.note || null, session.sub]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
