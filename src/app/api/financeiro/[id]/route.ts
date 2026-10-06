import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  type: z.enum(["receita", "despesa"]).optional(),
  category: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  amount: z.coerce.number().min(0).optional(),
  status: z.enum(["pendente", "pago"]).optional(),
  due_date: z.string().trim().optional().nullable(),
  paid_date: z.string().trim().optional().nullable(),
  payment_method: z.string().trim().optional().nullable(),
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
    `update financial_transactions set
       type = coalesce($1, type),
       category = coalesce($2, category),
       description = coalesce($3, description),
       amount = coalesce($4, amount),
       status = coalesce($5, status),
       due_date = coalesce($6, due_date),
       paid_date = coalesce($7, paid_date),
       payment_method = coalesce($8, payment_method)
     where id = $9
     returning id, type, category, description, amount, status, due_date, paid_date, payment_method, created_at, updated_at`,
    [
      d.type,
      d.category,
      d.description,
      d.amount,
      d.status,
      d.due_date,
      d.paid_date,
      d.payment_method,
      id,
    ]
  );
  if (!row) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from financial_transactions where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
