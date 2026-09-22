// Conversión de tráfico (clientes/hora) a headcount requerido.
import { StoreInput } from "./types";

export const SERVICE_RATE = 12; // clientes atendidos por empleado·hora
export const MIN_FLOOR_STAFF = 2; // mínimo operativo de empleados en piso

export function requiredHeadcount(
  trafficPerHour: number,
  opts: { serviceRate?: number; minStaff?: number } = {}
): number {
  const serviceRate = opts.serviceRate ?? SERVICE_RATE;
  const minStaff = opts.minStaff ?? MIN_FLOOR_STAFF;
  return Math.max(minStaff, Math.ceil(trafficPerHour / serviceRate));
}

/** Deriva la demanda de headcount por hora a partir del tráfico sintético. */
export function buildDemand(
  traffic: number[][], // [day][hour] clientes/hora
  openHour: number,
  closeHour: number,
  opts: { serviceRate?: number; minStaff?: number } = {}
): number[][] {
  return traffic.map((dayRow) =>
    dayRow.map((t, h) => (h >= openHour && h < closeHour ? requiredHeadcount(t, opts) : 0))
  );
}

/** Headcount máximo requerido dentro del horario (usado para validar factibilidad de plantilla). */
export function peakDemand(store: Pick<StoreInput, "demand">): number {
  return Math.max(...store.demand.flat());
}
