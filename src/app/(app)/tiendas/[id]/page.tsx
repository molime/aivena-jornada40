import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { mxn, pct } from "@/lib/format";
import { Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { buildDemand } from "@/lib/solver/demand";
import { weeklyCost } from "@/lib/cost";
import { effectiveRun } from "@/server/run-scheduler";
import { DemandChart } from "@/components/demand-chart";
import { ScheduleGrid } from "@/components/schedule-grid";
import { SavingsTable } from "@/components/savings-table";
import { StoreConfigForm } from "@/components/store-config-form";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await db.store.findUnique({
    where: { id },
    include: {
      employees: { orderBy: { name: "asc" }, include: { baselineShifts: true } },
      traffic: true,
      sales: true,
    },
  });
  if (!store || !store.active) notFound();

  const traffic: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const t of store.traffic) traffic[t.day][t.hour] = t.traffic;
  const demand = buildDemand(traffic, store.openHour, store.closeHour, {
    serviceRate: store.serviceRate || undefined,
    minStaff: store.minStaff || undefined,
  });

  const run = await effectiveRun(id);
  const coverage: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let proposedShifts: { employeeId: string; day: number; startHour: number; hours: number }[] = [];
  if (run) {
    proposedShifts = await db.proposedShift.findMany({ where: { runId: run.id } });
    for (const s of proposedShifts) {
      for (let h = s.startHour; h < s.startHour + s.hours; h++) coverage[s.day][h]++;
    }
  }

  const rates = new Map(store.employees.map((e) => [e.id, e.hourlyRate]));
  const baseline = weeklyCost(
    store.employees.flatMap((e) =>
      e.baselineShifts.map((b) => ({ day: b.day, startHour: b.startHour, hours: b.hours, employeeId: b.employeeId }))
    ),
    rates
  );
  const weeklySales = store.sales.reduce((a, s) => a + s.amount, 0);

  const gridRows = store.employees.map((e) => ({ id: e.id, name: e.name, role: e.role }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={store.name}
        description={`${store.city} · Horario ${store.openHour}:00–${store.closeHour}:00, 7 días · ${store.employees.length} empleados · ventas semanales ~${mxn(weeklySales)}`}
        actions={run ? <StatusBadge status={run.status} /> : undefined}
      />

      {run ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Demanda vs. cobertura"
                subtitle="Cobertura ≥ demanda en cada hora — sin subdotación en picos"
              />
              <DemandChart demand={demand} coverage={coverage} openHour={store.openHour} closeHour={store.closeHour} />
            </Card>
            <Card>
              <CardHeader title="Ahorro semanal" subtitle="vs. programación actual (línea base)" />
              <SavingsTable
                s={{
                  baselineCost: run.baselineCost,
                  proposedCost: run.proposedCost,
                  overtimeAvoided: run.savingsOvertime,
                  overstaffingAvoided: run.savingsOverstaffing,
                  sundaryPremiumDelta: run.savingsSunday,
                  total: run.savings,
                  percent: run.savingsPercent,
                }}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Programación propuesta"
              subtitle={`${mxn(run.proposedCost)}/sem · ahorro ${pct(run.savingsPercent)} · ${run.proposedHours}h programadas`}
              action={
                <a
                  href={`/api/schedule/export?runId=${run.id}`}
                  className="no-print rounded-lg border border-overlay px-2.5 py-1 text-xs text-muted transition-colors hover:border-[#3a3a42] hover:text-ink"
                >
                  ⬇ Exportar CSV
                </a>
              }
            />
            <ScheduleGrid rows={gridRows} shifts={proposedShifts} />
          </Card>
        </>
      ) : (
        <Card className="py-8 text-center text-sm text-muted">
          Sin programación vigente. Genera una desde «Programaciones» o el Panel.
        </Card>
      )}

      <Card>
        <CardHeader
          title="Programación actual (línea base)"
          subtitle={`${mxn(baseline.totalCost)}/sem · ${baseline.overtimeHours}h extra · práctica pre-reforma`}
        />
        <ScheduleGrid rows={gridRows} shifts={store.employees.flatMap((e) => e.baselineShifts)} />
      </Card>

      <Card>
        <CardHeader
          title="Configuración operativa"
          subtitle="Ajusta la demanda requerida por hora y el horario; la próxima programación lo usará"
        />
        <StoreConfigForm
          store={{
            id: store.id,
            openHour: store.openHour,
            closeHour: store.closeHour,
            serviceRate: store.serviceRate,
            minStaff: store.minStaff,
          }}
        />
      </Card>
    </div>
  );
}
