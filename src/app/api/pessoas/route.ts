import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  document: z.string().trim().optional().nullable(),
  type: z.enum(["cliente", "fornecedor", "tecnico", "outro"]).optional(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const rows = await query(
    `select id, name, phone, email, document, type, address, notes, active, created_at, updated_at
     from contacts
     order by name`
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
    `insert into contacts (name, phone, email, document, type, address, notes, active, created_by)
     values ($1, $2, $3, $4, coalesce($5, 'cliente'), $6, $7, coalesce($8, true), $9)
     returning id, name, phone, email, document, type, address, notes, active, created_at, updated_at`,
    [d.name, d.phone || null, d.email || null, d.document || null, d.type, d.address || null, d.notes || null, d.active, session.sub]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
