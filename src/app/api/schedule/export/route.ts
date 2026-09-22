import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/server/api-auth";
import { db } from "@/lib/db";
import { DAYS } from "@/lib/solver/types";

export const dynamic = "force-dynamic";

// GET /api/schedule/export?runId=... -> CSV de la programación propuesta de esa corrida.
// Es lo que un gerente exporta para pegar en Excel / imprimir para el tablero de la tienda.
export async function GET(req: Request) {
  if (!(await getSessionOrNull())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId requerido" }, { status: 400 });

  const run = await db.scheduleRun.findUnique({
    where: { id: runId },
    include: {
      store: true,
      proposedShifts: { include: { employee: true }, orderBy: [{ employee: { name: "asc" } }] },
    },
  });
  if (!run) return NextResponse.json({ error: "Corrida no encontrada" }, { status: 404 });

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(
    [
      "Tienda", "Empleado", "Código", "Rol", "Tarifa MXN/h",
      ...DAYS.map((d) => `${d} (horario)`),
      "Horas/semana",
    ].map(esc).join(",")
  );
  for (const s of run.proposedShifts) {
    const byDay = new Map<number, string>();
    for (const sh of run.proposedShifts.filter((x) => x.employeeId === s.employeeId)) {
      byDay.set(sh.day, `${sh.startHour}:00-${sh.startHour + sh.hours}:00`);
    }
    const hours = [...byDay.values()].length
      ? run.proposedShifts.filter((x) => x.employeeId === s.employeeId).reduce((a, x) => a + x.hours, 0)
      : 0;
    lines.push(
      [
        run.store.name, s.employee.name, s.employee.code, s.employee.role, s.employee.hourlyRate,
        ...DAYS.map((_, d) => byDay.get(d) ?? ""),
        hours,
      ].map((v) => esc(String(v))).join(",")
    );
  }

  const csv = "﻿" + lines.join("\r\n");
  const stamp = run.weekStart.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="programacion-${stamp}-${run.storeId}.csv"`,
    },
  });
}
