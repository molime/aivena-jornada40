// Verificación sin base de datos: corre el solver sobre el dataset sintético completo
// e imprime el ahorro por tienda. Evidencia reproducible del cumplimiento del reto (>= 8%).
// Uso: npx tsx scripts/verify.ts  (opcional: STORE_COUNT=50 EMPLOYEES_PER_STORE=80)
import { generateSyntheticData, demandForStore, OPEN_HOUR, CLOSE_HOUR } from "../src/lib/seed-data";
import { solveStore } from "../src/lib/solver";
import { weeklyCost, savingsBreakdown } from "../src/lib/cost";

const STORE_COUNT = Number(process.env.STORE_COUNT ?? 3);
const EMPLOYEES_PER_STORE = Number(process.env.EMPLOYEES_PER_STORE ?? 15);

const stores = generateSyntheticData(STORE_COUNT, EMPLOYEES_PER_STORE);
const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

let totalBase = 0;
let totalProp = 0;
let allValid = true;

console.log(`\nJORNADA40 — verificación del solver (${STORE_COUNT} tiendas x ${EMPLOYEES_PER_STORE} empleados)\n`);

for (const s of stores) {
  const input = {
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
  const result = solveStore(input);
  const rates = new Map(input.employees.map((e) => [e.id, e.hourlyRate]));
  const baseline = weeklyCost(
    s.employees.flatMap((e, i) =>
      e.baselineShifts.map((b) => ({ ...b, employeeId: `${s.key}-emp-${i}` }))
    ),
    rates
  );
  const br = savingsBreakdown(baseline, result.proposed);
  totalBase += baseline.totalCost;
  totalProp += result.proposed.totalCost;
  if (result.violations.length > 0) allValid = false;

  console.log(
    `${result.violations.length === 0 ? "✔" : "✖"} ${s.name.padEnd(38)} ` +
      `base ${fmt(baseline.totalCost)} → propuesta ${fmt(result.proposed.totalCost)}  ` +
      `ahorro ${fmt(br.total)} (${(br.percent * 100).toFixed(1)}%)  ` +
      `[h.extra ${fmt(br.overtimeAvoided)} | sobrestaff ${fmt(br.overstaffingAvoided)}]`
  );
  for (const v of result.violations) console.log(`    ⚠ ${v}`);
}

const pct = ((totalBase - totalProp) / totalBase) * 100;
console.log(
  `\nTOTAL: ${fmt(totalBase)} → ${fmt(totalProp)}  ahorro ${fmt(totalBase - totalProp)} (${pct.toFixed(1)}%)`
);
console.log(`Restricciones duras: ${allValid ? "TODAS EN PASS" : "HAY VIOLACIONES"}`);
console.log(`Criterio del reto (>= 8%): ${pct >= 8 ? "CUMPLE ✔" : "NO CUMPLE ✖"}\n`);
process.exit(pct >= 8 && allValid ? 0 : 1);
