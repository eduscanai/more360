import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  sku: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  cost_price: z.coerce.number().min(0),
  margin_percent: z.coerce.number().min(0),
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
    `select id, sku, name, category, cost_price, margin_percent, sale_price, active, notes, created_at, updated_at
     from products
     order by category nulls last, name`
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
  const { sku, name, category, cost_price, margin_percent, notes, active } = parsed.data;
  const salePrice = Number((cost_price * (1 + margin_percent / 100)).toFixed(2));

  const [row] = await query(
    `insert into products (sku, name, category, cost_price, margin_percent, sale_price, notes, active, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, true), $9)
     returning id, sku, name, category, cost_price, margin_percent, sale_price, active, notes, created_at, updated_at`,
    [sku || null, name, category || null, cost_price, margin_percent, salePrice, notes || null, active, session.sub]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
