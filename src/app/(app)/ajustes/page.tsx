import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { StoreConfigForm } from "@/components/store-config-form";
import { SERVICE_RATE, MIN_FLOOR_STAFF } from "@/lib/solver/demand";

export const metadata = { title: "Ajustes — JORNADA40" };
export const dynamic = "force-dynamic";

// Ajustes: configuración operativa por tienda (service rate, mínimo en piso, horario).
// Estas palancas alimentan el solver en la próxima corrida.
export default async function AjustesPage() {
  const stores = await db.store.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: { where: { active: true } } } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajustes"
        description={`Palancas operativas por tienda. Defaults del sistema: ${SERVICE_RATE} clientes/empleado·h y mínimo ${MIN_FLOOR_STAFF} en piso. Se aplican en la próxima programación.`}
      />

      <div className="space-y-4">
        {stores.map((s) => (
          <Card key={s.id}>
            <CardHeader
              title={s.name}
              subtitle={`${s.city} · ${s._count.employees} empleados activos · ${s.openHour}:00–${s.closeHour}:00`}
            />
            <StoreConfigForm
              store={{
                id: s.id,
                openHour: s.openHour,
                closeHour: s.closeHour,
                serviceRate: s.serviceRate,
                minStaff: s.minStaff,
              }}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
