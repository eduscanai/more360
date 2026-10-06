"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  product_desc: string;
  quantity: number;
  unit_price: string;
  deposit_paid: string;
  status: "aguardando" | "pago" | "chegou" | "entregue" | "cancelado";
  expected_date: string | null;
  notes: string | null;
};

const STATUS_LABEL: Record<Order["status"], string> = {
  aguardando: "Aguardando",
  pago: "Pago",
  chegou: "Chegou",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  product_desc: "",
  quantity: "1",
  unit_price: "",
  deposit_paid: "0",
  status: "aguardando" as Order["status"],
  expected_date: "",
  notes: "",
};

export default function EncomendasPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/encomendas");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const abertas = items.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
    const emAberto = abertas.reduce(
      (s, o) => s + Number(o.unit_price) * o.quantity - Number(o.deposit_paid),
      0
    );
    return { total: items.length, abertas: abertas.length, emAberto };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      customer_name: o.customer_name,
      customer_phone: o.customer_phone ?? "",
      product_desc: o.product_desc,
      quantity: String(o.quantity),
      unit_price: o.unit_price,
      deposit_paid: o.deposit_paid,
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
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      product_desc: form.product_desc,
      quantity: Number(form.quantity || 1),
      unit_price: Number(form.unit_price || 0),
      deposit_paid: Number(form.deposit_paid || 0),
      status: form.status,
      expected_date: form.expected_date || null,
      notes: form.notes || null,
    };
    try {
      const res = await fetch(editing ? `/api/encomendas/${editing.id}` : "/api/encomendas", {
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

  async function updateStatus(id: string, status: Order["status"]) {
    await fetch(`/api/encomendas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta encomenda?")) return;
    await fetch(`/api/encomendas/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Encomendas"
        subtitle="Pedidos de clientes em andamento"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova encomenda
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Total de encomendas" value={String(stats.total)} />
        <StatCard label="Em andamento" value={String(stats.abertas)} tone="accent" />
        <StatCard label="Valor em aberto" value={formatCurrency(stats.emAberto)} tone="danger" />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhuma encomenda cadastrada ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Cliente", "Produto", "Qtd", "Unitário", "Total", "Sinal", "Status", "Previsão", ""].map((h) => (
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
                  const total = Number(o.unit_price) * o.quantity;
                  return (
                    <tr key={o.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{o.customer_name}</div>
                        {o.customer_phone && (
                          <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{o.customer_phone}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{o.product_desc}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{o.quantity}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatCurrency(Number(o.unit_price))}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-primary)", fontWeight: 600 }}>{formatCurrency(total)}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-success)" }}>{formatCurrency(Number(o.deposit_paid))}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex items-center gap-2">
                          <select
                            className="input"
                            value={o.status}
                            onChange={(e) => updateStatus(o.id, e.target.value as Order["status"])}
                            style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
                          >
                            {Object.entries(STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {o.status === "entregue" && (
                            <span className="chip chip-green" title="Contabilizado como receita no Financeiro">
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
        <Modal title={editing ? "Editar encomenda" : "Nova encomenda"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <div style={{ flex: 2 }}>
                <Field label="Cliente">
                  <input
                    className="input"
                    required
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Telefone">
                  <input
                    className="input"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
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
                <Field label="Preço unitário (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Sinal pago (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.deposit_paid}
                    onChange={(e) => setForm({ ...form, deposit_paid: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, status: e.target.value as Order["status"] })}
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
