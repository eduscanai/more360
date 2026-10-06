import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(1),
  sector: z.enum(["mkt", "gestao", "operacao", "rh"]).optional(),
  status: z.enum(["no_prazo", "em_risco", "atrasado"]).optional(),
  owner_name: z.string().trim().optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  target_date: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  // Traz a última entrada (progresso mais recente) junto via LATERAL join —
  // evita uma 2ª requisição por projeto só pra saber o progresso atual.
  const rows = await query(
    `select p.id, p.name, p.sector, p.status, p.owner_name, p.start_date, p.target_date, p.notes,
            p.created_at, p.updated_at,
            le.progress_percent as latest_progress, le.entry_date as latest_entry_date
     from tracking_projects p
     left join lateral (
       select progress_percent, entry_date
       from tracking_entries e
       where e.project_id = p.id
       order by e.entry_date desc, e.created_at desc
       limit 1
     ) le on true
     order by p.name`
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

  const [row] = await query<Record<string, unknown>>(
    `insert into tracking_projects (name, sector, status, owner_name, start_date, target_date, notes, created_by)
     values ($1, coalesce($2, 'operacao'), coalesce($3, 'no_prazo'), $4, coalesce($5, current_date), $6, $7, $8)
     returning id, name, sector, status, owner_name, start_date, target_date, notes, created_at, updated_at`,
    [d.name, d.sector, d.status, d.owner_name || null, d.start_date || null, d.target_date || null, d.notes || null, session.sub]
  );
  return NextResponse.json({ item: { ...row, latest_progress: null, latest_entry_date: null } }, { status: 201 });
}
