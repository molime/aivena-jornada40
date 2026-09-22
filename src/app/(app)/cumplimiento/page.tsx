import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";

export const metadata = { title: "Cumplimiento — JORNADA40" };
export const dynamic = "force-dynamic";

// Cumplimiento: trazabilidad de restricciones de la corrida vigente por tienda + alertas.
export default async function CumplimientoPage() {
  const stores = await db.store.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const data = await Promise.all(
    stores.map(async (store) => {
      const published = await db.scheduleRun.findFirst({
        where: { storeId: store.id, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      });
      const run =
        published ??
        (await db.scheduleRun.findFirst({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } }));
      if (!run) return null;
      const traces = await db.constraintTrace.findMany({ where: { runId: run.id } });
      return { store, run, traces };
    })
  );
  const valid = data.filter((d): d is NonNullable<typeof d> => d !== null);
  const allPass = valid.every((d) => d.traces.every((t) => t.passed));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cumplimiento"
        description="Trazabilidad de restricciones de la programación vigente y alertas regulatorias."
        actions={
          <Badge tone={allPass && valid.length > 0 ? "success" : valid.length === 0 ? "neutral" : "danger"}>
            {valid.length === 0 ? "Sin corridas" : allPass ? "Todo en orden" : "Requiere atención"}
          </Badge>
        }
      />

      {valid.length === 0 && (
        <Card className="py-10 text-center text-sm text-muted">
          Genera una programación para ver su cumplimiento.
        </Card>
      )}

      <div className="space-y-4">
        {valid.map(({ store, run, traces }) => {
          const failures = traces.filter((t) => !t.passed);
          return (
            <Card key={store.id}>
              <CardHeader
                title={store.name}
                subtitle={`Corrida ${run.status === "PUBLISHED" ? "publicada" : "vigente"} · ${run.createdAt.toLocaleDateString("es-MX")}`}
                action={
                  failures.length === 0 ? (
                    <Badge tone="success">{traces.length} restricciones en PASS</Badge>
                  ) : (
                    <Badge tone="danger">{failures.length} restricción(es) en FAIL</Badge>
                  )
                }
              />
              {failures.length > 0 && (
                <div className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  ⚠ {failures.map((f) => f.code).join(", ")} — revisa la programación antes de publicar.
                </div>
              )}
              <table className="w-full text-sm">
                <tbody>
                  {traces.map((t) => (
                    <tr key={t.id} className="border-b border-overlay/40 last:border-0">
                      <td className="w-40 py-2.5 pr-4 font-mono text-xs text-muted">{t.code}</td>
                      <td className="py-2.5 pr-4">{t.description}</td>
                      <td className="hidden py-2.5 pr-4 text-xs text-muted md:table-cell">{t.source}</td>
                      <td className="hidden py-2.5 pr-4 text-xs text-muted lg:table-cell">{t.result}</td>
                      <td className="py-2.5 text-right">
                        {t.passed ? <Badge tone="success">PASS</Badge> : <Badge tone="danger">FAIL</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
