import { db } from "@/lib/db";
import { mxn } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/components/employee-form";
import { EmployeeRow } from "@/components/employee-row";

export const metadata = { title: "Personal — JORNADA40" };
export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const [employees, stores] = await Promise.all([
    db.employee.findMany({
      orderBy: [{ storeId: "asc" }, { name: "asc" }],
      include: { store: { select: { name: true } }, baselineShifts: true },
    }),
    db.store.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const active = employees.filter((e) => e.active);
  const inactive = employees.filter((e) => !e.active);
  const weeklyCost = employees
    .filter((e) => e.active)
    .reduce((a, e) => a + e.baselineShifts.reduce((x, s) => x + s.hours, 0) * e.hourlyRate, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal"
        description={`${active.length} empleados activos · costo base semanal ${mxn(weeklyCost)} · altas disponibles para el solver en la próxima corrida`}
        actions={<EmployeeForm stores={stores} />}
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-overlay bg-elevated/40 text-left text-xs text-muted">
              <th className="py-3 pl-5 pr-4 font-medium">Empleado</th>
              <th className="py-3 pr-4 font-medium">Código</th>
              <th className="py-3 pr-4 font-medium">Rol</th>
              <th className="py-3 pr-4 font-medium">Tienda</th>
              <th className="py-3 pr-4 text-right font-medium">Tarifa</th>
              <th className="py-3 pr-4 text-center font-medium">Hrs base/sem</th>
              <th className="py-3 pr-5 text-center font-medium">Estado</th>
              <th className="py-3 pr-5 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <EmployeeRow
                key={e.id}
                employee={{
                  id: e.id,
                  name: e.name,
                  code: e.code,
                  role: e.role,
                  storeName: e.store.name,
                  hourlyRate: e.hourlyRate,
                  active: e.active,
                  baselineHours: e.baselineShifts.reduce((a, s) => a + s.hours, 0),
                }}
              />
            ))}
          </tbody>
        </table>
        {inactive.length > 0 && (
          <p className="border-t border-overlay px-5 py-2.5 text-xs text-faint">
            {inactive.length} empleado(s) de baja — no entran en la programación del solver.
          </p>
        )}
      </Card>
    </div>
  );
}
