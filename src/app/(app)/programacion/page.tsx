import Link from "next/link";
import { db } from "@/lib/db";
import { mxn, pct } from "@/lib/format";
import { Card, CardHeader, PageHeader, Badge, StatusBadge } from "@/components/ui";
import { RunSchedulerButton } from "@/components/run-scheduler-button";
import { RunActions } from "@/components/run-actions";

export const metadata = { title: "Programaciones — JORNADA40" };
export const dynamic = "force-dynamic";

export default async function ProgramacionesPage() {
  const stores = await db.store.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 5, // historial reciente por tienda
      },
    },
  });

  const pending = stores.reduce(
    (a, s) => a + s.runs.filter((r) => r.status === "DRAFT" || r.status === "APPROVED").length,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programaciones"
        description={
          pending > 0
            ? `${pending} programación(es) pendientes de aprobación/publicación`
            : "Propuestas semanales de turnos y su ciclo de aprobación"
        }
        actions={<RunSchedulerButton />}
      />

      {stores.every((s) => s.runs.length === 0) && (
        <Card className="py-10 text-center text-sm text-muted">
          Sin programaciones todavía. Genera la primera con el botón «Generar programación».
        </Card>
      )}

      {stores.map((store) =>
        store.runs.length === 0 ? null : (
          <Card key={store.id}>
            <CardHeader
              title={store.name}
              subtitle="Flujo: Borrador → Aprobada → Publicada"
              action={
                <Link href={`/tiendas/${store.id}`} className="text-xs text-muted hover:text-brand">
                  Ver tienda →
                </Link>
              }
            />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-overlay text-left text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">Generada</th>
                  <th className="py-2 pr-4 text-right font-medium">Costo actual</th>
                  <th className="py-2 pr-4 text-right font-medium">Propuesto</th>
                  <th className="py-2 pr-4 text-right font-medium">Ahorro</th>
                  <th className="py-2 pr-4 text-right font-medium">%</th>
                  <th className="py-2 pr-4 text-center font-medium">Estado</th>
                  <th className="py-2 pr-4 text-center font-medium">Cumpl.</th>
                  <th className="py-2 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {store.runs.map((r) => (
                  <tr key={r.id} className="border-b border-overlay/50 hover:bg-elevated/40">
                    <td className="tnum py-2.5 pr-4 text-muted">
                      {r.createdAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}{" "}
                      {r.createdAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="tnum py-2.5 pr-4 text-right">{mxn(r.baselineCost)}</td>
                    <td className="tnum py-2.5 pr-4 text-right">{mxn(r.proposedCost)}</td>
                    <td className="tnum py-2.5 pr-4 text-right text-success">{mxn(r.savings)}</td>
                    <td className="tnum py-2.5 pr-4 text-right">{pct(r.savingsPercent)}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      {r.valid ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Viol.</Badge>}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === "PUBLISHED" ? (
                          <a
                            href={`/api/schedule/export?runId=${r.id}`}
                            className="rounded-lg border border-overlay px-2.5 py-1 text-xs text-muted transition-colors hover:border-[#3a3a42] hover:text-ink"
                          >
                            ⬇ CSV
                          </a>
                        ) : null}
                        <RunActions runId={r.id} status={r.status} valid={r.valid} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}
    </div>
  );
}
