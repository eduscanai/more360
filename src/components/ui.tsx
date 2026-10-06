"use client";

import { X } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-4"
      style={{ padding: "28px 32px 8px" }}
    >
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "danger"
      ? "var(--color-danger)"
      : tone === "accent"
      ? "var(--color-accent)"
      : "var(--color-text-primary)";
  return (
    <div className="glass-card" style={{ padding: "18px 20px", flex: "1 1 180px", minWidth: 180 }}>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "var(--font-family-display)" }}>
        {value}
      </p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card fade-slide-up"
        style={{ padding: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto", background: "#151020" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
            {title}
          </h2>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="glass-card flex items-center justify-center"
      style={{ padding: "48px 24px", color: "var(--color-text-muted)", fontSize: 13 }}
    >
      {text}
    </div>
  );
}
