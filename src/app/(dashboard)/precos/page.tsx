"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  cost_price: string;
  margin_percent: string;
  sale_price: string;
  active: boolean;
  notes: string | null;
};

const emptyForm = {
  sku: "",
  name: "",
  category: "",
  cost_price: "",
  margin_percent: "",
  notes: "",
  active: true,
};

export default function PrecosPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/precos");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = items.filter((p) => p.active);
    const avgMargin =
      active.length > 0
        ? active.reduce((sum, p) => sum + Number(p.margin_percent), 0) / active.length
        : 0;
    const avgSale =
      active.length > 0
        ? active.reduce((sum, p) => sum + Number(p.sale_price), 0) / active.length
        : 0;
    return {
      total: items.length,
      active: active.length,
      avgMargin,
      avgSale,
    };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku ?? "",
      name: p.name,
      category: p.category ?? "",
      cost_price: p.cost_price,
      margin_percent: p.margin_percent,
      notes: p.notes ?? "",
      active: p.active,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      sku: form.sku || null,
      name: form.name,
      category: form.category || null,
      cost_price: Number(form.cost_price || 0),
      margin_percent: Number(form.margin_percent || 0),
      notes: form.notes || null,
      active: form.active,
    };
    try {
      const res = await fetch(editing ? `/api/precos/${editing.id}` : "/api/precos", {
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
    if (!confirm("Excluir este produto da tabela de preços?")) return;
    await fetch(`/api/precos/${id}`, { method: "DELETE" });
    await load();
  }

  const previewSale =
    Number(form.cost_price || 0) * (1 + Number(form.margin_percent || 0) / 100);

  return (
    <div>
      <PageHeader
        title="Tabela de Preços"
        subtitle="Custo, margem e preço final de venda"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo produto
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Produtos cadastrados" value={String(stats.total)} />
        <StatCard label="Ativos" value={String(stats.active)} tone="accent" />
        <StatCard label="Margem média" value={`${stats.avgMargin.toFixed(1)}%`} tone="success" />
        <StatCard label="Preço médio de venda" value={formatCurrency(stats.avgSale)} />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhum produto cadastrado ainda. Clique em “Novo produto” para começar." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["SKU", "Produto", "Categoria", "Custo", "Margem", "Preço venda", "Status", ""].map((h) => (
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
                {items.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)", fontSize: 12 }}>
                      {p.sku || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-primary)", fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{p.category || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatCurrency(Number(p.cost_price))}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{Number(p.margin_percent).toFixed(1)}%</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-success)", fontWeight: 600 }}>{formatCurrency(Number(p.sale_price))}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={p.active ? "chip chip-green" : "chip chip-gray"}>{p.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-1">
                        <button className="btn-icon" onClick={() => openEdit(p)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(p.id)} style={{ color: "var(--color-danger)" }}>
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

      {modalOpen && (
        <Modal title={editing ? "Editar produto" : "Novo produto"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="SKU">
                  <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </Field>
              </div>
              <div style={{ flex: 2 }}>
                <Field label="Categoria">
                  <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </Field>
              </div>
            </div>
            <Field label="Nome do produto">
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Preço de custo (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Margem (%)">
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={form.margin_percent}
                    onChange={(e) => setForm({ ...form, margin_percent: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div
              className="flex items-center justify-between"
              style={{ padding: "10px 14px", background: "var(--color-accent-dim)", borderRadius: 12, fontSize: 13 }}
            >
              <span style={{ color: "var(--color-text-secondary)" }}>Preço de venda calculado</span>
              <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{formatCurrency(previewSale || 0)}</span>
            </div>
            <Field label="Observações">
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Produto ativo na tabela
            </label>
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
