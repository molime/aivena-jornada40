import Link from "next/link";
import { db } from "@/lib/db";
import { mxn, pct } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";

export const metadata = { title: "Tiendas — JORNADA40" };
export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await db.store.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { employees: { where: { active: true } } } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tiendas" description="Centros de operación con su plantilla y último ahorro generado" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => {
          const run = s.runs[0];
          return (
            <Link key={s.id} href={`/tiendas/${s.id}`} className="block">
              <Card hover className="h-full">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold tracking-tight">{s.name}</h3>
                    <p className="text-xs text-muted">{s.city}</p>
                  </div>
                  <Badge tone="neutral">
                    {s.openHour}:00–{s.closeHour}:00
                  </Badge>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-faint">Plantilla activa</div>
                    <div className="tnum text-xl font-semibold">{s._count.employees}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-faint">Ahorro última corrida</div>
                    <div className={`tnum text-xl font-semibold ${run ? "text-success" : "text-faint"}`}>
                      {run ? mxn(run.savings) : "—"}
                    </div>
                    {run && <div className="text-xs text-muted">{pct(run.savingsPercent)}</div>}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
