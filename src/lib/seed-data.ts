// Generador de datos sintéticos deterministas para "Tienda Aurora" (retailer ficticio).
// Ningún dato proviene de retailers reales; solo se replica el PATRÓN operativo público y
// general de una tienda departamental mexicana (picos mediodía/tarde, sábado alto).
import { requiredHeadcount } from "./solver/demand";

export const SEED = 4242;
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 21;

export const ROLES = [
  { key: "supervisor", label: "Supervisor", rate: 95 },
  { key: "vendedor", label: "Vendedor", rate: 70 },
  { key: "cajero", label: "Cajero", rate: 62 },
  { key: "almacen", label: "Almacén", rate: 58 },
] as const;

export interface SyntheticStore {
  key: string;
  name: string;
  city: string;
  openHour: number;
  closeHour: number;
  employees: SyntheticEmployee[];
  traffic: number[][]; // [day][hour] clientes/hora (24 columnas)
  sales: number[]; // [day] ventas diarias MXN (promedio por día de la semana)
}

export interface SyntheticEmployee {
  code: string;
  name: string;
  role: string;
  hourlyRate: number;
  baselineShifts: { day: number; startHour: number; hours: number }[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Perfil horario base (clientes/hora a las 9..20h) — curva típica de tienda departamental. */
const HOURLY_CURVE = [10, 14, 22, 34, 46, 42, 30, 36, 52, 64, 58, 42];
/** Multiplicador por día: lun..dom (sábado alto, domingo medio). */
const DAY_MULT = [0.85, 0.9, 0.95, 1.0, 1.1, 1.35, 1.1];

const CITIES = ["CDMX Centro", "Guadalajara Norte", "Monterrey Sur", "Puebla Angelópolis", "Mérida Altabrisa", "Querétaro Juriquilla", "Toluca Metepec", "León Campestre", "Tijuana Río", "Cancún Malecón"];
const FIRST = ["María", "José", "Ana", "Luis", "Carmen", "Miguel", "Rosa", "Fernando", "Lucía", "Javier", "Paola", "Diego", "Sofía", "Raúl", "Elena", "Hugo", "Diana", "Pablo", "Karla", "Andrés"];
const LAST = ["Hernández", "García", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Cruz", "Gómez", "Flores", "Morales", "Vázquez", "Reyes", "Díaz", "Torres", "Castro"];

function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/**
 * Genera las tiendas sintéticas.
 * @param storeCount cuántas tiendas (demo: 3; escala completa del reto: 50)
 * @param employeesPerStore plantilla por tienda (demo: 15; escala del reto: 80)
 */
export function generateSyntheticData(storeCount = 3, employeesPerStore = 15): SyntheticStore[] {
  const rnd = mulberry32(SEED);
  const stores: SyntheticStore[] = [];

  for (let s = 0; s < storeCount; s++) {
    // Cada tienda tiene escala propia; la curva de demanda escala con la plantilla
    // (una tienda de 80 FTE mueve ~80/15 más tráfico que una de 15).
    const storeFactor = (0.9 + rnd() * 0.3) * (employeesPerStore / 15);

    // Tráfico [day][hour]
    const traffic: number[][] = [];
    for (let day = 0; day < 7; day++) {
      const row = new Array<number>(24).fill(0);
      for (let i = 0; i < HOURLY_CURVE.length; i++) {
        const jitter = 0.9 + rnd() * 0.2;
        row[OPEN_HOUR + i] = Math.round(HOURLY_CURVE[i] * DAY_MULT[day] * storeFactor * jitter);
      }
      traffic.push(row);
    }

    // Ventas diarias promedio (MXN): tráfico diario x ticket medio x conversión
    const AVG_TICKET = 380;
    const CONVERSION = 0.55;
    const sales = traffic.map((row) => Math.round(row.reduce((a, b) => a + b, 0) * AVG_TICKET * CONVERSION));

    // Plantilla por rol (el último rol absorbe el redondeo)
    const base = Math.floor(employeesPerStore / 8);
    const counts: Record<string, number> = {
      supervisor: Math.max(1, Math.round(base * 0.5)),
      vendedor: base * 3,
      cajero: base * 2,
      almacen: 0,
    };
    const assigned = Object.values(counts).reduce((a, b) => a + b, 0);
    counts.almacen = employeesPerStore - assigned;

    const usedNames = new Set<string>();
    const employees: SyntheticEmployee[] = [];
    let empIdx = 0;
    for (const role of ROLES) {
      for (let i = 0; i < counts[role.key]; i++) {
        let name = pick(rnd, FIRST) + " " + pick(rnd, LAST);
        while (usedNames.has(name)) name = pick(rnd, FIRST) + " " + pick(rnd, LAST);
        usedNames.add(name);

        // Programación ACTUAL (línea base): turnos planos desalineados a la demanda.
        //  ~70%: 5 días x 8h en bloques fijos (sin OT pero sobre-dotando valles)
        //  ~30%: además refuerzo de sábado o turnos más largos -> 44-48h/semana (horas extra)
        const hasOvertime = rnd() < 0.3;
        const lateBlock = rnd() < 0.5;
        const workDays = hasOvertime
          ? [0, 1, 2, 3, 4, 5] // 6 días
          : [0, 1, 2, 3, 5]; // 5 días con sábado (descanso jueves+domingo, práctica pre-reforma)
        const start = lateBlock ? 12 : 9;
        const hours = 8;
        const baselineShifts = workDays.map((day) => {
          // El sábado ~30% se "colan" 4h extra: turno largo de 12h DENTRO del horario (9–21)
          const isLongSaturday = hasOvertime && day === 5;
          return {
            day,
            startHour: isLongSaturday ? 9 : start,
            hours: isLongSaturday ? 12 : hours,
          };
        });

        employees.push({
          code: `EMP-${String(s + 1).padStart(2, "0")}${String(empIdx + 1).padStart(3, "0")}`,
          name,
          role: role.label,
          hourlyRate: role.rate,
          baselineShifts,
        });
        empIdx++;
      }
    }

    stores.push({
      key: `store-${s + 1}`,
      name: `Tienda Aurora — ${CITIES[s % CITIES.length]}`,
      city: CITIES[s % CITIES.length],
      openHour: OPEN_HOUR,
      closeHour: CLOSE_HOUR,
      employees,
      traffic,
      sales,
    });
  }

  return stores;
}

/** Demanda de headcount requerida por tienda (matriz [day][hour]). */
export function demandForStore(store: SyntheticStore): number[][] {
  return store.traffic.map((row) => row.map((t) => (t > 0 ? requiredHeadcount(t) : 0)));
}
