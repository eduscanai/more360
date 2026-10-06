import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

const createSchema = z.object({
  type: z.enum(["receita", "despesa"]),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amount: z.coerce.number().min(0),
  status: z.enum(["pendente", "pago"]).optional(),
  due_date: z.string().trim().optional().nullable(),
  paid_date: z.string().trim().optional().nullable(),
  payment_method: z.string().trim().optional().nullable(),
});

/**
 * O Financeiro não é uma tabela própria de lançamentos — é um DASHBOARD que
 * COMPILA dados que já existem nos outros módulos (mesma ideia do More 360
 * original: a DRE/Fluxo/A-Receber/A-Pagar de lá leem sale_transactions,
 * performance_service_orders, financial_transactions via RPC, não uma cópia
 * manual). Aqui:
 *   - Receita  = Encomendas entregues + Manutenção entregue + lançamentos manuais pagos
 *   - Despesa  = Compras recebidas + lançamentos manuais pagos
 *   - A Receber = Encomendas ainda não entregues (saldo = valor − sinal)
 *   - A Pagar   = Compras ainda não recebidas
 * `financial_transactions` (os "lançamentos manuais") existe só para o que
 * NÃO nasce de nenhum módulo — aluguel, salários, outras receitas — igual
 * ao papel que a tabela homônima tem no original pra lançamentos que não
 * vêm de uma venda.
 */
