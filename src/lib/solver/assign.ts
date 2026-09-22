// Asignación de turnos anónimos a empleados respetando restricciones duras:
//   - máximo MAX_WEEKLY_HOURS horas semanales por empleado
//   - máximo 1 turno por empleado por día
// Criterio de optimización: turnos más largos primero; empleado elegido = el de menor carga
// semanal actual y, en empate, menor tarifa (reduce costo).
import { AnonymousShift, EmployeeInput, ShiftAssignment, MAX_WEEKLY_HOURS } from "./types";

export interface AssignmentOutcome {
  assignments: ShiftAssignment[];
  unassigned: AnonymousShift[]; // turnos que no se pudieron asignar (factibilidad insuficiente)
}

export function assignShifts(
  shifts: AnonymousShift[],
  employees: EmployeeInput[]
): AssignmentOutcome {
  const weeklyHours = new Map<string, number>(employees.map((e) => [e.id, 0]));
  const daysWorked = new Map<string, Set<number>>(employees.map((e) => [e.id, new Set()]));

  const ordered = [...shifts].sort(
    (a, b) => b.hours - a.hours || a.day - b.day || a.startHour - b.startHour
  );

  const assignments: ShiftAssignment[] = [];
  const unassigned: AnonymousShift[] = [];

  for (const s of ordered) {
    const candidates = employees
      .filter(
        (e) =>
          !daysWorked.get(e.id)!.has(s.day) &&
          weeklyHours.get(e.id)! + s.hours <= MAX_WEEKLY_HOURS
      )
      .sort(
        (a, b) =>
          weeklyHours.get(a.id)! - weeklyHours.get(b.id)! || a.hourlyRate - b.hourlyRate
      );

    const chosen = candidates[0];
    if (!chosen) {
      unassigned.push(s);
      continue;
    }
    weeklyHours.set(chosen.id, weeklyHours.get(chosen.id)! + s.hours);
    daysWorked.get(chosen.id)!.add(s.day);
    assignments.push({ ...s, employeeId: chosen.id });
  }

  return { assignments, unassigned };
}
