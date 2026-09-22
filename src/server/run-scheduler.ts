// Orquestación del solver + flujo de vida de las programaciones.
//   DRAFT (propuesta generada por el solver) -> APPROVED (aprobada por gerencia)
//   -> PUBLISHED (publicada al equipo; es la que "manda").
// Se conserva historial completo de corridas por tienda.
import { db } from "@/lib/db";
import { solveStore } from "@/lib/solver";
import { buildDemand } from "@/lib/solver/demand";
import { weeklyCost, savingsBreakdown } from "@/lib/cost";
import { StoreInput } from "@/lib/solver/types";

export async function loadStoreInput(storeId: string): Promise<StoreInput | null> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    include: { employees: { where: { active: true } }, traffic: true },
  });
  if (!store) return null;

  const traffic: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const t of store.traffic) traffic[t.day][t.hour] = t.traffic;

  return {
    id: store.id,
    name: store.name,
    openHour: store.openHour,
    closeHour: store.closeHour,
    // config operativa por tienda (ajustable en Ajustes); default = constantes del solver
    demand: buildDemand(traffic, store.openHour, store.closeHour, {
      serviceRate: store.serviceRate || undefined,
      minStaff: store.minStaff || undefined,
    }),
    employees: store.employees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      hourlyRate: e.hourlyRate,
    })),
  };
}

export interface RunSummary {
  runId: string;
  storeId: string;
  storeName: string;
  status: string;
  valid: boolean;
  violations: string[];
  baselineCost: number;
  proposedCost: number;
  savings: number;
  savingsPercent: number;
  breakdown: ReturnType<typeof savingsBreakdown>;
}

/** Ejecuta el solver para todas las tiendas y crea una corrida DRAFT por tienda (historial). */
export async function runSchedulerForAllStores(): Promise<RunSummary[]> {
  const stores = await db.store.findMany({ where: { active: true }, select: { id: true, name: true } });
  const summaries: RunSummary[] = [];

  for (const { id, name } of stores) {
    const input = await loadStoreInput(id);
    if (!input) continue;

    const employees = await db.employee.findMany({ where: { storeId: id } });
    const empIds = employees.map((e) => e.id);
    const baselineRows = await db.baselineShift.findMany({ where: { employeeId: { in: empIds } } });
    const rates = new Map(employees.map((e) => [e.id, e.hourlyRate]));
    const baseline = weeklyCost(
      baselineRows.map((b) => ({ day: b.day, startHour: b.startHour, hours: b.hours, employeeId: b.employeeId })),
      rates
    );

    const result = solveStore(input);
    const br = savingsBreakdown(baseline, result.proposed);
    const run = await db.scheduleRun.create({
      data: {
        storeId: id,
        status: "DRAFT",
        baselineCost: baseline.totalCost,
        baselineHours: baseline.totalHours,
        baselineOvertimeCost: baseline.overtimeCost,
        proposedCost: result.proposed.totalCost,
        proposedHours: result.proposed.totalHours,
        savings: br.total,
        savingsPercent: br.percent,
        savingsOvertime: br.overtimeAvoided,
        savingsOverstaffing: br.overstaffingAvoided,
        savingsSunday: br.sundaryPremiumDelta,
        valid: result.violations.length === 0,
        proposedShifts: {
          create: result.assignments.map((a) => ({
            employeeId: a.employeeId,
            day: a.day,
            startHour: a.startHour,
            hours: a.hours,
          })),
        },
        traces: {
          create: result.trace.map((t) => ({
            code: t.code,
            description: t.description,
            source: t.source,
            result: t.result,
            passed: t.passed,
          })),
        },
      },
    });

    summaries.push({
      runId: run.id,
      storeId: id,
      storeName: name,
      status: "DRAFT",
      valid: result.violations.length === 0,
      violations: result.violations,
      baselineCost: baseline.totalCost,
      proposedCost: result.proposed.totalCost,
      savings: br.total,
      savingsPercent: br.percent,
      breakdown: br,
    });
  }

  return summaries;
}

/** La corrida "vigente" de una tienda: la última PUBLICADA; si no, la más reciente. */
export async function effectiveRun(storeId: string) {
  const published = await db.scheduleRun.findFirst({
    where: { storeId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  if (published) return published;
  return db.scheduleRun.findFirst({ where: { storeId }, orderBy: { createdAt: "desc" } });
}

/** Aprueba una corrida DRAFT. */
export async function approveRun(runId: string) {
  const run = await db.scheduleRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Corrida no encontrada");
  if (run.status !== "DRAFT") throw new Error(`No se puede aprobar una corrida en estado ${run.status}`);
  return db.scheduleRun.update({
    where: { id: runId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
}

/** Publica una corrida aprobada y despublica las demás de la misma tienda. */
export async function publishRun(runId: string) {
  const run = await db.scheduleRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Corrida no encontrada");
  if (run.status !== "APPROVED") throw new Error("La corrida debe estar APROBADA antes de publicarse");
  await db.scheduleRun.updateMany({
    where: { storeId: run.storeId, status: "PUBLISHED" },
    data: { status: "ARCHIVED" },
  });
  return db.scheduleRun.update({
    where: { id: runId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
}
