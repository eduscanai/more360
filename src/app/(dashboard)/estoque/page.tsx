"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type StockItem = {
  id: string;
  product_desc: string;
  sku: string | null;
  imei: string | null;
  condition: "novo" | "seminovo" | "usado";
  status: "em_estoque" | "reservado" | "vendido" | "defeito" | "em_manutencao";
  cost_price: string;
  location: string | null;
  entry_date: string;
  notes: string | null;
};

const STATUS_LABEL: Record<StockItem["status"], string> = {
  em_estoque: "Em estoque",
  reservado: "Reservado",
  vendido: "Vendido",
  defeito: "Defeito",
  em_manutencao: "Em manutenção",
};

const STATUS_CHIP: Record<StockItem["status"], string> = {
  em_estoque: "chip-green",
  reservado: "chip-yellow",
  vendido: "chip-blue",
  defeito: "chip-red",
  em_manutencao: "chip-purple",
};

const CONDITION_LABEL: Record<StockItem["condition"], string> = {
  novo: "Novo",
  seminovo: "Seminovo",
  usado: "Usado",
};

const emptyForm = {
  product_desc: "",
  sku: "",
  imei: "",
  condition: "novo" as StockItem["condition"],
  status: "em_estoque" as StockItem["status"],
  cost_price: "0",
  location: "",
  entry_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

// Dias desde a entrada, pra colorir o aging (mesmo espírito de "dias em
// atraso" já usado no Financeiro, só que calculado direto no client — não
// precisa de cron/trigger pra isso).
function daysSince(dateStr: string) {
  const entry = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  return Math.floor((Date.now() - entry.getTime()) / (1000 * 60 * 60 * 24));
}

export default function EstoquePage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | StockItem["status"]>("todos");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/estoque");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const emEstoque = items.filter((i) => i.status === "em_estoque");
    const valorEstoque = emEstoque.reduce((s, i) => s + Number(i.cost_price), 0);
    const reservados = items.filter((i) => i.status === "reservado").length;
    return { total: emEstoque.length, valorEstoque, reservados };
  }, [items]);

  const filtered = items.filter((i) => filter === "todos" || i.status === filter);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(i: StockItem) {
    setEditing(i);
    setForm({
      product_desc: i.product_desc,
      sku: i.sku ?? "",
      imei: i.imei ?? "",
      condition: i.condition,
      status: i.status,
      cost_price: i.cost_price,
      location: i.location ?? "",
      entry_date: i.entry_date.slice(0, 10),
      notes: i.notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      product_desc: form.product_desc,
      sku: form.sku || null,
      imei: form.imei || null,
      condition: form.condition,
      status: form.status,
      cost_price: Number(form.cost_price || 0),
      location: form.location || null,
      entry_date: form.entry_date || null,
      notes: form.notes || null,
    };
    try {
      const res = await fetch(editing ? `/api/estoque/${editing.id}` : "/api/estoque", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao salvar.");
        return;
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este item do estoque?")) return;
    await fetch(`/api/estoque/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle="Itens e unidades disponíveis"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo item
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Em estoque" value={String(stats.total)} />
        <StatCard label="Valor em estoque" value={formatCurrency(stats.valorEstoque)} tone="accent" />
        <StatCard label="Reservados" value={String(stats.reservados)} tone="success" />
      </div>

      <div className="flex gap-2 flex-wrap" style={{ padding: "0 32px 12px" }}>
        {(["todos", "em_estoque", "reservado", "em_manutencao", "vendido", "defeito"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "chip chip-purple" : "chip chip-gray"}
            style={{ cursor: "pointer", border: "none" }}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : filtered.length === 0 ? (
          <EmptyState text="Nenhum item cadastrado ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Produto", "Condição", "Custo", "Local", "Dias em estoque", "Status", ""].map((h) => (
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
                {filtered.map((i) => {
                  const age = daysSince(i.entry_date);
                  const ageChip = age > 60 ? "chip-red" : age > 30 ? "chip-yellow" : "chip-gray";
                  return (
                    <tr key={i.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{i.product_desc}</div>
                        {(i.sku || i.imei) && (
                          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-family-mono)" }}>
                            {[i.sku, i.imei].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{CONDITION_LABEL[i.condition]}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatCurrency(Number(i.cost_price))}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{i.location || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`chip ${ageChip}`}>{age}d</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`chip ${STATUS_CHIP[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex gap-1">
                          <button className="btn-icon" onClick={() => openEdit(i)}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDelete(i.id)} style={{ color: "var(--color-danger)" }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Editar item" : "Novo item"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <Field label="Produto">
              <input
                className="input"
                required
                value={form.product_desc}
                onChange={(e) => setForm({ ...form, product_desc: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="SKU">
                  <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="IMEI">
                  <input className="input" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Condição">
                  <select
                    className="input"
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value as StockItem["condition"] })}
                  >
                    {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Status">
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as StockItem["status"] })}
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Custo (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Local">
                  <input
                    className="input"
                    placeholder="Loja, depósito..."
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Data de entrada">
                  <input
                    className="input"
                    type="date"
                    value={form.entry_date}
                    onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <Field label="Observações">
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
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
