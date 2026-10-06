"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type PurchaseOrder = {
  id: string;
  supplier_name: string;
  supplier_phone: string | null;
  product_desc: string;
  quantity: number;
  unit_cost: string;
  status: "pedido" | "enviado" | "recebido" | "cancelado";
  expected_date: string | null;
  notes: string | null;
};

const STATUS_LABEL: Record<PurchaseOrder["status"], string> = {
  pedido: "Pedido",
  enviado: "Enviado",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

const emptyForm = {
  supplier_name: "",
  supplier_phone: "",
  product_desc: "",
  quantity: "1",
  unit_cost: "",
  status: "pedido" as PurchaseOrder["status"],
  expected_date: "",
  notes: "",
};

export default function ComprasPage() {
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/compras");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const abertos = items.filter((o) => o.status !== "recebido" && o.status !== "cancelado");
    const emAberto = abertos.reduce((s, o) => s + Number(o.unit_cost) * o.quantity, 0);
    return { total: items.length, abertos: abertos.length, emAberto };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(o: PurchaseOrder) {
    setEditing(o);
    setForm({
      supplier_name: o.supplier_name,
      supplier_phone: o.supplier_phone ?? "",
      product_desc: o.product_desc,
      quantity: String(o.quantity),
      unit_cost: o.unit_cost,
      status: o.status,
      expected_date: o.expected_date ? o.expected_date.slice(0, 10) : "",
      notes: o.notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      supplier_name: form.supplier_name,
      supplier_phone: form.supplier_phone || null,
      product_desc: form.product_desc,
      quantity: Number(form.quantity || 1),
      unit_cost: Number(form.unit_cost || 0),
      status: form.status,
      expected_date: form.expected_date || null,
      notes: form.notes || null,
    };
    try {
      const res = await fetch(editing ? `/api/compras/${editing.id}` : "/api/compras", {
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

  async function updateStatus(id: string, status: PurchaseOrder["status"]) {
    await fetch(`/api/compras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este pedido de compra?")) return;
    await fetch(`/api/compras/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="Pedidos a fornecedores"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo pedido
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Total de pedidos" value={String(stats.total)} />
        <StatCard label="Em andamento" value={String(stats.abertos)} tone="accent" />
        <StatCard label="Valor em aberto" value={formatCurrency(stats.emAberto)} tone="danger" />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhum pedido de compra cadastrado ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Fornecedor", "Produto", "Qtd", "Custo unit.", "Total", "Status", "Previsão", ""].map((h) => (
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
                {items.map((o) => {
                  const total = Number(o.unit_cost) * o.quantity;
                  return (
                    <tr key={o.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{o.supplier_name}</div>
                        {o.supplier_phone && (
                          <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{o.supplier_phone}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{o.product_desc}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{o.quantity}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatCurrency(Number(o.unit_cost))}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-primary)", fontWeight: 600 }}>{formatCurrency(total)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex items-center gap-2">
                          <select
                            className="input"
                            value={o.status}
                            onChange={(e) => updateStatus(o.id, e.target.value as PurchaseOrder["status"])}
                            style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
                          >
                            {Object.entries(STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {o.status === "recebido" && (
                            <span className="chip chip-red" title="Contabilizado como despesa no Financeiro">
                              💰 no Financeiro
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatDate(o.expected_date)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex gap-1">
                          <button className="btn-icon" onClick={() => openEdit(o)}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDelete(o.id)} style={{ color: "var(--color-danger)" }}>
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
        <Modal title={editing ? "Editar pedido" : "Novo pedido"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <div style={{ flex: 2 }}>
                <Field label="Fornecedor">
                  <input
                    className="input"
                    required
                    value={form.supplier_name}
                    onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Telefone">
                  <input
                    className="input"
                    value={form.supplier_phone}
                    onChange={(e) => setForm({ ...form, supplier_phone: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <Field label="Produto / descrição">
              <input
                className="input"
                required
                value={form.product_desc}
                onChange={(e) => setForm({ ...form, product_desc: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Quantidade">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Custo unitário (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseOrder["status"] })}
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Previsão de chegada">
                  <input
                    className="input"
                    type="date"
                    value={form.expected_date}
                    onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
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
