"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

// Acciones del flujo de aprobación sobre una corrida concreta.
export function RunActions({
  runId,
  status,
  valid,
}: {
  runId: string;
  status: string;
  valid: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function call(action: "approve" | "publish") {
    setBusy(true);
    try {
      const res = await fetch(`/api/schedule/${runId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error");
      toast.success(action === "approve" ? "Programación aprobada" : "Programación publicada al equipo");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (status === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!valid || busy} onClick={() => call("approve")} title={valid ? "" : "Corrida con violaciones: no aprobable"}>
          Aprobar
        </Button>
        <span className="text-[11px] text-faint">{valid ? "" : "Requiere 0 violaciones"}</span>
      </div>
    );
  }
  if (status === "APPROVED") {
    return (
      <Button size="sm" disabled={busy} onClick={() => call("publish")}>
        Publicar
      </Button>
    );
  }
  return null; // PUBLISHED / ARCHIVED: sin acciones
}
