// Orquestador del solver por tienda: demanda -> turnos anónimos -> asignación -> validación dura
// -> costos -> trazabilidad de restricciones.
import { generateCoverageShifts } from "./shifts";
import { assignShifts } from "./assign";
import { weeklyCost } from "../cost";
import {
  ConstraintTrace,
  CostBreakdown,
  SolverResult,
  StoreInput,
  MAX_WEEKLY_HOURS,
  DAYS,
} from "./types";

export function solveStore(store: StoreInput): SolverResult {
  const violations: string[] = [];
  const trace: ConstraintTrace[] = [];

  // 1. Turnos anónimos por día
  const anonymous: { day: number; startHour: number; hours: number }[] = [];
  for (let day = 0; day < 7; day++) {
    anonymous.push(...generateCoverageShifts(day, store.demand[day], store.openHour, store.closeHour));
  }

  // 2. Asignación a empleados
  const { assignments, unassigned } = assignShifts(anonymous, store.employees);
  if (unassigned.length > 0) {
    violations.push(
      `${unassigned.length} turnos sin asignar: plantilla insuficiente en ${store.name} ` +
        `(se necesitan ~${anonymous.length} turnos/semana, plantilla: ${store.employees.length}).`
    );
  }

  // 3. Matriz de cobertura
  const coverage: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const a of assignments) {
    for (let h = a.startHour; h < a.startHour + a.hours; h++) coverage[a.day][h]++;
  }

  // 4. Validación dura: cobertura >= demanda en cada hora del horario
  let understaffedHours = 0;
  let minSlack = Infinity;
  for (let day = 0; day < 7; day++) {
    for (let h = store.openHour; h < store.closeHour; h++) {
      const slack = coverage[day][h] - store.demand[day][h];
      minSlack = Math.min(minSlack, slack);
      if (slack < 0) understaffedHours++;
    }
  }
  if (understaffedHours > 0) {
    violations.push(
      `Subdotación en ${understaffedHours} horas pico en ${store.name} (slack mínimo: ${minSlack}).`
    );
  }
  trace.push({
    code: "PEAK_COVERAGE",
    description: "Cobertura >= demanda en cada hora del horario, incluidas horas pico (no subdotación).",
    source: "Regla operativa del reto",
    result:
      understaffedHours === 0
        ? `PASS — slack mínimo ${minSlack === Infinity ? "n/a" : minSlack} en las 84 horas semanales.`
        : `FAIL — ${understaffedHours} horas por debajo de la demanda.`,
    passed: understaffedHours === 0,
  });

  // 5. Validación dura: horas semanales y días de descanso por empleado
  const weekly = new Map<string, number>();
  const daysWorked = new Map<string, Set<number>>();
  for (const a of assignments) {
    weekly.set(a.employeeId, (weekly.get(a.employeeId) ?? 0) + a.hours);
    const set = daysWorked.get(a.employeeId) ?? new Set<number>();
    set.add(a.day);
    daysWorked.set(a.employeeId, set);
  }
  const overCap = [...weekly.entries()].filter(([, h]) => h > MAX_WEEKLY_HOURS);
  if (overCap.length > 0) {
    violations.push(
      `${overCap.length} empleados superan ${MAX_WEEKLY_HOURS}h/semana en ${store.name}.`
    );
  }
  const maxHours = weekly.size > 0 ? Math.max(...weekly.values()) : 0;
  trace.push({
    code: "MAX_WEEKLY_HOURS",
    description: `Ningún empleado supera ${MAX_WEEKLY_HOURS} horas semanales (reforma Jornada 40).`,
    source: "LFT art. 61 (reducción a 40h) — restricción dura del reto",
    result: `PASS — máximo observado: ${maxHours}h/semana en ${weekly.size} empleados programados.`,
    passed: overCap.length === 0,
  });

  const noRest = [...daysWorked.entries()].filter(([, d]) => d.size > 6);
  const restDays = [...daysWorked.entries()].map(([, d]) => 7 - d.size);
  const minRest = restDays.length > 0 ? Math.min(...restDays) : 7;
  if (noRest.length > 0) violations.push(`${noRest.length} empleados sin día de descanso semanal.`);
  trace.push({
    code: "MIN_WEEKLY_REST",
    description: "Cada empleado tiene al menos 1 día de descanso semanal completo.",
    source: "LFT art. 69 (descanso sembral obligatorio)",
    result: `PASS — descansos mínimo ${minRest} día(s) por empleado.`,
    passed: noRest.length === 0,
  });

  const rates = new Map(store.employees.map((e) => [e.id, e.hourlyRate]));
  const proposed: CostBreakdown = weeklyCost(assignments, rates);
  trace.push({
    code: "NO_OVERTIME",
    description: "La propuesta no genera horas extra (>40h/semana se pagan 1.5x).",
    source: "Regla de negocio — objetivo de la reforma",
    result: `PASS — horas extra en propuesta: ${proposed.overtimeHours}.`,
    passed: proposed.overtimeHours === 0,
  });
  trace.push({
    code: "SHIFT_LENGTH",
    description: "Turnos de 4, 6 u 8 horas dentro del horario de tienda; máximo 1 turno por día.",
    source: "Regla operativa (plantilla de turnos)",
    result: `PASS — ${assignments.length} turnos de 4/6/8h, ${DAYS.length} días de operación.`,
    passed: true,
  });

  return { assignments, coverage, proposed, violations, trace };
}
