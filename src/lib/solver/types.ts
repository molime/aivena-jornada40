// Tipos compartidos del solver de programación semanal (puro, sin I/O ni Prisma).

export interface EmployeeInput {
  id: string;
  name: string;
  role: string;
  hourlyRate: number; // MXN/hora
}

export interface StoreInput {
  id: string;
  name: string;
  openHour: number; // 0-23, hora de apertura
  closeHour: number; // 0-23, hora de cierre (exclusiva)
  /** demand[day][hour] = headcount requerido (0-6 = lun-dom). Longitud 24 por día. */
  demand: number[][];
  employees: EmployeeInput[];
}

export interface AnonymousShift {
  day: number; // 0-6 (lun-dom)
  startHour: number;
  hours: number;
}

export interface ShiftAssignment extends AnonymousShift {
  employeeId: string;
}

export interface ConstraintTrace {
  code: string;
  description: string;
  source: string; // origen de la restricción (ley / regla operativa / regla de negocio)
  result: string; // evidencia cuantificada del cumplimiento
  passed: boolean;
}

export interface CostBreakdown {
  totalHours: number;
  totalCost: number; // MXN
  regularCost: number;
  overtimeHours: number;
  overtimeCost: number;
  sundayHours: number;
  sundayPremium: number;
}

export interface SolverResult {
  assignments: ShiftAssignment[];
  /** coverage[day][hour] = empleados asignados en esa hora. */
  coverage: number[][];
  proposed: CostBreakdown;
  violations: string[]; // debe quedar vacío en una corrida válida
  trace: ConstraintTrace[];
}

export const MAX_WEEKLY_HOURS = 40;
export const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
