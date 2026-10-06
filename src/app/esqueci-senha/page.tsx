"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível processar o pedido.");
        return;
      }
      setSent(true);
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
              Esqueceu a <span style={{ color: "var(--color-accent)" }}>senha?</span>
            </h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              Informe seu email e enviaremos um link de redefinição.
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

          {sent ? (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ background: "var(--color-success-dim)", border: "1px solid rgba(0,230,138,0.25)", color: "var(--color-success)" }}
            >
              <CheckCircle2 size={16} />
              Se o email existir, um link de redefinição foi gerado. Peça pro
              administrador verificar o log do servidor pra pegar o link
              (ainda não há envio de e-mail automático configurado).
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? "Enviando..." : "Enviar link"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-1"
            style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            <ArrowLeft size={14} /> Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
