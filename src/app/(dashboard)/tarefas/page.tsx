"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Lock } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "a_fazer" | "em_andamento" | "concluida";
  priority: "baixa" | "media" | "alta";
  due_date: string | null;
  assignee_name: string | null;
  is_personal: boolean;
};

const STATUS_LABEL: Record<Task["status"], string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const STATUS_CHIP: Record<Task["status"], string> = {
  a_fazer: "chip-gray",
  em_andamento: "chip-blue",
  concluida: "chip-green",
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const PRIORITY_CHIP: Record<Task["priority"], string> = {
  baixa: "chip-gray",
  media: "chip-yellow",
  alta: "chip-red",
};

const emptyForm = {
  title: "",
  description: "",
  status: "a_fazer" as Task["status"],
  priority: "media" as Task["priority"],
  due_date: "",
  assignee_name: "",
  is_personal: false,
};

function isLate(t: Task) {
  if (!t.due_date || t.status === "concluida") return false;
  const due = new Date(`${t.due_date.slice(0, 10)}T23:59:59`);
  return due.getTime() < Date.now();
}

export default function TarefasPage() {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | Task["status"]>("todos");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/tarefas");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const emAndamento = items.filter((t) => t.status === "em_andamento").length;
    const atrasadas = items.filter(isLate).length;
    return { total: items.length, emAndamento, atrasadas };
  }, [items]);

  const filtered = items.filter((t) => filter === "todos" || t.status === filter);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      due_date: t.due_date ? t.due_date.slice(0, 10) : "",
      assignee_name: t.assignee_name ?? "",
      is_personal: t.is_personal,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assignee_name: form.assignee_name || null,
      is_personal: form.is_personal,
    };
    try {
      const res = await fetch(editing ? `/api/tarefas/${editing.id}` : "/api/tarefas", {
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

  async function updateStatus(id: string, status: Task["status"]) {
    await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta tarefa?")) return;
    await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Tarefas"
        subtitle="Lista de trabalho da equipe"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova tarefa
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Total" value={String(stats.total)} />
        <StatCard label="Em andamento" value={String(stats.emAndamento)} tone="accent" />
        <StatCard label="Atrasadas" value={String(stats.atrasadas)} tone="danger" />
      </div>

      <div className="flex gap-2 flex-wrap" style={{ padding: "0 32px 12px" }}>
        {(["todos", "a_fazer", "em_andamento", "concluida"] as const).map((f) => (
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
          <EmptyState text="Nenhuma tarefa cadastrada ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Tarefa", "Responsável", "Prioridade", "Prazo", "Status", ""].map((h) => (
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
                {filtered.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex items-center gap-2">
                        {t.is_personal && <Lock size={12} style={{ color: "var(--color-text-muted)" }} />}
                        <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{t.title}</span>
                      </div>
                      {t.description && (
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 2 }}>{t.description}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{t.assignee_name || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`chip ${PRIORITY_CHIP[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: isLate(t) ? "var(--color-danger)" : "var(--color-text-secondary)" }}>
                        {formatDate(t.due_date)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        className="input"
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value as Task["status"])}
                        style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
                      >
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-1">
                        <button className="btn-icon" onClick={() => openEdit(t)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(t.id)} style={{ color: "var(--color-danger)" }}>
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
        <Modal title={editing ? "Editar tarefa" : "Nova tarefa"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <Field label="Título">
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Descrição">
              <textarea
                className="input"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Responsável">
                  <input
                    className="input"
                    value={form.assignee_name}
                    onChange={(e) => setForm({ ...form, assignee_name: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Prazo">
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
                <Field label="Prioridade">
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                  >
                    {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
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
                    onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
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
            <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              <input
                type="checkbox"
                checked={form.is_personal}
                onChange={(e) => setForm({ ...form, is_personal: e.target.checked })}
              />
              Tarefa pessoal (só você vê)
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
