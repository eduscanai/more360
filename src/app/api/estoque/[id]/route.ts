import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  product_desc: z.string().trim().min(1).optional(),
  sku: z.string().trim().optional().nullable(),
  imei: z.string().trim().optional().nullable(),
  condition: z.enum(["novo", "seminovo", "usado"]).optional(),
  status: z.enum(["em_estoque", "reservado", "vendido", "defeito"]).optional(),
  cost_price: z.coerce.number().min(0).optional(),
  location: z.string().trim().optional().nullable(),
  entry_date: z.string().trim().optional().nullable(),
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
    `update stock_items set
       product_desc = coalesce($1, product_desc),
       sku = coalesce($2, sku),
       imei = coalesce($3, imei),
       condition = coalesce($4, condition),
       status = coalesce($5, status),
       cost_price = coalesce($6, cost_price),
       location = coalesce($7, location),
       entry_date = coalesce($8, entry_date),
       notes = coalesce($9, notes)
     where id = $10
     returning id, product_desc, sku, imei, condition, status, cost_price, location, entry_date, notes, created_at, updated_at`,
    [d.product_desc, d.sku, d.imei, d.condition, d.status, d.cost_price, d.location, d.entry_date, d.notes, id]
  );
  if (!row) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from stock_items where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
