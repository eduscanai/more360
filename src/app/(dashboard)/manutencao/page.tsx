"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type MaintenanceOrder = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  device_desc: string;
  imei: string | null;
  problem_desc: string;
  status: "aguardando" | "em_andamento" | "concluido" | "entregue" | "cancelado";
  labor_cost: string;
  parts_cost: string;
  total_cost: string;
  finished_at: string | null;
  notes: string | null;
};

const STATUS_LABEL: Record<MaintenanceOrder["status"], string> = {
  aguardando: "Aguardando",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  device_desc: "",
  imei: "",
  problem_desc: "",
  status: "aguardando" as MaintenanceOrder["status"],
  labor_cost: "0",
  parts_cost: "0",
  finished_at: "",
  notes: "",
};

export default function ManutencaoPage() {
  const [items, setItems] = useState<MaintenanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/manutencao");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const emAberto = items.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
    const receitaEmAndamento = emAberto.reduce((s, o) => s + Number(o.total_cost), 0);
    return { total: items.length, emAberto: emAberto.length, receitaEmAndamento };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(o: MaintenanceOrder) {
    setEditing(o);
    setForm({
      customer_name: o.customer_name,
      customer_phone: o.customer_phone ?? "",
      device_desc: o.device_desc,
      imei: o.imei ?? "",
      problem_desc: o.problem_desc,
      status: o.status,
      labor_cost: o.labor_cost,
      parts_cost: o.parts_cost,
      finished_at: o.finished_at ? o.finished_at.slice(0, 10) : "",
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
      device_desc: form.device_desc,
      imei: form.imei || null,
      problem_desc: form.problem_desc,
      status: form.status,
      labor_cost: Number(form.labor_cost || 0),
      parts_cost: Number(form.parts_cost || 0),
      finished_at: form.finished_at || null,
      notes: form.notes || null,
    };
    try {
      const res = await fetch(editing ? `/api/manutencao/${editing.id}` : "/api/manutencao", {
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

  async function updateStatus(id: string, status: MaintenanceOrder["status"]) {
    await fetch(`/api/manutencao/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta ordem de serviço?")) return;
    await fetch(`/api/manutencao/${id}`, { method: "DELETE" });
    await load();
  }

  const previewTotal = Number(form.labor_cost || 0) + Number(form.parts_cost || 0);

  return (
    <div>
      <PageHeader
        title="Manutenção"
        subtitle="Ordens de serviço de reparo e assistência técnica"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova ordem de serviço
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Ordens de serviço" value={String(stats.total)} />
        <StatCard label="Em aberto" value={String(stats.emAberto)} tone="accent" />
        <StatCard label="Valor em andamento" value={formatCurrency(stats.receitaEmAndamento)} tone="success" />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhuma ordem de serviço cadastrada ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Cliente", "Aparelho", "Problema", "Mão de obra", "Peças", "Total", "Status", "Concluído em", ""].map((h) => (
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
                {items.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{o.customer_name}</div>
                      {o.customer_phone && (
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{o.customer_phone}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>
                      <div>{o.device_desc}</div>
                      {o.imei && (
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-family-mono)" }}>
                          IMEI {o.imei}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", maxWidth: 220 }}>{o.problem_desc}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatCurrency(Number(o.labor_cost))}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatCurrency(Number(o.parts_cost))}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-success)", fontWeight: 600 }}>{formatCurrency(Number(o.total_cost))}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex items-center gap-2">
                        <select
                          className="input"
                          value={o.status}
                          onChange={(e) => updateStatus(o.id, e.target.value as MaintenanceOrder["status"])}
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
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatDate(o.finished_at)}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Editar ordem de serviço" : "Nova ordem de serviço"} onClose={() => setModalOpen(false)}>
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
            <div className="flex gap-3">
              <div style={{ flex: 2 }}>
                <Field label="Aparelho">
                  <input
                    className="input"
                    required
                    placeholder="Ex: iPhone 13 Pro 256GB"
                    value={form.device_desc}
                    onChange={(e) => setForm({ ...form, device_desc: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="IMEI">
                  <input
                    className="input"
                    value={form.imei}
                    onChange={(e) => setForm({ ...form, imei: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <Field label="Problema relatado">
              <textarea
                className="input"
                rows={2}
                required
                value={form.problem_desc}
                onChange={(e) => setForm({ ...form, problem_desc: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Mão de obra (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.labor_cost}
                    onChange={(e) => setForm({ ...form, labor_cost: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Peças (R$)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.parts_cost}
                    onChange={(e) => setForm({ ...form, parts_cost: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Status">
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as MaintenanceOrder["status"] })}
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
            {editing && (
              <Field label="Data de conclusão">
                <input
                  className="input"
                  type="date"
                  value={form.finished_at}
                  onChange={(e) => setForm({ ...form, finished_at: e.target.value })}
                />
              </Field>
            )}
            <div
              className="flex items-center justify-between"
              style={{ padding: "10px 14px", background: "var(--color-accent-dim)", borderRadius: 12, fontSize: 13 }}
            >
              <span style={{ color: "var(--color-text-secondary)" }}>Total do serviço</span>
              <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{formatCurrency(previewTotal || 0)}</span>
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
