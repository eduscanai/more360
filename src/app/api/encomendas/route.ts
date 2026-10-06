import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().optional().nullable(),
  product_desc: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
  deposit_paid: z.coerce.number().min(0).optional(),
  status: z.enum(["aguardando", "pago", "chegou", "entregue", "cancelado"]).optional(),
  expected_date: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const rows = await query(
    `select id, customer_name, customer_phone, product_desc, quantity, unit_price, deposit_paid,
            status, expected_date, notes, created_at, updated_at
     from orders
     order by created_at desc`
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
    `insert into orders (customer_name, customer_phone, product_desc, quantity, unit_price, deposit_paid, status, expected_date, notes, created_by)
     values ($1, $2, $3, $4, $5, coalesce($6, 0), coalesce($7, 'aguardando'), $8, $9, $10)
     returning id, customer_name, customer_phone, product_desc, quantity, unit_price, deposit_paid, status, expected_date, notes, created_at, updated_at`,
    [
      d.customer_name,
      d.customer_phone || null,
      d.product_desc,
      d.quantity,
      d.unit_price,
      d.deposit_paid,
      d.status,
      d.expected_date || null,
      d.notes || null,
      session.sub,
    ]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
