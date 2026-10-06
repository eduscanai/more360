import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  product_desc: z.string().trim().min(1),
  sku: z.string().trim().optional().nullable(),
  imei: z.string().trim().optional().nullable(),
  condition: z.enum(["novo", "seminovo", "usado"]).optional(),
  status: z.enum(["em_estoque", "reservado", "vendido", "defeito"]).optional(),
  cost_price: z.coerce.number().min(0).optional(),
  location: z.string().trim().optional().nullable(),
  entry_date: z.string().trim().optional().nullable(),
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
    `select id, product_desc, sku, imei, condition, status, cost_price, location, entry_date, notes, created_at, updated_at
     from stock_items
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
    `insert into stock_items (product_desc, sku, imei, condition, status, cost_price, location, entry_date, notes, created_by)
     values ($1, $2, $3, coalesce($4, 'novo'), coalesce($5, 'em_estoque'), coalesce($6, 0), $7, coalesce($8, current_date), $9, $10)
     returning id, product_desc, sku, imei, condition, status, cost_price, location, entry_date, notes, created_at, updated_at`,
    [
      d.product_desc,
      d.sku || null,
      d.imei || null,
      d.condition,
      d.status,
      d.cost_price,
      d.location || null,
      d.entry_date || null,
      d.notes || null,
      session.sub,
    ]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
