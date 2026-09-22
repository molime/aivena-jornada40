"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

// Edición de la configuración operativa de una tienda (en Ajustes o en el detalle de tienda).
export function StoreConfigForm({
  store,
}: {
  store: {
    id: string;
    openHour: number;
    closeHour: number;
    serviceRate: number;
    minStaff: number;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    openHour: String(store.openHour),
    closeHour: String(store.closeHour),
    serviceRate: String(store.serviceRate),
    minStaff: String(store.minStaff),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openHour: Number(form.openHour),
          closeHour: Number(form.closeHour),
          serviceRate: Number(form.serviceRate),
          minStaff: Number(form.minStaff),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error");
      toast.success("Configuración de tienda guardada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-overlay bg-elevated px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="block w-24">
        <span className="mb-1.5 block text-xs font-medium text-muted">Apertura</span>
        <input name="openHour" type="number" min="0" max="23" className={field} value={form.openHour} onChange={(e) => setForm({ ...form, openHour: e.target.value })} />
      </label>
      <label className="block w-24">
        <span className="mb-1.5 block text-xs font-medium text-muted">Cierre</span>
        <input name="closeHour" type="number" min="1" max="24" className={field} value={form.closeHour} onChange={(e) => setForm({ ...form, closeHour: e.target.value })} />
      </label>
      <label className="block w-40">
        <span className="mb-1.5 block text-xs font-medium text-muted">Clientes/empleado·h</span>
        <input name="serviceRate" type="number" min="1" max="100" step="0.5" className={field} value={form.serviceRate} onChange={(e) => setForm({ ...form, serviceRate: e.target.value })} />
      </label>
      <label className="block w-28">
        <span className="mb-1.5 block text-xs font-medium text-muted">Mínimo en piso</span>
        <input name="minStaff" type="number" min="0" max="50" className={field} value={form.minStaff} onChange={(e) => setForm({ ...form, minStaff: e.target.value })} />
      </label>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
