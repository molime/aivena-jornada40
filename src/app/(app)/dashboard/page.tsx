import Link from "next/link";
import { db } from "@/lib/db";
import { mxn, pct } from "@/lib/format";
import { Card, CardHeader, PageHeader, Stat, Badge, StatusBadge } from "@/components/ui";
import { Bars, Donut } from "@/components/charts";
import { RunSchedulerButton } from "@/components/run-scheduler-button";

export const metadata = { title: "Panel — JORNADA40" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stores, employees, salesAgg] = await Promise.all([
    db.store.findMany({ where: { active: true }, select: { id: true, name: true } }),
    db.employee.count({ where: { active: true } }),
    db.historicalSale.aggregate({ _sum: { amount: true } }),
  ]);

  // Corrida vigente por tienda (publicada si existe, si no la más reciente)
  const runs = await Promise.all(
    stores.map(async (s) => {
      const published = await db.scheduleRun.findFirst({
        where: { storeId: s.id, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      });
      const latest =
        published ??
        (await db.scheduleRun.findFirst({ where: { storeId: s.id }, orderBy: { createdAt: "desc" } }));
      return latest ? { ...latest, storeName: s.name } : null;
    })
  );
  const validRuns = runs.filter((r): r is NonNullable<typeof r> => r !== null);
  const hasRuns = validRuns.length > 0;

  const base = validRuns.reduce((a, r) => a + r.baselineCost, 0);
  const prop = validRuns.reduce((a, r) => a + r.proposedCost, 0);
  const savings = base - prop;
  const savingsPct = base > 0 ? savings / base : 0;
  const allValid = hasRuns && validRuns.every((r) => r.valid);
  const weeklySales = salesAgg._sum.amount ?? 0;
  const laborPct = weeklySales > 0 ? prop / weeklySales : 0;

  // Serie semanal de costo: usamos las corridas vigentes como "semana actual" y
  // la línea base como referencia constante para la comparación visual.
  const costSeries = [
    { label: "Actual", value: base },
    { label: "Propuesto", value: prop },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel"
        description={`${stores.length} tiendas · ${employees} empleados activos · ventas semanales ~${mxn(weeklySales)}`}
        actions={<RunSchedulerButton />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Costo actual / semana" value={hasRuns ? mxn(base) : "—"} hint="línea base programación actual" />
        <Stat label="Costo propuesto / semana" value={hasRuns ? mxn(prop) : "—"} hint="tope 40h, sin horas extra" />
        <Stat label="Ahorro semanal" value={hasRuns ? mxn(savings) : "—"} hint={hasRuns ? pct(savingsPct) + " del costo laboral" : "genera la programación"} tone="brand" />
        <Stat
          label="Cumplimiento"
          value={hasRuns ? (allValid ? "0 violaciones" : "Revisar") : "—"}
          hint="40h/sem · descanso · cobertura"
          tone={allValid ? "success" : undefined}
        />
      </div>

      {hasRuns ? (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="Costo laboral semanal" subtitle="Actual vs. propuesto (MXN)" />
              <Bars
                data={costSeries.map((c) => ({ label: c.label, value: c.value }))}
                format="currency"
                color="#f5a623"
              />
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Origen del ahorro" subtitle="Composición del ahorro semanal" />
              <Donut
                segments={[
                  { label: "Horas extra evitadas", value: validRuns.reduce((a, r) => a + r.savingsOvertime, 0), color: "#f5a623" },
                  { label: "Sobrestaffing evitado", value: validRuns.reduce((a, r) => a + r.savingsOverstaffing, 0), color: "#7dd3fc" },
                  { label: "Prima dominical", value: Math.max(0, validRuns.reduce((a, r) => a + r.savingsSunday, 0)), color: "#8a857c" },
                ]}
                centerValue={pct(savingsPct)}
                centerLabel="ahorro"
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Resultado por tienda"
              subtitle="Corrida vigente (publicada o más reciente)"
              action={
                <span className="text-xs text-muted">
                  Costo laboral = <span className="tnum">{pct(laborPct)}</span> de las ventas
                </span>
              }
            />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-overlay text-left text-xs text-muted">
                  <th className="py-2.5 pr-4 font-medium">Tienda</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Costo actual</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Costo propuesto</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Ahorro</th>
                  <th className="py-2.5 pr-4 text-right font-medium">% ahorro</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Estado</th>
                  <th className="py-2.5 text-center font-medium">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {validRuns.map((r) => (
                  <tr key={r.id} className="border-b border-overlay/50 transition-colors hover:bg-elevated/40">
                    <td className="py-3 pr-4">
                      <Link href={`/tiendas/${r.storeId}`} className="font-medium text-ink hover:text-brand">
                        {r.storeName}
                      </Link>
                    </td>
                    <td className="tnum py-3 pr-4 text-right">{mxn(r.baselineCost)}</td>
                    <td className="tnum py-3 pr-4 text-right">{mxn(r.proposedCost)}</td>
                    <td className="tnum py-3 pr-4 text-right text-success">{mxn(r.savings)}</td>
                    <td className="tnum py-3 pr-4 text-right">{pct(r.savingsPercent)}</td>
                    <td className="py-3 pr-4 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 text-center">
                      {r.valid ? (
                        <Badge tone="success">0 violaciones</Badge>
                      ) : (
                        <Badge tone="danger">Violaciones</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted">
            Aún no hay programaciones generadas. Pulsa <strong className="text-ink">«Generar programación»</strong>{" "}
            para crear la propuesta de turnos de esta semana.
          </p>
          <p className="text-xs text-faint">
            El solver respeta el tope de 40h/semana, garantiza cobertura en horas pico y cuantifica el ahorro vs. tu programación actual.
          </p>
        </Card>
      )}
    </div>
  );
}
