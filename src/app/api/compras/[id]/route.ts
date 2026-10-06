import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  supplier_name: z.string().trim().min(1).optional(),
  supplier_phone: z.string().trim().optional().nullable(),
  product_desc: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  unit_cost: z.coerce.number().min(0).optional(),
  status: z.enum(["pedido", "enviado", "recebido", "cancelado"]).optional(),
  expected_date: z.string().trim().optional().nullable(),
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

  // O Financeiro não guarda uma cópia disto — ele lê `purchase_orders` direto
  // (status = 'recebido' conta como despesa/custo). Ver GET /api/financeiro.
  const [row] = await query(
    `update purchase_orders set
       supplier_name = coalesce($1, supplier_name),
       supplier_phone = coalesce($2, supplier_phone),
       product_desc = coalesce($3, product_desc),
       quantity = coalesce($4, quantity),
       unit_cost = coalesce($5, unit_cost),
       status = coalesce($6, status),
       expected_date = coalesce($7, expected_date),
       notes = coalesce($8, notes)
     where id = $9
     returning id, supplier_name, supplier_phone, product_desc, quantity, unit_cost, status, expected_date, notes, created_at, updated_at`,
    [d.supplier_name, d.supplier_phone, d.product_desc, d.quantity, d.unit_cost, d.status, d.expected_date, d.notes, id]
  );
  if (!row) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from purchase_orders where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
