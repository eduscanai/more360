"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "link_expirado") {
      setError("O link de redefinição expirou ou já foi utilizado. Solicite um novo abaixo.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível entrar.");
        return;
      }
      const redirectTo = searchParams.get("redirectTo") || "/precos";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--color-bg-primary)", minHeight: "100dvh" }}
    >
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-card" style={{ padding: "2.5rem" }}>
          <div className="mb-8">
            <h1
              className="text-4xl font-bold mb-2"
              style={{ fontFamily: "var(--font-family-display)", color: "var(--color-text-primary)" }}
            >
              <span style={{ color: "var(--color-accent)" }}>More</span> 360
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", fontWeight: 500, marginLeft: 8 }}>
                lite
              </span>
            </h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              Preços · Financeiro · Encomendas
            </p>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--color-text-muted)" }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="input w-full"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Senha
                </label>
                <Link href="/esqueci-senha" className="text-sm" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--color-text-muted)" }} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input w-full"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? "Conectando..." : "Entrar"}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Não tem conta?{" "}
          <Link href="/cadastro" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
