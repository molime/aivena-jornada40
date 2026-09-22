"use client";

// Primitivas de UI del design system "Aivena" (dark, acento ámbar).
// Client Components porque Select/Input/Button aceptan handlers (onChange/onClick).
import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={`card p-5 ${hover ? "card-hover" : ""} ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BadgeTone = "brand" | "success" | "danger" | "warning" | "info" | "neutral";
const TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-elevated text-muted",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// Estados del flujo de aprobación de programaciones
export const RUN_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Borrador", tone: "warning" },
  APPROVED: { label: "Aprobada", tone: "info" },
  PUBLISHED: { label: "Publicada", tone: "success" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-brand text-black font-semibold hover:bg-brand-strong",
    secondary: "bg-elevated text-ink border border-overlay hover:border-[#3a3a42]",
    ghost: "text-muted hover:text-ink hover:bg-elevated",
    danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger/25",
  };
  const sizes = { sm: "px-2.5 py-1 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
      suppressHydrationWarning
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className = "",
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block" suppressHydrationWarning>
      {label && <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>}
      <input
        className={`w-full rounded-lg border border-overlay bg-elevated px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand/60 ${className}`}
        {...props}
        suppressHydrationWarning
      />
    </label>
  );
}

export function Select({
  label,
  children,
  className = "",
  ...props
}: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block" suppressHydrationWarning>
      {label && <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>}
      <select
        className={`w-full rounded-lg border border-overlay bg-elevated px-3 py-2 text-sm text-ink focus:border-brand/60 ${className}`}
        {...props}
        suppressHydrationWarning
      >
        {children}
      </select>
    </label>
  );
}

// Encabezado estándar de página: título, descripción y acción principal a la derecha.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "success";
  delta?: string; // p.ej. "+2.1 pts vs semana anterior"
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div
        className={`tnum mt-1.5 text-[26px] font-semibold leading-none ${
          tone === "brand" ? "text-brand" : tone === "success" ? "text-success" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 min-h-4 text-xs text-muted">
        {delta && <span className="text-success">{delta} </span>}
        {hint}
      </div>
    </div>
  );
}
