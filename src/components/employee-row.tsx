"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { useToast } from "@/components/toast";

// Fila de empleado con baja/reactivación inline (PATCH a la API).
export function EmployeeRow({
  employee,
}: {
  employee: {
    id: string;
    name: string;
    code: string;
    role: string;
    storeName: string;
    hourlyRate: number;
    active: boolean;
    baselineHours: number;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !employee.active }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error");
      toast.success(employee.active ? `${employee.name} dado de baja` : `${employee.name} reactivado`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={`border-b border-overlay/50 transition-colors hover:bg-elevated/40 ${employee.active ? "" : "opacity-45"}`}>
      <td className="py-2.5 pl-5 pr-4 font-medium">{employee.name}</td>
      <td className="tnum py-2.5 pr-4 text-muted">{employee.code}</td>
      <td className="py-2.5 pr-4 text-muted">{employee.role}</td>
      <td className="py-2.5 pr-4 text-muted">{employee.storeName}</td>
      <td className="tnum py-2.5 pr-4 text-right">{mxnRate(employee.hourlyRate)}</td>
      <td className="tnum py-2.5 pr-4 text-center">{employee.baselineHours}</td>
      <td className="py-2.5 pr-5 text-center">
        {employee.active ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Baja</Badge>}
      </td>
      <td className="py-2.5 pr-5 text-right">
        <button
          onClick={toggle}
          disabled={busy}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
            employee.active
              ? "border-danger/30 text-danger hover:bg-danger-soft"
              : "border-success/30 text-success hover:bg-success-soft"
          }`}
        >
          {employee.active ? "Dar de baja" : "Reactivar"}
        </button>
      </td>
    </tr>
  );
}

function mxnRate(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }) + "/h";
}
