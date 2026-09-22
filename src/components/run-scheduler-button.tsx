"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

/** Botón global "Ejecutar programación": corre el solver para todas las tiendas (crea DRAFTs). */
export function RunSchedulerButton() {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/schedule/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error");
      const valid = data.summaries.filter((s: { valid: boolean }) => s.valid).length;
      toast.success(`Programación generada: ${valid}/${data.summaries.length} tiendas válidas`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ejecutar");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button onClick={run} disabled={running}>
      {running ? "Programando…" : "⟳ Generar programación"}
    </Button>
  );
}
