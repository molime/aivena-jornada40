import { describe, it, expect } from "vitest";
import { generateSyntheticData, demandForStore, OPEN_HOUR, CLOSE_HOUR } from "@/lib/seed-data";
import { buildDemand } from "@/lib/solver/demand";
import { generateCoverageShifts } from "@/lib/solver/shifts";
import { assignShifts } from "@/lib/solver/assign";
import { solveStore } from "@/lib/solver";
import { weeklyCost, savingsBreakdown } from "@/lib/cost";
import { MAX_WEEKLY_HOURS } from "@/lib/solver/types";

const stores = generateSyntheticData(3, 15);

function toInput(s: (typeof stores)[number]) {
  return {
    id: s.key,
    name: s.name,
    openHour: OPEN_HOUR,
    closeHour: CLOSE_HOUR,
    demand: demandForStore(s),
    employees: s.employees.map((e, i) => ({
      id: `${s.key}-emp-${i}`,
      name: e.name,
      role: e.role,
      hourlyRate: e.hourlyRate,
    })),
  };
}

describe("generación de turnos (cobertura)", () => {
  it("cubre la demanda en cada hora del horario", () => {
    for (const s of stores) {
      const demand = demandForStore(s);
      for (let day = 0; day < 7; day++) {
        const shifts = generateCoverageShifts(day, demand[day], OPEN_HOUR, CLOSE_HOUR);
        const coverage = new Array<number>(24).fill(0);
        for (const sh of shifts) for (let h = sh.startHour; h < sh.startHour + sh.hours; h++) coverage[h]++;
        for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
          expect(coverage[h]).toBeGreaterThanOrEqual(demand[day][h]);
        }
      }
    }
  });

  it("solo genera turnos de 4, 6 u 8 horas dentro del horario", () => {
    for (const s of stores) {
      const demand = demandForStore(s);
      for (let day = 0; day < 7; day++) {
        for (const sh of generateCoverageShifts(day, demand[day], OPEN_HOUR, CLOSE_HOUR)) {
          expect([4, 6, 8]).toContain(sh.hours);
          expect(sh.startHour).toBeGreaterThanOrEqual(OPEN_HOUR);
          expect(sh.startHour + sh.hours).toBeLessThanOrEqual(CLOSE_HOUR);
        }
      }
    }
  });
});

describe("asignación y restricciones duras", () => {
  it("ningún empleado supera 40h/semana", () => {
    for (const s of stores) {
      const input = toInput(s);
      const result = solveStore(input);
      const weekly = new Map<string, number>();
      for (const a of result.assignments) {
        weekly.set(a.employeeId, (weekly.get(a.employeeId) ?? 0) + a.hours);
      }
      for (const [, h] of weekly) expect(h).toBeLessThanOrEqual(MAX_WEEKLY_HOURS);
    }
  });

  it("cada empleado tiene al menos 1 día de descanso", () => {
    for (const s of stores) {
      const result = solveStore(toInput(s));
      const days = new Map<string, Set<number>>();
      for (const a of result.assignments) {
        const set = days.get(a.employeeId) ?? new Set<number>();
        set.add(a.day);
        days.set(a.employeeId, set);
      }
      for (const [, d] of days) expect(d.size).toBeLessThanOrEqual(6);
    }
  });

  it("no hay subdotación: cobertura >= demanda en toda hora pico", () => {
    for (const s of stores) {
      const input = toInput(s);
      const result = solveStore(input);
      for (let day = 0; day < 7; day++) {
        for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
          expect(result.coverage[day][h]).toBeGreaterThanOrEqual(input.demand[day][h]);
        }
      }
      expect(result.violations).toEqual([]);
    }
  });

  it("asigna todos los turnos cuando la plantilla es suficiente", () => {
    const s = stores[0];
    const input = toInput(s);
    const demand = demandForStore(s);
    const anonymous = [];
    for (let day = 0; day < 7; day++) {
      anonymous.push(...generateCoverageShifts(day, demand[day], OPEN_HOUR, CLOSE_HOUR));
    }
    const { unassigned } = assignShifts(anonymous, input.employees);
    expect(unassigned).toEqual([]);
  });
});

describe("costos y ahorro vs. línea base", () => {
  it("el solver demuestra >= 8% de ahorro en cada tienda (reto)", () => {
    for (const s of stores) {
      const input = toInput(s);
      const result = solveStore(input);

      const rates = new Map(input.employees.map((e) => [e.id, e.hourlyRate]));
      const baselineAssignments = s.employees.flatMap((e, i) =>
        e.baselineShifts.map((b) => ({ ...b, employeeId: `${s.key}-emp-${i}` }))
      );
      const baseline = weeklyCost(baselineAssignments, rates);
      const savings = savingsBreakdown(baseline, result.proposed);

      expect(savings.percent).toBeGreaterThanOrEqual(0.08);
      expect(result.proposed.overtimeHours).toBe(0); // la propuesta no usa horas extra
    }
  });

  it("las componentes del ahorro suman el total", () => {
    for (const s of stores) {
      const input = toInput(s);
      const result = solveStore(input);
      const rates = new Map(input.employees.map((e) => [e.id, e.hourlyRate]));
      const baseline = weeklyCost(
        s.employees.flatMap((e, i) =>
          e.baselineShifts.map((b) => ({ ...b, employeeId: `${s.key}-emp-${i}` }))
        ),
        rates
      );
      const br = savingsBreakdown(baseline, result.proposed);
      expect(br.overtimeAvoided + br.overstaffingAvoided + br.sundaryPremiumDelta).toBeCloseTo(br.total, 6);
    }
  });

  it("la línea base sí contiene horas extra (el problema que la reforma expone)", () => {
    const s = stores[0];
    const rates = new Map(s.employees.map((e, i) => [`${s.key}-emp-${i}`, e.hourlyRate]));
    const baseline = weeklyCost(
      s.employees.flatMap((e, i) =>
        e.baselineShifts.map((b) => ({ ...b, employeeId: `${s.key}-emp-${i}` }))
      ),
      rates
    );
    expect(baseline.overtimeHours).toBeGreaterThan(0);
  });

  it("buildDemand respeta service rate y mínimo operativo", () => {
    const traffic = [Array.from({ length: 24 }, (_, h) => (h >= OPEN_HOUR && h < CLOSE_HOUR ? 200 : 0))];
    const demand = buildDemand(traffic, OPEN_HOUR, CLOSE_HOUR);
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      expect(demand[0][h]).toBe(Math.ceil(200 / 12));
    }
    const idle = buildDemand([Array.from({ length: 24 }, () => 0)], OPEN_HOUR, CLOSE_HOUR);
    expect(idle[0][12]).toBe(2); // mínimo operativo aun sin tráfico
  });
});

describe("trazabilidad", () => {
  it("registra una traza por cada restricción dura, todas en PASS", () => {
    const result = solveStore(toInput(stores[0]));
    const codes = result.trace.map((t) => t.code);
    expect(codes).toContain("MAX_WEEKLY_HOURS");
    expect(codes).toContain("MIN_WEEKLY_REST");
    expect(codes).toContain("PEAK_COVERAGE");
    expect(codes).toContain("NO_OVERTIME");
    expect(result.trace.every((t) => t.passed)).toBe(true);
  });
});
