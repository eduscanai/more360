"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Gauge, FileText, ArrowDownLeft, ArrowUpRight, ListPlus,
  Plus, Trash2, Pencil, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type Dre = {
  receitas: { label: string; value: number }[];
  receitaBruta: number;
  despesas: { label: string; value: number }[];
  despesaTotal: number;
  resultado: number;
};

type Receivable = {
  id: string;
  origem: "encomenda" | "manutencao";
  nome: string;
  telefone: string | null;
  descricao: string;
  status: string;
  vencimento: string | null;
  saldo: number;
};

type Payable = {
  id: string;
  nome: string;
  telefone: string | null;
  descricao: string;
  status: string;
  vencimento: string | null;
  valor: number;
};

type Lancamento = {
  id: string;
  type: "receita" | "despesa";
  category: string;
  description: string;
  amount: string;
  status: "pendente" | "pago";
  due_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
};

type FinanceiroData = {
  kpis: { receita: number; despesa: number; resultado: number; aReceber: number; aPagar: number };
  dre: Dre;
  fluxoDiario: { dia: string; entrada: number; saida: number }[];
  receber: Receivable[];
  pagar: Payable[];
  lancamentos: Lancamento[];
};

const TABS = [
  { key: "visao", label: "Visão Geral", Icon: Gauge },
  { key: "dre", label: "DRE", Icon: FileText },
  { key: "receber", label: "A Receber", Icon: ArrowDownLeft },
  { key: "pagar", label: "A Pagar", Icon: ArrowUpRight },
  { key: "lancamentos", label: "Lançamentos", Icon: ListPlus },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr.slice(0, 10)}T23:59:59`);
  return d.getTime() < Date.now();
}

function DreRow({
  label,
  value,
  bold,
  color,
  indent,
}: {
  label: string;
  value: number;
  bold?: boolean;
  color?: string;
  indent?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "10px 0",
        paddingLeft: indent ? 20 : 0,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ fontSize: 13, color: bold ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color ?? "var(--color-text-primary)" }}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

const emptyForm = {
  type: "receita" as "receita" | "despesa",
  category: "",
  description: "",
  amount: "",
  status: "pendente" as "pendente" | "pago",
  due_date: "",
  payment_method: "",
};

export default function FinanceiroPage() {
  const [data, setData] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("visao");
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | "receita" | "despesa" | "pendente">("todos");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/financeiro");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const maxFluxo = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.fluxoDiario.flatMap((d) => [d.entrada, d.saida]), 1);
  }, [data]);

  async function markReceivableDone(r: Receivable) {
    setBusy(true);
    try {
      const endpoint = r.origem === "encomenda" ? `/api/encomendas/${r.id}` : `/api/manutencao/${r.id}`;
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "entregue" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function markPurchaseReceived(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/compras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "recebido" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(l: Lancamento) {
    setEditing(l);
    setForm({
      type: l.type,
      category: l.category,
      description: l.description,
      amount: l.amount,
      status: l.status,
      due_date: l.due_date ? l.due_date.slice(0, 10) : "",
      payment_method: l.payment_method ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const paidDate =
      form.status === "pago"
        ? editing && editing.status === "pago"
          ? editing.paid_date
          : new Date().toISOString().slice(0, 10)
        : null;
    const payload = {
      type: form.type,
      category: form.category,
      description: form.description,
      amount: Number(form.amount || 0),
      status: form.status,
      due_date: form.due_date || null,
      paid_date: paidDate,
      payment_method: form.payment_method || null,
    };
    try {
      const res = await fetch(editing ? `/api/financeiro/${editing.id}` : "/api/financeiro", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao salvar.");
        return;
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function markLancamentoPaid(id: string) {
    await fetch(`/api/financeiro/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pago", paid_date: new Date().toISOString().slice(0, 10) }),
    });
    await load();
  }

  async function handleDeleteLancamento(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await fetch(`/api/financeiro/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Compilado automaticamente de Encomendas, Compras e Manutenção — lançamentos manuais só para o que não vem de nenhum módulo"
        action={
          tab === "lancamentos" && (
            <button className="btn-primary" onClick={openNew}>
              <Plus size={16} /> Novo lançamento
            </button>
          )
        }
      />

      <div className="flex gap-1.5 flex-wrap" style={{ padding: "0 32px 20px" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2"
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 10,
                cursor: "pointer",
                background: active ? "var(--color-accent-dim)" : "transparent",
                color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                border: active ? "1px solid var(--color-accent-border)" : "1px solid transparent",
              }}
            >
              <t.Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        {loading || !data ? (
          <EmptyState text="Carregando..." />
        ) : tab === "visao" ? (
          <div className="flex flex-col gap-5">
            <div className="flex gap-4 flex-wrap">
              <StatCard label="Receita" value={formatCurrency(data.kpis.receita)} tone="success" />
              <StatCard label="Despesa" value={formatCurrency(data.kpis.despesa)} tone="danger" />
              <StatCard
                label="Resultado"
                value={formatCurrency(data.kpis.resultado)}
                tone={data.kpis.resultado >= 0 ? "success" : "danger"}
              />
              <StatCard label="A Receber" value={formatCurrency(data.kpis.aReceber)} tone="accent" />
              <StatCard label="A Pagar" value={formatCurrency(data.kpis.aPagar)} />
            </div>

            <div className="glass-card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14 }}>
                Fluxo de caixa — últimos 30 dias
              </p>
              <div className="flex flex-col gap-1">
                {data.fluxoDiario
                  .filter((d) => d.entrada > 0 || d.saida > 0)
                  .map((d) => (
                    <div key={d.dia} className="flex items-center gap-2" style={{ fontSize: 11 }}>
                      <span style={{ color: "var(--color-text-muted)", minWidth: 64 }}>{formatDate(d.dia)}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div
                          style={{
                            height: 10,
                            borderRadius: 4,
                            width: `${(d.entrada / maxFluxo) * 100}%`,
                            minWidth: d.entrada > 0 ? 3 : 0,
                            background: "var(--color-success)",
                          }}
                        />
                        <span style={{ color: "var(--color-success)", minWidth: 70 }}>
                          {d.entrada > 0 ? formatCurrency(d.entrada) : ""}
                        </span>
                      </div>
                      <div className="flex-1 flex items-center gap-1 justify-end">
                        <span style={{ color: "var(--color-danger)", minWidth: 70, textAlign: "right" }}>
                          {d.saida > 0 ? formatCurrency(d.saida) : ""}
                        </span>
                        <div
                          style={{
                            height: 10,
                            borderRadius: 4,
                            width: `${(d.saida / maxFluxo) * 100}%`,
                            minWidth: d.saida > 0 ? 3 : 0,
                            background: "var(--color-danger)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                {data.fluxoDiario.every((d) => d.entrada === 0 && d.saida === 0) && (
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", padding: "20px 0" }}>
                    Sem movimento nos últimos 30 dias.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : tab === "dre" ? (
          <div className="glass-card" style={{ padding: 24, maxWidth: 560 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
              Demonstração de Resultado
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 18 }}>
              Totais acumulados — receita realizada menos despesa realizada
            </p>
            <DreRow label="Receita bruta" value={data.dre.receitaBruta} bold color="var(--color-accent)" />
            {data.dre.receitas.map((r) => (
              <DreRow key={r.label} label={`(+) ${r.label}`} value={r.value} indent />
            ))}
            <DreRow label="Despesas" value={-data.dre.despesaTotal} bold color="var(--color-danger)" />
            {data.dre.despesas.map((d) => (
              <DreRow key={d.label} label={`(−) ${d.label}`} value={-d.value} indent color="var(--color-danger)" />
            ))}
            <div style={{ marginTop: 8 }}>
              <DreRow
                label="(=) Resultado"
                value={data.dre.resultado}
                bold
                color={data.dre.resultado >= 0 ? "var(--color-success)" : "var(--color-danger)"}
              />
            </div>
          </div>
        ) : tab === "receber" ? (
          data.receber.length === 0 ? (
            <EmptyState text="Nada em aberto — todas as encomendas e OS de manutenção já foram entregues." />
          ) : (
            <div className="flex flex-col gap-2">
              {data.receber.map((r) => {
                const overdue = isOverdue(r.vencimento);
                return (
                  <div key={`${r.origem}-${r.id}`} className="glass-card flex items-center justify-between" style={{ padding: 14 }}>
                    <div className="flex items-center gap-3">
                      {overdue && <AlertTriangle size={16} style={{ color: "var(--color-danger)" }} />}
                      <div>
                        <div className="flex items-center gap-2">
                          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{r.nome}</p>
                          <span className="chip chip-gray" style={{ fontSize: 9 }}>
                            {r.origem === "encomenda" ? "Encomenda" : "Manutenção"}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          {r.descricao}
                          {r.vencimento ? ` · vence ${formatDate(r.vencimento)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 14, fontWeight: 700, color: overdue ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                        {formatCurrency(r.saldo)}
                      </span>
                      <button className="btn-ghost" disabled={busy} onClick={() => markReceivableDone(r)} style={{ fontSize: 11, padding: "6px 10px" }}>
                        <CheckCircle2 size={13} /> Entregue
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "pagar" ? (
          data.pagar.length === 0 ? (
            <EmptyState text="Nenhuma compra em aberto — tudo recebido." />
          ) : (
            <div className="flex flex-col gap-2">
              {data.pagar.map((p) => {
                const overdue = isOverdue(p.vencimento);
                return (
                  <div key={p.id} className="glass-card flex items-center justify-between" style={{ padding: 14 }}>
                    <div className="flex items-center gap-3">
                      {overdue && <AlertTriangle size={16} style={{ color: "var(--color-danger)" }} />}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.nome}</p>
                        <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          {p.descricao} · vence {formatDate(p.vencimento)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 14, fontWeight: 700, color: overdue ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                        {formatCurrency(p.valor)}
                      </span>
                      <button className="btn-ghost" disabled={busy} onClick={() => markPurchaseReceived(p.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                        <CheckCircle2 size={13} /> Recebido
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div>
            <div className="flex gap-2" style={{ marginBottom: 16 }}>
              {(["todos", "receita", "despesa", "pendente"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={filter === f ? "chip chip-purple" : "chip chip-gray"}
                  style={{ cursor: "pointer", border: "none" }}
                >
                  {f === "todos" ? "Todos" : f === "receita" ? "Receitas" : f === "despesa" ? "Despesas" : "Pendentes"}
                </button>
              ))}
            </div>

            {data.lancamentos.length === 0 ? (
              <EmptyState text="Nenhum lançamento manual ainda — aluguel, salários e outras despesas/receitas que não vêm de Encomendas/Compras/Manutenção entram aqui." />
            ) : (
              <div className="glass-card" style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                      {["Tipo", "Categoria", "Descrição", "Valor", "Vencimento", "Status", "Pago em", ""].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.lancamentos
                      .filter((l) => {
                        if (filter === "todos") return true;
                        if (filter === "pendente") return l.status === "pendente";
                        return l.type === filter;
                      })
                      .map((l) => (
                        <tr key={l.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <span className={l.type === "receita" ? "chip chip-green" : "chip chip-red"}>
                              {l.type === "receita" ? "Receita" : "Despesa"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{l.category}</td>
                          <td style={{ padding: "12px 16px", color: "var(--color-text-primary)" }}>{l.description}</td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontWeight: 600,
                              color: l.type === "receita" ? "var(--color-success)" : "var(--color-danger)",
                            }}
                          >
                            {l.type === "receita" ? "+" : "-"} {formatCurrency(Number(l.amount))}
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatDate(l.due_date)}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span className={l.status === "pago" ? "chip chip-green" : "chip chip-yellow"}>
                              {l.status === "pago" ? "Pago" : "Pendente"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>{formatDate(l.paid_date)}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div className="flex gap-1">
                              {l.status === "pendente" && (
                                <button
                                  className="btn-icon"
                                  title="Marcar como pago"
                                  onClick={() => markLancamentoPaid(l.id)}
                                  style={{ color: "var(--color-success)" }}
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                              )}
                              <button className="btn-icon" onClick={() => openEdit(l)}>
                                <Pencil size={15} />
                              </button>
                              <button className="btn-icon" onClick={() => handleDeleteLancamento(l.id)} style={{ color: "var(--color-danger)" }}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Editar lançamento" : "Novo lançamento manual"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              Use isto só pra receita/despesa que não vem de Encomendas, Compras ou
              Manutenção — aluguel, salários, outras receitas avulsas.
            </p>
            <div className="flex gap-2">
              {(["receita", "despesa"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={form.type === t ? "btn-primary" : "btn-ghost"}
                  style={{ flex: 1 }}
                >
                  {t === "receita" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>
            <Field label="Categoria">
              <input
                className="input"
                required
                placeholder="Ex: aluguel, salários, outras..."
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
            <Field label="Descrição">
              <input
                className="input"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Valor (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Vencimento">
                  <input
                    className="input"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Status">
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as "pendente" | "pago" })}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Forma de pagamento">
                  <input
                    className="input"
                    placeholder="Pix, cartão, boleto..."
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 justify-end" style={{ marginTop: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
