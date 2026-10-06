import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  document: z.string().trim().optional().nullable(),
  type: z.enum(["cliente", "fornecedor", "tecnico", "outro"]).optional(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
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
    `update contacts set
       name = coalesce($1, name),
       phone = coalesce($2, phone),
       email = coalesce($3, email),
       document = coalesce($4, document),
       type = coalesce($5, type),
       address = coalesce($6, address),
       notes = coalesce($7, notes),
       active = coalesce($8, active)
     where id = $9
     returning id, name, phone, email, document, type, address, notes, active, created_at, updated_at`,
    [d.name, d.phone, d.email, d.document, d.type, d.address, d.notes, d.active, id]
  );
  if (!row) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from contacts where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
