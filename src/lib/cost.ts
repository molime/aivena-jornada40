// Motor de costos laborales en MXN.
//   - costo regular: horas x tarifa del rol
//   - horas extra (semanales > 40h): se pagan al 1.5x (total, no solo el excedente)
//   - prima dominical: +25% de la tarifa sobre horas trabajadas el domingo
import { CostBreakdown, ShiftAssignment, MAX_WEEKLY_HOURS } from "./solver/types";

export const OVERTIME_MULTIPLIER = 1.5;
export const SUNDAY_PREMIUM = 0.25;

export function weeklyCost(
  assignments: ShiftAssignment[],
  rates: Map<string, number>
): CostBreakdown {
  const byEmployee = new Map<string, ShiftAssignment[]>();
  for (const a of assignments) {
    const list = byEmployee.get(a.employeeId) ?? [];
    list.push(a);
    byEmployee.set(a.employeeId, list);
  }

  let totalHours = 0;
  let regularCost = 0;
  let overtimeHours = 0;
  let overtimeCost = 0;
  let sundayHours = 0;
  let sundayPremium = 0;

  for (const [empId, shifts] of byEmployee) {
    const rate = rates.get(empId) ?? 0;
    const hours = shifts.reduce((s, x) => s + x.hours, 0);
    const sunday = shifts.filter((x) => x.day === 6).reduce((s, x) => s + x.hours, 0);
    const ot = Math.max(0, hours - MAX_WEEKLY_HOURS);
    const reg = hours - ot;

    totalHours += hours;
    regularCost += reg * rate;
    overtimeHours += ot;
    overtimeCost += ot * rate * OVERTIME_MULTIPLIER;
    sundayHours += sunday;
    sundayPremium += sunday * rate * SUNDAY_PREMIUM;
  }

  return {
    totalHours,
    regularCost,
    overtimeHours,
    overtimeCost,
    sundayHours,
    sundayPremium,
    totalCost: regularCost + overtimeCost + sundayPremium,
  };
}

/** Desglose del ahorro vs. la línea base, en MXN. Las componentes suman el ahorro total. */
export function savingsBreakdown(
  baseline: CostBreakdown,
  proposed: CostBreakdown
): { overtimeAvoided: number; overstaffingAvoided: number; sundaryPremiumDelta: number; total: number; percent: number } {
  const overtimeAvoided = baseline.overtimeCost - proposed.overtimeCost;
  const sundaryPremiumDelta = baseline.sundayPremium - proposed.sundayPremium;
  const total = baseline.totalCost - proposed.totalCost;
  // El remanente una vez descontadas h.extra y prima dominical es el sobrestaffing evitado:
  // horas regulares que la línea base pagaba de más por dotación plana desalineada a la demanda.
  const overstaffingAvoided = total - overtimeAvoided - sundaryPremiumDelta;
  return {
    overtimeAvoided,
    overstaffingAvoided,
    sundaryPremiumDelta,
    total,
    percent: baseline.totalCost > 0 ? total / baseline.totalCost : 0,
  };
}
