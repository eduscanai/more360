import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  sku: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().optional().nullable(),
  cost_price: z.coerce.number().min(0).optional(),
  margin_percent: z.coerce.number().min(0).optional(),
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

  const current = await query<{ cost_price: string; margin_percent: string }>(
    "select cost_price, margin_percent from products where id = $1",
    [id]
  );
  if (current.length === 0) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const data = parsed.data;
  const costPrice = data.cost_price ?? Number(current[0].cost_price);
  const marginPercent = data.margin_percent ?? Number(current[0].margin_percent);
  const salePrice = Number((costPrice * (1 + marginPercent / 100)).toFixed(2));

  const [row] = await query(
    `update products set
       sku = coalesce($1, sku),
       name = coalesce($2, name),
       category = coalesce($3, category),
       cost_price = $4,
       margin_percent = $5,
       sale_price = $6,
       notes = coalesce($7, notes),
       active = coalesce($8, active)
     where id = $9
     returning id, sku, name, category, cost_price, margin_percent, sale_price, active, notes, created_at, updated_at`,
    [
      data.sku,
      data.name,
      data.category,
      costPrice,
      marginPercent,
      salePrice,
      data.notes,
      data.active,
      id,
    ]
  );
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from products where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
