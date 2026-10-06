"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

function RedefinirSenhaForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Link inválido — falta o token de redefinição.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.reason === "expired" || data.reason === "used" || data.reason === "not_found") {
          router.push("/login?error=link_expirado");
          return;
        }
        setError(data.error || "Não foi possível redefinir a senha.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
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
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: "var(--font-family-display)", color: "var(--color-text-primary)" }}
            >
              Nova <span style={{ color: "var(--color-accent)" }}>senha</span>
            </h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              Escolha uma nova senha para sua conta.
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

          {done ? (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ background: "var(--color-success-dim)", border: "1px solid rgba(0,230,138,0.25)", color: "var(--color-success)" }}
            >
              <CheckCircle2 size={16} />
              Senha redefinida! Redirecionando para o login...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--color-text-muted)" }} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                    className="input w-full"
                    style={{ paddingLeft: "2.5rem" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--color-text-muted)" }} />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    minLength={8}
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
                {isLoading ? "Salvando..." : "Redefinir senha"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm">
          <Link href="/login" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
