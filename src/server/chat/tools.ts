// Herramientas del asistente conversacional. Cada herramienta lee (o, en un caso, recomputa)
// datos reales de la base de datos — el LLM nunca inventa cifras: las obtiene por tool calls.
import type { PrismaClient } from "@prisma/client";
import { mxn, pct } from "@/lib/format";

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  write?: boolean; // operación que modifica/recomputa estado -> pasa por el gate (Jev)
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_savings_summary",
    description:
      "Resumen agregado de la última corrida del programador: costo actual vs. propuesto, ahorro total en MXN y porcentaje, y desglose (horas extra evitadas, sobrestaffing, prima dominical). Usar para preguntas globales de ahorro.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_stores",
    description:
      "Lista las tiendas con su plantilla y, si existe corrida, el ahorro de la última propuesta por tienda.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_store_report",
    description: "Reporte de ahorro y validez de UNA tienda (buscar por nombre o ciudad).",
    parameters: {
      type: "object",
      properties: { store: { type: "string", description: "Nombre o ciudad de la tienda" } },
      required: ["store"],
    },
  },
  {
    name: "get_constraint_traces",
    description:
      "Trazabilidad de restricciones de la última corrida (40h/semana, descanso semanal, cobertura de picos, sin horas extra): fuente legal/regla y evidencia de cumplimiento. Opcionalmente filtrar por tienda.",
    parameters: {
      type: "object",
      properties: { store: { type: "string", description: "Opcional: nombre de la tienda" } },
    },
  },
  {
    name: "run_scheduler",
    description:
      "RECOMPUTA la programación semanal para todas las tiendas (operación costosa que reemplaza las corridas vigentes). Requiere confirmación explícita del usuario: args.confirm debe ser true.",
    parameters: {
      type: "object",
      properties: {
        confirm: { type: "boolean", description: "Debe ser true, dado por el usuario" },
      },
      required: ["confirm"],
    },
    write: true,
  },
];

export interface ToolContext {
  db: PrismaClient;
  runScheduler: () => Promise<
    { storeName: string; valid: boolean; savings: number; savingsPercent: number; violations: string[] }[]
  >;
}

function latestRunsByStore(db: PrismaClient) {
  return db.scheduleRun.findMany({
    include: { store: { select: { name: true } }, traces: true },
  });
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case "get_savings_summary": {
      const [runs, employees] = await Promise.all([latestRunsByStore(ctx.db), ctx.db.employee.count()]);
      if (runs.length === 0) return "Aún no hay corridas. Usa run_scheduler para generar la propuesta.";
      const base = runs.reduce((a, r) => a + r.baselineCost, 0);
      const prop = runs.reduce((a, r) => a + r.proposedCost, 0);
      const ot = runs.reduce((a, r) => a + r.savingsOvertime, 0);
      const os = runs.reduce((a, r) => a + r.savingsOverstaffing, 0);
      const su = runs.reduce((a, r) => a + r.savingsSunday, 0);
      const total = base - prop;
      return [
        `Resumen de la última corrida (${runs.length} tiendas, ${employees} empleados):`,
        `- Costo laboral actual (línea base): ${mxn(base)}/semana`,
        `- Costo propuesto (tope 40h, sin horas extra): ${mxn(prop)}/semana`,
        `- Ahorro semanal: ${mxn(total)} (${pct(base > 0 ? total / base : 0)})`,
        `- Desglose: horas extra evitadas ${mxn(ot)}, sobrestaffing evitado ${mxn(os)}, prima dominical ${mxn(su)}`,
        `- Restricciones duras: ${runs.every((r) => r.valid) ? "0 violaciones (todas las tiendas válidas)" : "HAY VIOLACIONES"}`,
      ].join("\n");
    }
    case "list_stores": {
      const [stores, runs] = await Promise.all([
        ctx.db.store.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } }),
        latestRunsByStore(ctx.db),
      ]);
      const byStore = new Map(runs.map((r) => [r.storeId, r]));
      return stores
        .map((s) => {
          const r = byStore.get(s.id);
          return r
            ? `- ${s.name}: ${s._count.employees} empleados · ahorro ${mxn(r.savings)}/sem (${pct(r.savingsPercent)}) · ${r.valid ? "válida" : "con violaciones"}`
            : `- ${s.name}: ${s._count.employees} empleados · sin corrida aún`;
        })
        .join("\n");
    }
    case "get_store_report": {
      const q = String(args.store ?? "").toLowerCase();
      const runs = await latestRunsByStore(ctx.db);
      const run = runs.find((r) => r.store.name.toLowerCase().includes(q));
      if (!run) return `No encontré una tienda que coincida con "${args.store}". Tiendas disponibles: ${runs.map((r) => r.store.name).join(", ") || "ninguna con corrida"}.`;
      return [
        `Reporte de ${run.store.name} (última corrida):`,
        `- Costo actual: ${mxn(run.baselineCost)}/sem · propuesto: ${mxn(run.proposedCost)}/sem`,
        `- Ahorro: ${mxn(run.savings)}/sem (${pct(run.savingsPercent)})`,
        `- Desglose: h.extra ${mxn(run.savingsOvertime)}, sobrestaffing ${mxn(run.savingsOverstaffing)}, prima dominical ${mxn(run.savingsSunday)}`,
        `- Restricciones duras: ${run.valid ? "0 violaciones" : `VIOLACIONES: ${run.traces.filter((t) => !t.passed).map((t) => t.code).join(", ") || "revisar"}`}`,
      ].join("\n");
    }
    case "get_constraint_traces": {
      const runs = await latestRunsByStore(ctx.db);
      const q = args.store ? String(args.store).toLowerCase() : null;
      const filtered = q ? runs.filter((r) => r.store.name.toLowerCase().includes(q)) : runs;
      if (filtered.length === 0) return "No hay corridas (o no coincide la tienda indicada).";
      return filtered
        .map((r) =>
          [
            `${r.store.name}:`,
            ...r.traces.map(
              (t) => `- [${t.passed ? "PASS" : "FAIL"}] ${t.code}: ${t.description} — Fuente: ${t.source}. Evidencia: ${t.result}`
            ),
          ].join("\n")
        )
        .join("\n\n");
    }
    case "run_scheduler": {
      const summaries = await ctx.runScheduler();
      const total = summaries.reduce((a, s) => a + s.savings, 0);
      return [
        `Corrida completada para ${summaries.length} tiendas.`,
        ...summaries.map(
          (s) => `- ${s.storeName}: ahorro ${mxn(s.savings)}/sem (${pct(s.savingsPercent)}) · ${s.valid ? "válida, 0 violaciones" : `VIOLACIONES: ${s.violations.join("; ")}`}`
        ),
        `Ahorro total: ${mxn(total)}/semana.`,
      ].join("\n");
    }
    default:
      return `Herramienta desconocida: ${name}`;
  }
}
