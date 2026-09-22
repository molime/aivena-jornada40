import { db } from "@/lib/db";
import { mxn, pct } from "@/lib/format";
import { Card, CardHeader, PageHeader, Input } from "@/components/ui";
import { buildDemand } from "@/lib/solver/demand";
import { solveStore } from "@/lib/solver";
import { weeklyCost, savingsBreakdown } from "@/lib/cost";
import { loadStoreInput } from "@/server/run-scheduler";
import { StoreSelector } from "@/components/store-selector";

export const metadata = { title: "Escenarios — JORNADA40" };
export const dynamic = "force-dynamic";

// Simulador what-if: recalcula la programación con distinta productividad (service rate)
// o mínimo en piso, SIN guardar nada. El CFO juega con la palanca y ve el impacto al instante.
export default async function EscenariosPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; serviceRate?: string; minStaff?: string }>;
}) {
  const sp = await searchParams;
  const stores = await db.store.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const current = stores.find((s) => s.id === sp.store) ?? stores[0];

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Escenarios" description="Simulación what-if de la programación" />
        <Card className="py-10 text-center text-sm text-muted">No hay tiendas activas.</Card>
      </div>
    );
  }

  const serviceRate = Math.min(100, Math.max(1, Number(sp.serviceRate ?? current.serviceRate)));
  const minStaff = Math.min(50, Math.max(0, Number(sp.minStaff ?? current.minStaff)));

  const store = await db.store.findUnique({
    where: { id: current.id },
    include: { traffic: true, employees: { where: { active: true } } },
  });
  const traffic: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const t of store!.traffic) traffic[t.day][t.hour] = t.traffic;

  const base = await loadStoreInput(current.id);
  const scenario: typeof base = base
    ? {
        ...base,
        demand: buildDemand(traffic, store!.openHour, store!.closeHour, { serviceRate, minStaff }),
      }
    : null;

  const rates = new Map(store!.employees.map((e) => [e.id, e.hourlyRate]));
  const baseline = weeklyCost(
    (await db.baselineShift.findMany({ where: { employeeId: { in: store!.employees.map((e) => e.id) } } })).map((b) => ({
      day: b.day, startHour: b.startHour, hours: b.hours, employeeId: b.employeeId,
    })),
    rates
  );

  const baseResult = base ? solveStore(base) : null;
  const scenResult = scenario ? solveStore(scenario) : null;
  const baseBr = baseResult ? savingsBreakdown(baseline, baseResult.proposed) : null;
  const scenBr = scenResult ? savingsBreakdown(baseline, scenResult.proposed) : null;

  const q = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ store: current.id, serviceRate: String(serviceRate), minStaff: String(minStaff), ...overrides });
    return `/escenarios?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escenarios"
        description="Simula cómo cambia el ahorro si ajustas la productividad o el mínimo en piso. No guarda nada: es exploración."
        actions={<StoreSelector stores={stores.map((s) => ({ id: s.id, name: s.name }))} currentId={current.id} preserve={{ serviceRate: String(serviceRate), minStaff: String(minStaff) }} />}
      />

      <Card>
        <CardHeader title="Palancas del escenario" subtitle="Compara contra la configuración actual de la tienda" />
        <form method="get" className="flex flex-wrap items-end gap-4" suppressHydrationWarning>
          <input type="hidden" name="store" value={current.id} />
          <div className="w-44">
            <Input label="Clientes por empleado·h" name="serviceRate" type="number" min="1" max="100" step="0.5" defaultValue={serviceRate} />
          </div>
          <div className="w-36">
            <Input label="Mínimo en piso" name="minStaff" type="number" min="0" max="50" defaultValue={minStaff} />
          </div>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-brand-strong" suppressHydrationWarning>
            Recalcular
          </button>
          <a href={q({ serviceRate: String(current.serviceRate), minStaff: String(current.minStaff) })} className="text-xs text-muted hover:text-ink">
            Restablecer a la tienda ({current.serviceRate} / {current.minStaff})
          </a>
        </form>
      </Card>

      {baseResult && scenResult && baseBr && scenBr && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Configuración actual" subtitle={`service rate ${current.serviceRate} · mínimo ${current.minStaff}`} />
            <div className="space-y-2 text-sm">
              <Row label="Costo propuesto" value={mxn(baseResult.proposed.totalCost)} />
              <Row label="Ahorro vs. línea base" value={`${mxn(baseBr.total)} (${pct(baseBr.percent)})`} accent="success" />
              <Row label="Horas programadas" value={String(baseResult.proposed.totalHours)} />
              <Row label="Restricciones duras" value={baseResult.violations.length === 0 ? "0 violaciones" : `${baseResult.violations.length} violaciones`} accent={baseResult.violations.length === 0 ? "success" : "danger"} />
            </div>
          </Card>
          <Card className="border-brand/30">
            <CardHeader title="Escenario simulado" subtitle={`service rate ${serviceRate} · mínimo ${minStaff}`} />
            <div className="space-y-2 text-sm">
              <Row label="Costo propuesto" value={mxn(scenResult.proposed.totalCost)} />
              <Row label="Ahorro vs. línea base" value={`${mxn(scenBr.total)} (${pct(scenBr.percent)})`} accent="success" />
              <Row
                label="Δ vs. configuración actual"
                value={`${scenBr.total >= baseBr.total ? "+" : "−"}${mxn(Math.abs(scenBr.total - baseBr.total))}`}
                accent={scenBr.total >= baseBr.total ? "success" : "danger"}
              />
              <Row label="Horas programadas" value={String(scenResult.proposed.totalHours)} />
              <Row label="Restricciones duras" value={scenResult.violations.length === 0 ? "0 violaciones" : `${scenResult.violations.length} violaciones`} accent={scenResult.violations.length === 0 ? "success" : "danger"} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "success" | "danger" }) {
  return (
    <div className="flex items-center justify-between border-b border-overlay/40 py-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className={`tnum font-medium ${accent === "success" ? "text-success" : accent === "danger" ? "text-danger" : "text-ink"}`}>{value}</span>
    </div>
  );
}
