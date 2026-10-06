import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/auth";

/**
 * Performance também é um dashboard compilado, mesmo espírito do Financeiro
 * — sem tabela própria. No More 360 original, Performance é alimentado por
 * sync com o ERP Fone Ninja (vendas reais, por vendedor, com metas/bônus);
 * aqui não tem ERP, então o que dá pra fazer com fidelidade é a parte que
 * só depende de dados que o próprio app já tem: faturamento operacional
 * (Encomendas + Manutenção entregues), tendência mensal, e produtos mais
 * vendidos. Ranking por vendedor/bônus fica de fora — não existe "vendedor"
 * como conceito em nenhum módulo daqui.
 */
export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const [encomendas, manutencao] = await Promise.all([
    query<{ total: string; updated_at: string; product_desc: string; quantity: number }>(
      `select (quantity * unit_price) as total, updated_at, product_desc, quantity
       from orders where status = 'entregue'`
    ),
    query<{ total_cost: string; updated_at: string }>(
      `select total_cost, updated_at from maintenance_orders where status = 'entregue'`
    ),
  ]);

  const toMonthKey = (d: string | Date) => new Date(d).toISOString().slice(0, 7); // YYYY-MM

  // Tendência mensal — últimos 12 meses, começando do mês mais antigo.
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  const porMesMap = new Map<string, number>(months.map((m) => [m, 0]));
  encomendas.forEach((o) => {
    const k = toMonthKey(o.updated_at);
    if (porMesMap.has(k)) porMesMap.set(k, (porMesMap.get(k) ?? 0) + Number(o.total));
  });
  manutencao.forEach((o) => {
    const k = toMonthKey(o.updated_at);
    if (porMesMap.has(k)) porMesMap.set(k, (porMesMap.get(k) ?? 0) + Number(o.total_cost));
  });
  const porMes = months.map((mes) => ({ mes, faturamento: porMesMap.get(mes) ?? 0 }));

  const faturamentoEncomendas = encomendas.reduce((s, o) => s + Number(o.total), 0);
  const faturamentoManutencao = manutencao.reduce((s, o) => s + Number(o.total_cost), 0);
  const faturamentoTotal = faturamentoEncomendas + faturamentoManutencao;
  const totalVendas = encomendas.length + manutencao.length;
  const ticketMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;

  const melhorMes = porMes.reduce(
    (best, m) => (m.faturamento > best.faturamento ? m : best),
    { mes: "", faturamento: 0 }
  );

  // Top produtos — agrupado por descrição (texto livre, normalizado por
  // trim+lowercase pra juntar "iPhone 13" e "iphone 13" na mesma linha).
  const produtoMap = new Map<string, { label: string; quantidade: number; valor: number }>();
  encomendas.forEach((o) => {
    const key = o.product_desc.trim().toLowerCase();
    const entry = produtoMap.get(key) ?? { label: o.product_desc.trim(), quantidade: 0, valor: 0 };
    entry.quantidade += o.quantity;
    entry.valor += Number(o.total);
    produtoMap.set(key, entry);
  });
  const topProdutos = Array.from(produtoMap.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);

  return NextResponse.json({
    kpis: { faturamentoTotal, ticketMedio, totalVendas, melhorMes: melhorMes.mes },
    porMes,
    porOrigem: [
      { origem: "Encomendas", valor: faturamentoEncomendas },
      { origem: "Manutenção", valor: faturamentoManutencao },
    ],
    topProdutos,
  });
}
