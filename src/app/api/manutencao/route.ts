import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().optional().nullable(),
  device_desc: z.string().trim().min(1),
  imei: z.string().trim().optional().nullable(),
  problem_desc: z.string().trim().min(1),
  status: z.enum(["aguardando", "em_andamento", "concluido", "entregue", "cancelado"]).optional(),
  labor_cost: z.coerce.number().min(0).optional(),
  parts_cost: z.coerce.number().min(0).optional(),
  finished_at: z.string().trim().optional().nullable(),
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
    `select id, customer_name, customer_phone, device_desc, imei, problem_desc, status,
            labor_cost, parts_cost, total_cost, finished_at, notes, created_at, updated_at
     from maintenance_orders
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
  const laborCost = d.labor_cost ?? 0;
  const partsCost = d.parts_cost ?? 0;
  const totalCost = Number((laborCost + partsCost).toFixed(2));

  const [row] = await query(
    `insert into maintenance_orders
       (customer_name, customer_phone, device_desc, imei, problem_desc, status, labor_cost, parts_cost, total_cost, finished_at, notes, created_by)
     values ($1, $2, $3, $4, $5, coalesce($6, 'aguardando'), $7, $8, $9, $10, $11, $12)
     returning id, customer_name, customer_phone, device_desc, imei, problem_desc, status, labor_cost, parts_cost, total_cost, finished_at, notes, created_at, updated_at`,
    [
      d.customer_name,
      d.customer_phone || null,
      d.device_desc,
      d.imei || null,
      d.problem_desc,
      d.status,
      laborCost,
      partsCost,
      totalCost,
      d.finished_at || null,
      d.notes || null,
      session.sub,
    ]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
