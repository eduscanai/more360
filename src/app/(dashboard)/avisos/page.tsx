"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Pin, CheckCircle2 } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

type Announcement = {
  id: string;
  title: string;
  content: string;
  display_mode: "feed" | "banner" | "modal";
  audience: "todos" | "owner" | "member";
  pinned: boolean;
  active: boolean;
  created_at: string;
  read_at: string | null;
};

const DISPLAY_LABEL: Record<Announcement["display_mode"], string> = {
  feed: "Feed",
  banner: "Banner",
  modal: "Modal",
};

const AUDIENCE_LABEL: Record<Announcement["audience"], string> = {
  todos: "Todos",
  owner: "Só owners",
  member: "Só members",
};

const emptyForm = {
  title: "",
  content: "",
  display_mode: "feed" as Announcement["display_mode"],
  audience: "todos" as Announcement["audience"],
  pinned: false,
  active: true,
};

export default function AvisosPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/avisos");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const naoLidos = items.filter((a) => !a.read_at).length;
    const fixados = items.filter((a) => a.pinned).length;
    return { total: items.length, naoLidos, fixados };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      display_mode: a.display_mode,
      audience: a.audience,
      pinned: a.pinned,
      active: a.active,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/avisos/${editing.id}` : "/api/avisos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  async function markAsRead(id: string) {
    await fetch(`/api/avisos/${id}/leitura`, { method: "POST" });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este aviso?")) return;
    await fetch(`/api/avisos/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Avisos"
        subtitle="Comunicados internos"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo aviso
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Total" value={String(stats.total)} />
        <StatCard label="Não lidos" value={String(stats.naoLidos)} tone="danger" />
        <StatCard label="Fixados" value={String(stats.fixados)} tone="accent" />
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : items.length === 0 ? (
          <EmptyState text="Nenhum aviso publicado ainda." />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((a) => (
              <div key={a.id} className="glass-card" style={{ padding: 18, opacity: a.active ? 1 : 0.5 }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      {a.pinned && <Pin size={13} style={{ color: "var(--color-accent)" }} />}
                      <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {a.title}
                      </h3>
                      {!a.read_at && <span className="chip chip-red">Novo</span>}
                      {!a.active && <span className="chip chip-gray">Inativo</span>}
                    </div>
                    <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 8 }}>{a.content}</p>
                    <div className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      <span className="chip chip-purple">{DISPLAY_LABEL[a.display_mode]}</span>
                      <span className="chip chip-blue">{AUDIENCE_LABEL[a.audience]}</span>
                      <span>{formatDate(a.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ flexShrink: 0 }}>
                    {!a.read_at && (
                      <button className="btn-icon" title="Marcar como lido" onClick={() => markAsRead(a.id)} style={{ color: "var(--color-success)" }}>
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => openEdit(a)}>
                      <Pencil size={15} />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(a.id)} style={{ color: "var(--color-danger)" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Editar aviso" : "Novo aviso"} onClose={() => setModalOpen(false)}>
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
            <Field label="Conteúdo">
              <textarea
                className="input"
                rows={4}
                required
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </Field>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Exibição">
                  <select
                    className="input"
                    value={form.display_mode}
                    onChange={(e) => setForm({ ...form, display_mode: e.target.value as Announcement["display_mode"] })}
                  >
                    {Object.entries(DISPLAY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Audiência">
                  <select
                    className="input"
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value as Announcement["audience"] })}
                  >
                    {Object.entries(AUDIENCE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                />
                Fixar no topo
              </label>
              <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Ativo
              </label>
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
