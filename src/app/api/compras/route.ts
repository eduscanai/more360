import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  supplier_name: z.string().trim().min(1),
  supplier_phone: z.string().trim().optional().nullable(),
  product_desc: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unit_cost: z.coerce.number().min(0),
  status: z.enum(["pedido", "enviado", "recebido", "cancelado"]).optional(),
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
    `select id, supplier_name, supplier_phone, product_desc, quantity, unit_cost, status, expected_date, notes, created_at, updated_at
     from purchase_orders
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
    `insert into purchase_orders (supplier_name, supplier_phone, product_desc, quantity, unit_cost, status, expected_date, notes, created_by)
     values ($1, $2, $3, $4, $5, coalesce($6, 'pedido'), $7, $8, $9)
     returning id, supplier_name, supplier_phone, product_desc, quantity, unit_cost, status, expected_date, notes, created_at, updated_at`,
    [
      d.supplier_name,
      d.supplier_phone || null,
      d.product_desc,
      d.quantity,
      d.unit_cost,
      d.status,
      d.expected_date || null,
      d.notes || null,
      session.sub,
    ]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
