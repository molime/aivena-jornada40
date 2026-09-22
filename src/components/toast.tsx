"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

// Sistema de toasts mínimo (sin dependencias). Uso:
//   const toast = useToast(); toast.success("Programación publicada"); toast.error("...");
type Toast = { id: number; kind: "success" | "error" | "info"; message: string };

const ToastCtx = createContext<(kind: Toast["kind"], message: string) => void>(() => {});

export function useToast() {
  const push = useContext(ToastCtx);
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
  };
}

const STYLES: Record<Toast["kind"], string> = {
  success: "border-success/40 text-success",
  error: "border-danger/40 text-danger",
  info: "border-info/40 text-info",
};
const ICONS: Record<Toast["kind"], string> = { success: "✓", error: "✕", info: "ℹ" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full items-center gap-2 rounded-lg border bg-elevated/95 px-3.5 py-2.5 text-sm shadow-xl backdrop-blur ${STYLES[t.kind]}`}
          >
            <span className="font-bold">{ICONS[t.kind]}</span>
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
