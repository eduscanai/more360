import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  customer_name: z.string().trim().min(1).optional(),
  customer_phone: z.string().trim().optional().nullable(),
  product_desc: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  deposit_paid: z.coerce.number().min(0).optional(),
  status: z.enum(["aguardando", "pago", "chegou", "entregue", "cancelado"]).optional(),
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

  // O Financeiro não guarda uma cópia disto — ele lê `orders` direto
  // (status = 'entregue' conta como receita). Ver GET /api/financeiro.
  const [row] = await query(
    `update orders set
       customer_name = coalesce($1, customer_name),
       customer_phone = coalesce($2, customer_phone),
       product_desc = coalesce($3, product_desc),
       quantity = coalesce($4, quantity),
       unit_price = coalesce($5, unit_price),
       deposit_paid = coalesce($6, deposit_paid),
       status = coalesce($7, status),
       expected_date = coalesce($8, expected_date),
       notes = coalesce($9, notes)
     where id = $10
     returning id, customer_name, customer_phone, product_desc, quantity, unit_price, deposit_paid, status, expected_date, notes, created_at, updated_at`,
    [
      d.customer_name,
      d.customer_phone,
      d.product_desc,
      d.quantity,
      d.unit_price,
      d.deposit_paid,
      d.status,
      d.expected_date,
      d.notes,
      id,
    ]
  );
  if (!row) return NextResponse.json({ error: "Encomenda não encontrada." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from orders where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
