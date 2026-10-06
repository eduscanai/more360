"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, TrendingUp } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

type Project = {
  id: string;
  name: string;
  sector: "mkt" | "gestao" | "operacao" | "rh";
  status: "no_prazo" | "em_risco" | "atrasado";
  owner_name: string | null;
  start_date: string;
  target_date: string | null;
  notes: string | null;
  latest_progress: string | null;
  latest_entry_date: string | null;
};

const SECTOR_LABEL: Record<Project["sector"], string> = {
  mkt: "Marketing",
  gestao: "Gestão",
  operacao: "Operação",
  rh: "RH",
};

const STATUS_LABEL: Record<Project["status"], string> = {
  no_prazo: "No prazo",
  em_risco: "Em risco",
  atrasado: "Atrasado",
};

const STATUS_CHIP: Record<Project["status"], string> = {
  no_prazo: "chip-green",
  em_risco: "chip-yellow",
  atrasado: "chip-red",
};

const emptyForm = {
  name: "",
  sector: "operacao" as Project["sector"],
  status: "no_prazo" as Project["status"],
  owner_name: "",
  start_date: new Date().toISOString().slice(0, 10),
  target_date: "",
  notes: "",
};

const emptyEntryForm = { progress_percent: "0", note: "" };

function hasEntryToday(p: Project) {
  if (!p.latest_entry_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return p.latest_entry_date.slice(0, 10) === today;
}

export default function AcompanhamentoPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [entryProject, setEntryProject] = useState<Project | null>(null);
  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const [entrySaving, setEntrySaving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/acompanhamento");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const semEntradaHoje = items.filter((p) => !hasEntryToday(p)).length;
    const emRisco = items.filter((p) => p.status === "em_risco" || p.status === "atrasado").length;
    return { total: items.length, semEntradaHoje, emRisco };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      sector: p.sector,
      status: p.status,
      owner_name: p.owner_name ?? "",
      start_date: p.start_date.slice(0, 10),
      target_date: p.target_date ? p.target_date.slice(0, 10) : "",
      notes: p.notes ?? "",
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
      sector: form.sector,
      status: form.status,
      owner_name: form.owner_name || null,
      start_date: form.start_date || null,
      target_date: form.target_date || null,
      notes: form.notes || null,
    };
    try {
      const res = await fetch(editing ? `/api/acompanhamento/${editing.id}` : "/api/acompanhamento", {
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
    if (!confirm("Excluir este projeto e todo o histórico de entradas dele?")) return;
    await fetch(`/api/acompanhamento/${id}`, { method: "DELETE" });
    await load();
  }

  function openEntry(p: Project) {
    setEntryProject(p);
    setEntryForm({ progress_percent: p.latest_progress ?? "0", note: "" });
  }

  async function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryProject) return;
    setEntrySaving(true);
    try {
      await fetch(`/api/acompanhamento/${entryProject.id}/entradas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress_percent: Number(entryForm.progress_percent || 0),
          note: entryForm.note || null,
        }),
      });
      setEntryProject(null);
      await load();
    } finally {
      setEntrySaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Acompanhamento"
        subtitle="Projetos longos com entradas diárias de progresso"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo projeto
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Projetos ativos" value={String(stats.total)} />
        <StatCard label="Sem entrada hoje" value={String(stats.semEntradaHoje)} tone="danger" />
        <StatCard label="Em risco / atrasado" value={String(stats.emRisco)} tone="accent" />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhum projeto cadastrado ainda." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Projeto", "Setor", "Progresso", "Última entrada", "Status", ""].map((h) => (
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
                {items.map((p) => {
                  const progress = p.latest_progress ? Number(p.latest_progress) : 0;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{p.name}</div>
                        {p.owner_name && <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{p.owner_name}</div>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{SECTOR_LABEL[p.sector]}</td>
                      <td style={{ padding: "12px 16px", minWidth: 140 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 99,
                              background: "rgba(255,255,255,0.08)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${progress}%`,
                                height: "100%",
                                background: "var(--color-accent)",
                                borderRadius: 99,
                              }}
                            />
                          </div>
                          <span style={{ color: "var(--color-text-secondary)", fontSize: 11, minWidth: 32 }}>{progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {p.latest_entry_date ? (
                          <span style={{ color: hasEntryToday(p) ? "var(--color-success)" : "var(--color-text-secondary)" }}>
                            {formatDate(p.latest_entry_date)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>Sem entradas</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`chip ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex gap-1">
                          <button className="btn-icon" title="Registrar progresso" onClick={() => openEntry(p)} style={{ color: "var(--color-accent)" }}>
                            <TrendingUp size={15} />
                          </button>
                          <button className="btn-icon" onClick={() => openEdit(p)}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon" onClick={() => handleDelete(p.id)} style={{ color: "var(--color-danger)" }}>
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
        <Modal title={editing ? "Editar projeto" : "Novo projeto"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <Field label="Nome do projeto">
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Setor">
                  <select
                    className="input"
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value as Project["sector"] })}
                  >
                    {Object.entries(SECTOR_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Responsável">
                  <input
                    className="input"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Início">
                  <input
                    className="input"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Entrega prevista">
                  <input
                    className="input"
                    type="date"
                    value={form.target_date}
                    onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Status">
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}
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

      {entryProject && (
        <Modal title={`Registrar progresso — ${entryProject.name}`} onClose={() => setEntryProject(null)}>
          <form onSubmit={handleSaveEntry} className="flex flex-col gap-3">
            <Field label="Progresso (%)">
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                required
                value={entryForm.progress_percent}
                onChange={(e) => setEntryForm({ ...entryForm, progress_percent: e.target.value })}
              />
            </Field>
            <Field label="Nota do dia">
              <textarea
                className="input"
                rows={3}
                placeholder="O que foi feito hoje..."
                value={entryForm.note}
                onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 justify-end" style={{ marginTop: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setEntryProject(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={entrySaving}>
                {entrySaving ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
