import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().optional().nullable(),
  product_desc: z.string().trim().min(1),
  imei: z.string().trim().optional().nullable(),
  policy_type: z.enum(["fabricante", "loja", "seguro"]).optional(),
  starts_at: z.string().trim().optional().nullable(),
  expires_at: z.string().trim().min(1),
  status: z.enum(["ativa", "acionada", "resolvida"]).optional(),
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
    `select id, customer_name, customer_phone, product_desc, imei, policy_type, starts_at, expires_at, status, notes, created_at, updated_at
     from warranties
     order by expires_at`
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
    `insert into warranties (customer_name, customer_phone, product_desc, imei, policy_type, starts_at, expires_at, status, notes, created_by)
     values ($1, $2, $3, $4, coalesce($5, 'loja'), coalesce($6, current_date), $7, coalesce($8, 'ativa'), $9, $10)
     returning id, customer_name, customer_phone, product_desc, imei, policy_type, starts_at, expires_at, status, notes, created_at, updated_at`,
    [
      d.customer_name,
      d.customer_phone || null,
      d.product_desc,
      d.imei || null,
      d.policy_type,
      d.starts_at || null,
      d.expires_at,
      d.status,
      d.notes || null,
      session.sub,
    ]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