export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const [
    encomendasEntregues,
    manutencaoEntregue,
    comprasRecebidas,
    lancamentos,
    encomendasAbertas,
    comprasAbertas,
    manutencaoAberta,
  ] = await Promise.all([
    query<{ total: string; updated_at: string }>(
      `select (quantity * unit_price) as total, updated_at from orders where status = 'entregue'`
    ),
    query<{ total_cost: string; updated_at: string }>(
      `select total_cost, updated_at from maintenance_orders where status = 'entregue'`
    ),
    query<{ total: string; updated_at: string }>(
      `select (quantity * unit_cost) as total, updated_at from purchase_orders where status = 'recebido'`
    ),
    query<{
      id: string;
      type: "receita" | "despesa";
      category: string;
      description: string;
      amount: string;
      status: "pendente" | "pago";
      due_date: string | null;
      paid_date: string | null;
      payment_method: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `select id, type, category, description, amount, status, due_date, paid_date, payment_method, created_at, updated_at
       from financial_transactions
       order by coalesce(due_date, created_at::date) desc, created_at desc`
    ),
    query<{
      id: string;
      customer_name: string;
      customer_phone: string | null;
      product_desc: string;
      quantity: number;
      unit_price: string;
      deposit_paid: string;
      status: string;
      expected_date: string | null;
    }>(
      `select id, customer_name, customer_phone, product_desc, quantity, unit_price, deposit_paid, status, expected_date
       from orders
       where status not in ('entregue', 'cancelado')
       order by expected_date nulls last, created_at`
    ),
    query<{
      id: string;
      supplier_name: string;
      supplier_phone: string | null;
      product_desc: string;
      quantity: number;
      unit_cost: string;
      status: string;
      expected_date: string | null;
    }>(
      `select id, supplier_name, supplier_phone, product_desc, quantity, unit_cost, status, expected_date
       from purchase_orders
       where status not in ('recebido', 'cancelado')
       order by expected_date nulls last, created_at`
    ),
    // OS de manutenção ainda não entregue também é receita pendente — mesma
    // lógica de Encomendas, só que sem sinal (o valor todo entra quando
    // o aparelho é retirado).
    query<{
      id: string;
      customer_name: string;
      customer_phone: string | null;
      device_desc: string;
      status: string;
      total_cost: string;
    }>(
      `select id, customer_name, customer_phone, device_desc, status, total_cost
       from maintenance_orders
       where status not in ('entregue', 'cancelado')
       order by created_at`
    ),
  ]);

  const sum = (rows: { total?: string; total_cost?: string }[], key: "total" | "total_cost") =>
    rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);

  const receitaEncomendas = sum(encomendasEntregues, "total");
  const receitaManutencao = sum(manutencaoEntregue, "total_cost");
  const custoCompras = sum(comprasRecebidas, "total");

  const receitaManual = lancamentos
    .filter((l) => l.type === "receita" && l.status === "pago")
    .reduce((s, l) => s + Number(l.amount), 0);
  const despesaManual = lancamentos
    .filter((l) => l.type === "despesa" && l.status === "pago")
    .reduce((s, l) => s + Number(l.amount), 0);
  const pendenteReceita = lancamentos
    .filter((l) => l.type === "receita" && l.status === "pendente")
    .reduce((s, l) => s + Number(l.amount), 0);
  const pendenteDespesa = lancamentos
    .filter((l) => l.type === "despesa" && l.status === "pendente")
    .reduce((s, l) => s + Number(l.amount), 0);

  const receitaBruta = receitaEncomendas + receitaManutencao + receitaManual;
  const despesaTotal = custoCompras + despesaManual;
  const resultado = receitaBruta - despesaTotal;

  const aReceber =
    encomendasAbertas.reduce((s, o) => s + Number(o.unit_price) * o.quantity - Number(o.deposit_paid), 0) +
    manutencaoAberta.reduce((s, o) => s + Number(o.total_cost), 0) +
    pendenteReceita;
  const aPagar =
    comprasAbertas.reduce((s, o) => s + Number(o.unit_cost) * o.quantity, 0) + pendenteDespesa;

  // Fluxo diário (últimos 30 dias) — combina as 4 fontes num só mapa por dia.
  // `pg` devolve colunas timestamptz/date como objeto Date, não string — por
  // isso passa tudo por `new Date(...)` antes de extrair o dia, em vez de
  // assumir string e usar `.slice()` direto (quebrava com "não é função").
  const fluxoMap = new Map<string, { entrada: number; saida: number }>();
  const addFluxo = (dateVal: string | Date | null, valor: number, side: "entrada" | "saida") => {
    const dia = (dateVal ? new Date(dateVal) : new Date()).toISOString().slice(0, 10);
    const entry = fluxoMap.get(dia) ?? { entrada: 0, saida: 0 };
    entry[side] += valor;
    fluxoMap.set(dia, entry);
  };
  encomendasEntregues.forEach((o) => addFluxo(o.updated_at, Number(o.total), "entrada"));
  manutencaoEntregue.forEach((o) => addFluxo(o.updated_at, Number(o.total_cost), "entrada"));
  comprasRecebidas.forEach((o) => addFluxo(o.updated_at, Number(o.total), "saida"));
  lancamentos
    .filter((l) => l.status === "pago")
    .forEach((l) => addFluxo(l.paid_date ?? l.created_at, Number(l.amount), l.type === "receita" ? "entrada" : "saida"));

  const today = new Date();
  const fluxoDiario: { dia: string; entrada: number; saida: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dia = d.toISOString().slice(0, 10);
    const entry = fluxoMap.get(dia) ?? { entrada: 0, saida: 0 };
    fluxoDiario.push({ dia, ...entry });
  }

  return NextResponse.json({
    kpis: { receita: receitaBruta, despesa: despesaTotal, resultado, aReceber, aPagar },
    dre: {
      receitas: [
        { label: "Encomendas entregues", value: receitaEncomendas },
        { label: "Manutenção entregue", value: receitaManutencao },
        { label: "Lançamentos manuais", value: receitaManual },
      ],
      receitaBruta,
      despesas: [
        { label: "Compras recebidas", value: custoCompras },
        { label: "Lançamentos manuais", value: despesaManual },
      ],
      despesaTotal,
      resultado,
    },
    fluxoDiario,
    receber: [
      ...encomendasAbertas.map((o) => ({
        id: o.id,
        origem: "encomenda" as const,
        nome: o.customer_name,
        telefone: o.customer_phone,
        descricao: o.product_desc,
        status: o.status,
        vencimento: o.expected_date,
        saldo: Number(o.unit_price) * o.quantity - Number(o.deposit_paid),
      })),
      ...manutencaoAberta.map((o) => ({
        id: o.id,
        origem: "manutencao" as const,
        nome: o.customer_name,
        telefone: o.customer_phone,
        descricao: o.device_desc,
        status: o.status,
        vencimento: null as string | null,
        saldo: Number(o.total_cost),
      })),
    ],
    pagar: comprasAbertas.map((o) => ({
      id: o.id,
      nome: o.supplier_name,
      telefone: o.supplier_phone,
      descricao: o.product_desc,
      status: o.status,
      vencimento: o.expected_date,
      valor: Number(o.unit_cost) * o.quantity,
    })),
    lancamentos,
  });
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
  const { type, category, description, amount, status, due_date, paid_date, payment_method } = parsed.data;

  const [row] = await query(
    `insert into financial_transactions (type, category, description, amount, status, due_date, paid_date, payment_method, created_by)
     values ($1, $2, $3, $4, coalesce($5, 'pendente'), $6, $7, $8, $9)
     returning id, type, category, description, amount, status, due_date, paid_date, payment_method, created_at, updated_at`,
    [type, category, description, amount, status, due_date || null, paid_date || null, payment_method || null, session.sub]
  );
  return NextResponse.json({ item: row }, { status: 201 });
}
