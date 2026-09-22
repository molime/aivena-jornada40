import { db } from "@/lib/db";
import { mxn } from "@/lib/format";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { buildDemand } from "@/lib/solver/demand";
import { DAYS } from "@/lib/solver/types";
import { StoreSelector } from "@/components/store-selector";

export const metadata = { title: "Demanda — JORNADA40" };
export const dynamic = "force-dynamic";

// Mapa de calor de tráfico por tienda × día × hora + demanda derivada.
export default async function DemandaPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeId } = await searchParams;
  const stores = await db.store.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const current = stores.find((s) => s.id === storeId) ?? stores[0];

  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Demanda" description="Tráfico de clientes y demanda de personal por hora" />
        <Card className="py-10 text-center text-sm text-muted">No hay tiendas activas.</Card>
      </div>
    );
  }

  const [trafficRows, sales] = await Promise.all([
    db.trafficHour.findMany({ where: { storeId: current.id } }),
    db.historicalSale.findMany({ where: { storeId: current.id } }),
  ]);
  const traffic: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const t of trafficRows) traffic[t.day][t.hour] = t.traffic;
  const demand = buildDemand(traffic, current.openHour, current.closeHour, {
    serviceRate: current.serviceRate || undefined,
    minStaff: current.minStaff || undefined,
  });
  const maxTraffic = Math.max(1, ...traffic.flat());
  const hours = Array.from({ length: current.closeHour - current.openHour }, (_, i) => current.openHour + i);
  const peak = (() => {
    let best = { day: 0, hour: current.openHour, v: 0 };
    for (let d = 0; d < 7; d++)
      for (const h of hours)
        if (traffic[d][h] > best.v) best = { day: d, hour: h, v: traffic[d][h] };
    return best;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demanda"
        description="Tráfico de clientes por hora y la dotación que requiere. Es el input del programador."
        actions={<StoreSelector stores={stores.map((s) => ({ id: s.id, name: s.name }))} currentId={current.id} />}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-faint">Pico semanal</div>
          <div className="tnum mt-1 text-lg font-semibold">
            {DAYS[peak.day]} {peak.hour}:00
          </div>
          <div className="text-xs text-muted">{peak.v} clientes/hora</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-faint">Clientes por empleado·h</div>
          <div className="tnum mt-1 text-lg font-semibold">{current.serviceRate}</div>
          <div className="text-xs text-muted">service rate de la tienda</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-faint">Mínimo en piso</div>
          <div className="tnum mt-1 text-lg font-semibold">{current.minStaff}</div>
          <div className="text-xs text-muted">cobertura operativa base</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Tráfico de clientes — ${current.name}`}
          subtitle="Clientes por hora (más intenso = más ámbar). Ajusta la escala en la configuración de la tienda."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="pb-2 pr-2 text-left font-medium text-muted">Día</th>
                {hours.map((h) => (
                  <th key={h} className="pb-2 pr-1 text-center font-medium text-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, d) => (
                <tr key={day}>
                  <td className="py-1 pr-2 font-medium text-muted">{day}</td>
                  {hours.map((h) => {
                    const t = traffic[d][h];
                    const alpha = t / maxTraffic;
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className="tnum flex h-7 items-center justify-center rounded"
                          style={{
                            background: `rgba(245,166,35,${(alpha * 0.85 + 0.04).toFixed(2)})`,
                            color: alpha > 0.5 ? "#0a0a0c" : "#8a857c",
                          }}
                          title={`${day} ${h}:00 — ${t} clientes/hora (demanda ${demand[d][h]})`}
                        >
                          {t}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Ventas históricas por día" subtitle="Referencia de la semana tipo (MXN)" />
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, d) => {
            const amount = sales.find((s) => s.day === d)?.amount ?? 0;
            const maxSale = Math.max(1, ...sales.map((s) => s.amount));
            return (
              <div key={day} className="text-center">
                <div className="tnum mb-1 text-xs text-muted">{mxn(amount)}</div>
                <div
                  className="mx-auto w-full rounded-t"
                  style={{
                    height: `${Math.max(6, (amount / maxSale) * 90)}px`,
                    background: "linear-gradient(180deg, #f5a623cc, #f5a62333)",
                  }}
                />
                <div className="mt-1 text-[11px] font-medium text-faint">{day}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
