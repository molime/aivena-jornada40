"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Barra superior: contexto de la página + menú de usuario. La acción global
// (Ejecutar programación) vive en el Dashboard y en Programaciones.
export function Topbar({ user }: { user: { email: string; name?: string | null } }) {
  const router = useRouter();
  return (
    <header className="no-print flex h-14 items-center justify-between border-b border-overlay bg-surface px-6">
      <div className="text-xs text-muted">
        <span className="text-faint">JORNADA40</span>
        <span className="mx-2 text-faint">/</span>
        Programación semanal bajo el tope de 40h
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{user.name ?? "Usuario"}</div>
          <div className="text-[11px] text-muted">{user.email}</div>
        </div>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="rounded-lg border border-overlay px-3 py-1.5 text-xs text-muted transition-colors hover:border-[#3a3a42] hover:text-ink"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
