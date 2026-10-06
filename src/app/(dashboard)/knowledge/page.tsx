"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Search, ExternalLink } from "lucide-react";
import { PageHeader, StatCard, Modal, Field, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

type KnowledgeEntry = {
  id: string;
  title: string;
  type: "link" | "nota" | "aprendizado";
  url: string | null;
  content: string | null;
  tags: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<KnowledgeEntry["type"], string> = {
  link: "Link",
  nota: "Nota",
  aprendizado: "Aprendizado",
};

const TYPE_CHIP: Record<KnowledgeEntry["type"], string> = {
  link: "chip-blue",
  nota: "chip-gray",
  aprendizado: "chip-purple",
};

const emptyForm = {
  title: "",
  type: "nota" as KnowledgeEntry["type"],
  url: "",
  content: "",
  tags: "",
};

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const links = items.filter((i) => i.type === "link").length;
    const aprendizados = items.filter((i) => i.type === "aprendizado").length;
    return { total: items.length, links, aprendizados };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.tags ?? "").toLowerCase().includes(q) ||
        (i.content ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(k: KnowledgeEntry) {
    setEditing(k);
    setForm({
      title: k.title,
      type: k.type,
      url: k.url ?? "",
      content: k.content ?? "",
      tags: k.tags ?? "",
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
      type: form.type,
      url: form.url || null,
      content: form.content || null,
      tags: form.tags || null,
    };
    try {
      const res = await fetch(editing ? `/api/knowledge/${editing.id}` : "/api/knowledge", {
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
    if (!confirm("Excluir este registro?")) return;
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Knowledge"
        subtitle="Base de conhecimento — links, notas e aprendizados"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo registro
          </button>
        }
      />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Total" value={String(stats.total)} />
        <StatCard label="Links" value={String(stats.links)} tone="accent" />
        <StatCard label="Aprendizados" value={String(stats.aprendizados)} tone="success" />
      </div>

      <div style={{ padding: "0 32px 12px" }}>
        <div className="relative" style={{ maxWidth: 360 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--color-text-muted)" }} />
          <input
            className="input"
            placeholder="Buscar por título, tag ou conteúdo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.25rem" }}
          />
        </div>
      </div>

      <div style={{ padding: "8px 32px 32px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : filtered.length === 0 ? (
          <EmptyState text={items.length === 0 ? "Nenhum registro cadastrado ainda." : "Nada encontrado pra essa busca."} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((k) => (
              <div key={k.id} className="glass-card" style={{ padding: 16 }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <span className={`chip ${TYPE_CHIP[k.type]}`}>{TYPE_LABEL[k.type]}</span>
                      <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {k.title}
                      </h3>
                    </div>
                    {k.url && (
                      <a
                        href={k.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: "var(--color-accent)", fontSize: 12, marginBottom: 6, textDecoration: "none" }}
                      >
                        <ExternalLink size={12} /> {k.url}
                      </a>
                    )}
                    {k.content && (
                      <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 6 }}>{k.content}</p>
                    )}
                    <div className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      {k.tags &&
                        k.tags.split(",").map((t) => (
                          <span key={t} className="chip chip-gray">
                            {t.trim()}
                          </span>
                        ))}
                      <span>{formatDate(k.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ flexShrink: 0 }}>
                    <button className="btn-icon" onClick={() => openEdit(k)}>
                      <Pencil size={15} />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(k.id)} style={{ color: "var(--color-danger)" }}>
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
        <Modal title={editing ? "Editar registro" : "Novo registro"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            {error && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <div style={{ flex: 2 }}>
                <Field label="Título">
                  <input
                    className="input"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Tipo">
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as KnowledgeEntry["type"] })}
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
            <Field label="URL (opcional)">
              <input
                className="input"
                type="url"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
            <Field label="Conteúdo">
              <textarea
                className="input"
                rows={3}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </Field>
            <Field label="Tags (separadas por vírgula)">
              <input
                className="input"
                placeholder="ex: processo, financeiro, treinamento"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
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
