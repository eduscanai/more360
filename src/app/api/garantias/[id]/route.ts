import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  customer_name: z.string().trim().min(1).optional(),
  customer_phone: z.string().trim().optional().nullable(),
  product_desc: z.string().trim().min(1).optional(),
  imei: z.string().trim().optional().nullable(),
  policy_type: z.enum(["fabricante", "loja", "seguro"]).optional(),
  starts_at: z.string().trim().optional().nullable(),
  expires_at: z.string().trim().min(1).optional(),
  status: z.enum(["ativa", "acionada", "resolvida"]).optional(),
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
    `update warranties set
       customer_name = coalesce($1, customer_name),
       customer_phone = coalesce($2, customer_phone),
       product_desc = coalesce($3, product_desc),
       imei = coalesce($4, imei),
       policy_type = coalesce($5, policy_type),
       starts_at = coalesce($6, starts_at),
       expires_at = coalesce($7, expires_at),
       status = coalesce($8, status),
       notes = coalesce($9, notes)
     where id = $10
     returning id, customer_name, customer_phone, product_desc, imei, policy_type, starts_at, expires_at, status, notes, created_at, updated_at`,
    [d.customer_name, d.customer_phone, d.product_desc, d.imei, d.policy_type, d.starts_at, d.expires_at, d.status, d.notes, id]
  );
  if (!row) return NextResponse.json({ error: "Garantia não encontrada." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from warranties where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
