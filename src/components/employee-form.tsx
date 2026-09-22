"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast";

const ROLES = ["Cajero", "Vendedor", "Almacén", "Supervisor"];

// Alta rápida de empleado (modal ligero inline).
export function EmployeeForm({
  stores,
  onDone,
}: {
  stores: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", role: ROLES[0], hourlyRate: "62", storeId: stores[0]?.id ?? "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hourlyRate: Number(form.hourlyRate) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error");
      toast.success(`Empleado ${form.name} dado de alta`);
      setOpen(false);
      setForm({ name: "", role: ROLES[0], hourlyRate: "62", storeId: stores[0]?.id ?? "" });
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al dar de alta");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        + Alta de empleado
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-48 flex-1">
        <Input label="Nombre completo" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="p.ej. Ana Martín" />
      </div>
      <div className="w-36">
        <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </div>
      <div className="w-28">
        <Input label="Tarifa MXN/h" type="number" min="1" step="0.5" required value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
      </div>
      <div className="min-w-48 flex-1">
        <Select label="Tienda" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
