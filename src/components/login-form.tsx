"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@demo.mx");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError("Credenciales inválidas. Usa admin@demo.mx / demo1234");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
          Correo
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-overlay bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand/60"
          suppressHydrationWarning
        />
      </div>
      <div suppressHydrationWarning>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-overlay bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand/60"
          suppressHydrationWarning
        />
      </div>
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-brand-strong disabled:opacity-50"
        suppressHydrationWarning
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-faint">
        Demo: <span className="tnum">admin@demo.mx / demo1234</span>
      </p>
    </form>
  );
}
