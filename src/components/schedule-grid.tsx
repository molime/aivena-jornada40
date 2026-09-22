import { DAYS } from "@/lib/solver/types";

interface Row {
  id: string;
  name: string;
  role: string;
}

interface Shift {
  employeeId: string;
  day: number;
  startHour: number;
  hours: number;
}

/** Rejilla semanal: empleados x días, celda = rango del turno. */
export function ScheduleGrid({ rows, shifts }: { rows: Row[]; shifts: Shift[] }) {
  const byEmployee = new Map<string, Shift[]>();
  for (const s of shifts) {
    const list = byEmployee.get(s.employeeId) ?? [];
    list.push(s);
    byEmployee.set(s.employeeId, list);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
            <th className="py-2 pr-4 font-medium">Empleado</th>
            <th className="py-2 pr-4 font-medium">Rol</th>
            {DAYS.map((d) => (
              <th key={d} className="py-2 pr-2 text-center font-medium">
                {d}
              </th>
            ))}
            <th className="py-2 text-center font-medium">Hrs/sem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const list = byEmployee.get(r.id) ?? [];
            const total = list.reduce((a, s) => a + s.hours, 0);
            return (
              <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-1.5 pr-4">{r.name}</td>
                <td className="py-1.5 pr-4 text-neutral-500">{r.role}</td>
                {DAYS.map((_, day) => {
                  const s = list.find((x) => x.day === day);
                  return (
                    <td key={day} className="py-1.5 pr-2 text-center">
                      {s ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                            s.day === 6
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                          }`}
                        >
                          {s.startHour}–{s.startHour + s.hours}
                        </span>
                      ) : (
                        <span className="text-neutral-300 dark:text-neutral-700">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-1.5 text-center font-medium">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
