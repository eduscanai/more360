import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  customer_name: z.string().trim().min(1).optional(),
  customer_phone: z.string().trim().optional().nullable(),
  device_desc: z.string().trim().min(1).optional(),
  imei: z.string().trim().optional().nullable(),
  problem_desc: z.string().trim().min(1).optional(),
  status: z.enum(["aguardando", "em_andamento", "concluido", "entregue", "cancelado"]).optional(),
  labor_cost: z.coerce.number().min(0).optional(),
  parts_cost: z.coerce.number().min(0).optional(),
  finished_at: z.string().trim().optional().nullable(),
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

  const result = await withTransaction(async (tx) => {
    const current = await tx<{
      labor_cost: string;
      parts_cost: string;
      status: string;
      imei: string | null;
    }>(
      "select labor_cost, parts_cost, status, imei from maintenance_orders where id = $1 for update",
      [id]
    );
    if (current.length === 0) return null;
    const before = current[0];

    const laborCost = d.labor_cost ?? Number(before.labor_cost);
    const partsCost = d.parts_cost ?? Number(before.parts_cost);
    const totalCost = Number((laborCost + partsCost).toFixed(2));

    // "Concluído"/"Entregue" sem data informada assume hoje — mas só quando o
    // status está de fato MUDANDO pra um desses (senão reeditar uma OS já
    // concluída, sem mexer no status, ficaria empurrando finished_at pra hoje
    // a cada salvamento).
    const statusChangingToFinished =
      d.status !== undefined &&
      d.status !== before.status &&
      (d.status === "concluido" || d.status === "entregue");
    const autoFinishedAt =
      d.finished_at === undefined && statusChangingToFinished
        ? new Date().toISOString().slice(0, 10)
        : d.finished_at;

    const [row] = await tx<Record<string, unknown>>(
      `update maintenance_orders set
         customer_name = coalesce($1, customer_name),
         customer_phone = coalesce($2, customer_phone),
         device_desc = coalesce($3, device_desc),
         imei = coalesce($4, imei),
         problem_desc = coalesce($5, problem_desc),
         status = coalesce($6, status),
         labor_cost = $7,
         parts_cost = $8,
         total_cost = $9,
         finished_at = coalesce($10, finished_at),
         notes = coalesce($11, notes)
       where id = $12
       returning id, customer_name, customer_phone, device_desc, imei, problem_desc, status, labor_cost, parts_cost, total_cost, finished_at, notes, created_at, updated_at`,
      [
        d.customer_name,
        d.customer_phone,
        d.device_desc,
        d.imei,
        d.problem_desc,
        d.status,
        laborCost,
        partsCost,
        totalCost,
        autoFinishedAt,
        d.notes,
        id,
      ]
    );

    // CONEXÃO COM ESTOQUE: entrou em andamento → se tiver uma unidade com o
    // mesmo IMEI disponível no estoque, marca ela como "em manutenção"
    // automaticamente. Quando a OS termina, ela volta pra "em estoque". Se
    // não existir unidade com esse IMEI (caso mais comum — aparelho é do
    // cliente, não do estoque da loja), o UPDATE só não afeta nenhuma linha.
    // (O Financeiro não guarda cópia da OS — ele lê maintenance_orders
    // direto, status = 'entregue' conta como receita. Ver GET /api/financeiro.)
    const effectiveImei = d.imei ?? before.imei;
    if (effectiveImei) {
      const enteringProgress = d.status === "em_andamento" && before.status !== "em_andamento";
      if (enteringProgress) {
        await tx(
          "update stock_items set status = 'em_manutencao' where imei = $1 and status = 'em_estoque'",
          [effectiveImei]
        );
      }
      if (statusChangingToFinished) {
        await tx(
          "update stock_items set status = 'em_estoque' where imei = $1 and status = 'em_manutencao'",
          [effectiveImei]
        );
      }
    }

    return row;
  });

  if (!result) return NextResponse.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
  return NextResponse.json({ item: result });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await query("delete from maintenance_orders where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
