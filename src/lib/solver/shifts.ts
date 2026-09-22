// Generación de turnos anónimos (sin empleado asignado) para cubrir la demanda horaria.
// Estrategia: cubrir por niveles — para el nivel de déficit máximo actual, ubicar la mejor
// ventana de 8/6/4 horas donde TODA la ventana tenga déficit >= nivel. Garantiza que la
// cobertura final sea >= demanda en cada hora, con sobre-cobertura mínima.
import { AnonymousShift } from "./types";

const SHIFT_LENGTHS = [8, 6, 4];

export function generateCoverageShifts(
  day: number,
  demandRow: number[],
  openHour: number,
  closeHour: number
): AnonymousShift[] {
  const coverage = new Array<number>(24).fill(0);
  const shifts: AnonymousShift[] = [];
  let guard = 0;

  for (;;) {
    let maxDeficit = 0;
    for (let h = openHour; h < closeHour; h++) {
      maxDeficit = Math.max(maxDeficit, demandRow[h] - coverage[h]);
    }
    if (maxDeficit <= 0 || guard++ > 10000) break;

    let placed = false;
    for (const L of SHIFT_LENGTHS) {
      let bestStart = -1;
      let bestScore = -1;
      for (let s = openHour; s + L <= closeHour; s++) {
        let ok = true;
        let score = 0;
        for (let h = s; h < s + L; h++) {
          const d = demandRow[h] - coverage[h];
          if (d < maxDeficit) {
            ok = false;
            break;
          }
          score += d;
        }
        if (ok && score > bestScore) {
          bestScore = score;
          bestStart = s;
        }
      }
      if (bestStart >= 0) {
        for (let h = bestStart; h < bestStart + L; h++) coverage[h]++;
        shifts.push({ day, startHour: bestStart, hours: L });
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Relajación: pico aislado más alto que su entorno. Cubrir la hora de mayor déficit con
      // la ventana (que la contenga) de mayor déficit total acumulado; admite leve sobre-cobertura.
      let peakHour = openHour;
      for (let h = openHour; h < closeHour; h++) {
        if (demandRow[h] - coverage[h] > demandRow[peakHour] - coverage[peakHour]) peakHour = h;
      }
      let bestStart = -1;
      let bestLen = 0;
      let bestScore = -1;
      for (const L of SHIFT_LENGTHS) {
        const lo = Math.max(openHour, peakHour - L + 1);
        const hi = Math.min(peakHour, closeHour - L);
        for (let s = lo; s <= hi; s++) {
          let score = 0;
          for (let h = s; h < s + L; h++) score += Math.max(0, demandRow[h] - coverage[h]);
          if (score > bestScore) {
            bestScore = score;
            bestStart = s;
            bestLen = L;
          }
        }
      }
      if (bestStart < 0) break; // demanda imposible de cubrir en el horario; lo reporta el validador
      for (let h = bestStart; h < bestStart + bestLen; h++) coverage[h]++;
      shifts.push({ day, startHour: bestStart, hours: bestLen });
    }
  }

  return shifts;
}
