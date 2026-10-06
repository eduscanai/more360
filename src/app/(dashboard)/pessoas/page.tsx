"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  type: "cliente" | "fornecedor" | "tecnico" | "outro";
  address: string | null;
  notes: string | null;
  active: boolean;
};

const TYPE_LABEL: Record<Contact["type"], string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  tecnico: "Técnico",
  outro: "Outro",
};

const TYPE_CHIP: Record<Contact["type"], string> = {
  cliente: "chip-purple",
  fornecedor: "chip-blue",
  tecnico: "chip-yellow",
  outro: "chip-gray",
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  document: "",
  type: "cliente" as Contact["type"],
  address: "",
  notes: "",
  active: true,
};

export default function PessoasPage() {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | Contact["type"]>("todos");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/pessoas");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const clientes = items.filter((c) => c.type === "cliente").length;
    const fornecedores = items.filter((c) => c.type === "fornecedor").length;
    return { total: items.length, clientes, fornecedores };
  }, [items]);

  const filtered = items.filter((c) => filter === "todos" || c.type === filter);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      document: c.document ?? "",
      type: c.type,
      address: c.address ?? "",
      notes: c.notes ?? "",
      active: c.active,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      document: form.document || null,
      type: form.type,
      address: form.address || null,
      notes: form.notes || null,
      active: form.active,
    };
    try {
      const res = await fetch(editing ? `/api/pessoas/${editing.id}` : "/api/pessoas", {
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
    if (!confirm("Excluir este contato?")) return;
    await fetch(`/api/pessoas/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Pessoas"
        subtitle="Clientes, fornecedores e técnicos cadastrados"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo contato
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Total de contatos" value={String(stats.total)} />
        <StatCard label="Clientes" value={String(stats.clientes)} tone="accent" />
        <StatCard label="Fornecedores" value={String(stats.fornecedores)} tone="success" />
      </div>

      <div className="flex gap-2 flex-wrap" style={{ padding: "0 32px 12px" }}>
        {(["todos", "cliente", "fornecedor", "tecnico", "outro"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "chip chip-purple" : "chip chip-gray"}
            style={{ cursor: "pointer", border: "none" }}
          >
            {f === "todos" ? "Todos" : TYPE_LABEL[f]}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : filtered.length === 0 ? (
          <EmptyState text="Nenhum contato cadastrado ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Nome", "Tipo", "Telefone", "Email", "Documento", "Status", ""].map((h) => (
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
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-primary)", fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`chip ${TYPE_CHIP[c.type]}`}>{TYPE_LABEL[c.type]}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{c.phone || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{c.email || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontFamily: "var(--font-family-mono)", fontSize: 12 }}>
                      {c.document || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={c.active ? "chip chip-green" : "chip chip-gray"}>{c.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-1">
                        <button className="btn-icon" onClick={() => openEdit(c)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(c.id)} style={{ color: "var(--color-danger)" }}>
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
        <Modal title={editing ? "Editar contato" : "Novo contato"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <div style={{ flex: 2 }}>
                <Field label="Nome">
                  <input
                    className="input"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Tipo">
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as Contact["type"] })}
                  >
                    {Object.entries(TYPE_LABEL).map(([value, label]) => (
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
                <Field label="Telefone">
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Email">
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <Field label="CPF/CNPJ">
              <input
                className="input"
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
              />
            </Field>
            <Field label="Endereço">
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
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
              Contato ativo
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
