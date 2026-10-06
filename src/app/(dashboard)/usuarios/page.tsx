"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

type User = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  active: boolean;
  created_at: string;
};

type AccessLog = {
  id: string;
  event_type: "login_success" | "login_failed" | "logout";
  email_tried: string | null;
  created_at: string;
  user_name: string | null;
};

const EVENT_LABEL: Record<AccessLog["event_type"], string> = {
  login_success: "Login com sucesso",
  login_failed: "Tentativa de login falhou",
  logout: "Logout",
};

const EVENT_CHIP: Record<AccessLog["event_type"], string> = {
  login_success: "chip-green",
  login_failed: "chip-red",
  logout: "chip-gray",
};

export default function UsuariosPage() {
  const [items, setItems] = useState<User[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/usuarios");
    const data = await res.json();
    setItems(data.items ?? []);
    setLogs(data.logs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const ativos = items.filter((u) => u.active).length;
    const owners = items.filter((u) => u.role === "owner").length;
    return { total: items.length, ativos, owners };
  }, [items]);

  async function updateUser(id: string, patch: Partial<Pick<User, "role" | "active">>) {
    setError("");
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erro ao atualizar usuário.");
      return;
    }
    await load();
  }

  return (
    <div>
      <PageHeader title="Controle de Acesso" subtitle="Usuários, roles e histórico de acesso" />

      <div className="flex gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <StatCard label="Usuários" value={String(stats.total)} />
        <StatCard label="Ativos" value={String(stats.ativos)} tone="success" />
        <StatCard label="Owners" value={String(stats.owners)} tone="accent" />
      </div>

      {error && (
        <div className="text-sm" style={{ padding: "0 32px 12px", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}

      <div style={{ padding: "8px 32px 24px" }}>
        {loading ? (
          <EmptyState text="Carregando..." />
        ) : (
          <div className="glass-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
                  {["Nome", "Email", "Criado em", "Role", "Status", ""].map((h) => (
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
                {items.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-primary)", fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{u.email}</td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{formatDate(u.created_at)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        className="input"
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value as User["role"] })}
                        style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
                      >
                        <option value="owner">Owner</option>
                        <option value="member">Member</option>
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={u.active ? "chip chip-green" : "chip chip-gray"}>{u.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        className="btn-icon"
                        title={u.active ? "Desativar" : "Ativar"}
                        onClick={() => updateUser(u.id, { active: !u.active })}
                        style={{ color: u.active ? "var(--color-danger)" : "var(--color-success)" }}
                      >
                        {u.active ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div style={{ padding: "0 32px 32px" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)", marginBottom: 10 }}>
            Últimos acessos
          </h2>
          <div className="glass-card" style={{ padding: 8 }}>
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between"
                style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}
              >
                <div className="flex items-center gap-2">
                  <span className={`chip ${EVENT_CHIP[l.event_type]}`}>{EVENT_LABEL[l.event_type]}</span>
                  <span style={{ color: "var(--color-text-secondary)" }}>{l.user_name || l.email_tried || "—"}</span>
                </div>
                <span style={{ color: "var(--color-text-muted)" }}>{formatDate(l.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
