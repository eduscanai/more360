"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

type Warranty = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  product_desc: string;
  imei: string | null;
  policy_type: "fabricante" | "loja" | "seguro";
  starts_at: string;
  expires_at: string;
  status: "ativa" | "acionada" | "resolvida";
  notes: string | null;
};

const POLICY_LABEL: Record<Warranty["policy_type"], string> = {
  fabricante: "Fabricante",
  loja: "Loja",
  seguro: "Seguro",
};

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  product_desc: "",
  imei: "",
  policy_type: "loja" as Warranty["policy_type"],
  starts_at: new Date().toISOString().slice(0, 10),
  expires_at: "",
  status: "ativa" as Warranty["status"],
  notes: "",
};

// "ativa" no banco é só "não foi acionada/resolvida ainda" — se está
// expirando ou já expirou é calculado aqui, comparando com hoje, no mesmo
// espírito do aging do Estoque. Evita precisar de um cron rodando pra
// atualizar status sozinho.
function daysUntil(dateStr: string) {
  const target = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function displayStatus(w: Warranty): { label: string; chip: string } {
  if (w.status === "acionada") return { label: "Acionada", chip: "chip-blue" };
  if (w.status === "resolvida") return { label: "Resolvida", chip: "chip-gray" };
  const days = daysUntil(w.expires_at);
  if (days < 0) return { label: "Expirada", chip: "chip-red" };
  if (days <= 30) return { label: `Expira em ${days}d`, chip: "chip-yellow" };
  return { label: "Ativa", chip: "chip-green" };
}

export default function GarantiasPage() {
  const [items, setItems] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Warranty | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/garantias");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    let ativas = 0;
    let expirando = 0;
    let expiradas = 0;
    for (const w of items) {
      if (w.status !== "ativa") continue;
      const days = daysUntil(w.expires_at);
      if (days < 0) expiradas++;
      else if (days <= 30) expirando++;
      else ativas++;
    }
    return { ativas, expirando, expiradas };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(w: Warranty) {
    setEditing(w);
    setForm({
      customer_name: w.customer_name,
      customer_phone: w.customer_phone ?? "",
      product_desc: w.product_desc,
      imei: w.imei ?? "",
      policy_type: w.policy_type,
      starts_at: w.starts_at.slice(0, 10),
      expires_at: w.expires_at.slice(0, 10),
      status: w.status,
      notes: w.notes ?? "",
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
      imei: form.imei || null,
      policy_type: form.policy_type,
      starts_at: form.starts_at || null,
      expires_at: form.expires_at,
      status: form.status,
      notes: form.notes || null,
    };
    try {
      const res = await fetch(editing ? `/api/garantias/${editing.id}` : "/api/garantias", {
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
    if (!confirm("Excluir esta garantia?")) return;
    await fetch(`/api/garantias/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Garantias"
        subtitle="Controle de garantia por venda/aparelho"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova garantia
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Ativas" value={String(stats.ativas)} tone="success" />
        <StatCard label="Expirando em 30 dias" value={String(stats.expirando)} tone="accent" />
        <StatCard label="Expiradas" value={String(stats.expiradas)} tone="danger" />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhuma garantia cadastrada ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Cliente", "Produto", "Política", "Início", "Vencimento", "Status", ""].map((h) => (
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
                {items.map((w) => {
                  const s = displayStatus(w);
                  return (
                    <tr key={w.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{w.customer_name}</div>
                        {w.customer_phone && (
                          <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{w.customer_phone}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>
                        <div>{w.product_desc}</div>
                        {w.imei && (
                          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-family-mono)" }}>
                            IMEI {w.imei}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{POLICY_LABEL[w.policy_type]}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatDate(w.starts_at)}</td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatDate(w.expires_at)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`chip ${s.chip}`}>{s.label}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex gap-1">
                          <button className="btn-icon" onClick={() => openEdit(w)}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDelete(w.id)} style={{ color: "var(--color-danger)" }}>
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
        <Modal title={editing ? "Editar garantia" : "Nova garantia"} onClose={() => setModalOpen(false)}>
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
                <Field label="Produto">
                  <input
                    className="input"
                    required
                    value={form.product_desc}
                    onChange={(e) => setForm({ ...form, product_desc: e.target.value })}
                  />
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
                <Field label="Política">
                  <select
                    className="input"
                    value={form.policy_type}
                    onChange={(e) => setForm({ ...form, policy_type: e.target.value as Warranty["policy_type"] })}
                  >
                    {Object.entries(POLICY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Início">
                  <input
                    className="input"
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Vencimento">
                  <input
                    className="input"
                    type="date"
                    required
                    value={form.expires_at}
                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <Field label="Status">
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Warranty["status"] })}
              >
                <option value="ativa">Ativa</option>
                <option value="acionada">Acionada</option>
                <option value="resolvida">Resolvida</option>
              </select>
            </Field>
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
