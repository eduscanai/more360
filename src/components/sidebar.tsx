"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  DollarSign,
  Wallet,
  PackageSearch,
  Wrench,
  Users,
  UserCog,
  Boxes,
  ShoppingCart,
  BadgeCheck,
  ListTodo,
  Megaphone,
  Activity,
  BookOpen,
  BarChart3,
  LogOut,
} from "lucide-react";

const modules = [
  { href: "/precos", label: "Tabela de Preços", Icon: DollarSign },
  { href: "/financeiro", label: "Financeiro", Icon: Wallet },
  { href: "/performance", label: "Performance", Icon: BarChart3 },
  { href: "/encomendas", label: "Encomendas", Icon: PackageSearch },
  { href: "/manutencao", label: "Manutenção", Icon: Wrench },
  { href: "/pessoas", label: "Pessoas", Icon: Users },
  { href: "/estoque", label: "Estoque", Icon: Boxes },
  { href: "/compras", label: "Compras", Icon: ShoppingCart },
  { href: "/garantias", label: "Garantias", Icon: BadgeCheck },
  { href: "/tarefas", label: "Tarefas", Icon: ListTodo },
  { href: "/avisos", label: "Avisos", Icon: Megaphone },
  { href: "/acompanhamento", label: "Acompanhamento", Icon: Activity },
  { href: "/knowledge", label: "Knowledge", Icon: BookOpen },
  // ownerOnly: só aparece pra quem tem role 'owner' — a API já bloqueia (403)
  // quem tentar mudar role/status sem ser owner, isso aqui só evita mostrar
  // um link cujas ações membros comuns não conseguem usar.
  { href: "/usuarios", label: "Controle de Acesso", Icon: UserCog, ownerOnly: true },
];

export function Sidebar({ userName, role }: { userName: string; role: "owner" | "member" }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = userName.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      style={{
        width: "220px",
        minWidth: "220px",
        height: "100%",
        background: "rgba(0,0,0,0.2)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        gap: "4px",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        onClick={() => router.push("/precos")}
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1,
          gap: "2px",
          padding: "4px 4px 20px",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 800,
            fontSize: "28px",
            color: "#E94B35",
            letterSpacing: "-0.04em",
          }}
        >
          more.
        </span>
        <span
          style={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 700,
            fontSize: "10px",
            color: "#fff",
            letterSpacing: "0.08em",
          }}
        >
          360 LITE
        </span>
      </div>

      {/* Navegação */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {modules.filter((m) => !m.ownerOnly || role === "owner").map((m) => {
          const isActive = pathname.startsWith(m.href);
          return (
            <div
              key={m.href}
              onClick={() => router.push(m.href)}
              style={{
                width: "100%",
                height: "46px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "0 12px",
                cursor: "pointer",
                background: isActive ? "rgba(124,92,252,0.2)" : "transparent",
                border: isActive ? "1px solid rgba(124,92,252,0.4)" : "1px solid transparent",
                color: isActive ? "#7C5CFC" : "rgba(255,255,255,0.55)",
                transition: "all 0.2s ease",
              }}
            >
              <m.Icon size={18} />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                {m.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Usuário + logout */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--color-accent-dim)",
            border: "1px solid var(--color-accent-border)",
            color: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {userName}
        </span>
        <button
          onClick={handleLogout}
          title="Sair"
          className="btn-icon"
          style={{ flexShrink: 0 }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
