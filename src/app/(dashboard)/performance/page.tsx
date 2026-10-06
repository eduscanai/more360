"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type PerformanceData = {
  kpis: { faturamentoTotal: number; ticketMedio: number; totalVendas: number; melhorMes: string };
  porMes: { mes: string; faturamento: number }[];
  porOrigem: { origem: string; valor: number }[];
  topProdutos: { label: string; quantidade: number; valor: number }[];
};

const MONTH_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function monthLabel(ym: string) {
  if (!ym) return "—";
  const [, m] = ym.split("-");
  return MONTH_LABEL[Number(m) - 1] ?? ym;
}

/**
 * Gráfico de barras mensal — marcas finas (até 28px), topo arredondado 4px,
 * tooltip por barra no hover (nunca confia só na cor — sempre mostra o
 * valor quando passa o mouse). Uma série só, então sem legenda (o título da
 * seção já nomeia o que é).
 */
function MonthlyBarChart({ data }: { data: { mes: string; faturamento: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.faturamento), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, paddingTop: 32 }}>
      {data.map((d, i) => {
        const h = d.faturamento > 0 ? Math.max((d.faturamento / max) * 140, 4) : 0;
        const active = hover === i;
        return (
          <div
            key={d.mes}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {active && (
              <div
                style={{
                  position: "absolute",
                  bottom: h + 10,
                  background: "#1a1528",
                  border: "1px solid var(--color-glass-border)",
                  borderRadius: 8,
                  padding: "4px 9px",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  color: "var(--color-text-primary)",
                  fontWeight: 600,
                  zIndex: 10,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {formatCurrency(d.faturamento)}
              </div>
            )}
            <div
              style={{
                width: "100%",
                maxWidth: 28,
                height: h || 2,
                background: active ? "var(--color-accent-hover)" : "var(--color-accent)",
                borderRadius: "4px 4px 0 0",
                transition: "background 150ms ease",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 8 }}>{monthLabel(d.mes)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Comparativo de 2 categorias — cor + rótulo direto sempre visíveis juntos
 * (nunca só a cor), barras horizontais, fundo recessivo. */
function OrigemBars({ data }: { data: { origem: string; valor: number }[] }) {
  const max = Math.max(...data.map((d) => d.valor), 1);
  const colors = ["var(--color-accent)", "var(--color-blue)"];
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={d.origem}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[i % colors.length], display: "inline-block" }} />
              {d.origem}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>{formatCurrency(d.valor)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 5,
                width: `${(d.valor / max) * 100}%`,
                background: colors[i % colors.length],
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ranking de produtos — uma cor só (não é categoria, é magnitude por item),
 * rótulo de valor sempre visível ao lado da barra. */
function RankingBars({ items }: { items: { label: string; quantidade: number; valor: number }[] }) {
  const max = Math.max(...items.map((i) => i.valor), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", width: 16, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 220,
                }}
              >
                {item.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", flexShrink: 0 }}>
                {formatCurrency(item.valor)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  width: `${(item.valor / max) * 100}%`,
                  background: "var(--color-accent)",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle="Faturamento operacional — Encomendas e Manutenção entregues, sem precisar de ERP externo"
      />

      <div style={{ padding: "0 32px 32px" }}>
        {loading || !data ? (
          <EmptyState text="Carregando..." />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex gap-4 flex-wrap">
              <StatCard label="Faturamento total" value={formatCurrency(data.kpis.faturamentoTotal)} tone="success" />
              <StatCard label="Ticket médio" value={formatCurrency(data.kpis.ticketMedio)} tone="accent" />
              <StatCard label="Total de vendas" value={String(data.kpis.totalVendas)} />
              <StatCard label="Melhor mês" value={monthLabel(data.kpis.melhorMes)} />
            </div>

            <div className="glass-card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                Faturamento por mês
              </p>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Últimos 12 meses · passe o mouse pra ver o valor</p>
              {data.porMes.every((m) => m.faturamento === 0) ? (
                <EmptyState text="Sem vendas registradas ainda." />
              ) : (
                <MonthlyBarChart data={data.porMes} />
              )}
            </div>

            <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className="glass-card" style={{ padding: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14 }}>
                  Faturamento por origem
                </p>
                {data.porOrigem.every((o) => o.valor === 0) ? (
                  <EmptyState text="Sem dados ainda." />
                ) : (
                  <OrigemBars data={data.porOrigem} />
                )}
              </div>

              <div className="glass-card" style={{ padding: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14 }}>
                  Produtos mais vendidos (Encomendas)
                </p>
                {data.topProdutos.length === 0 ? (
                  <EmptyState text="Sem encomendas entregues ainda." />
                ) : (
                  <RankingBars items={data.topProdutos} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
