import { mxn, pct } from "@/lib/format";

export interface SavingsRows {
  baselineCost: number;
  proposedCost: number;
  overtimeAvoided: number;
  overstaffingAvoided: number;
  sundaryPremiumDelta: number;
  total: number;
  percent: number;
}

/** Tabla de ahorro desglosado en MXN: horas extra evitadas + sobrestaffing evitado + prima dominical. */
export function SavingsTable({ s }: { s: SavingsRows }) {
  const rows = [
    { label: "Horas extra evitadas (>40h, pagadas 1.5x)", value: s.overtimeAvoided },
    { label: "Sobrestaffing evitado (dotación alineada a demanda)", value: s.overstaffingAvoided },
    { label: "Diferencia de prima dominical", value: s.sundaryPremiumDelta },
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr className="border-b border-neutral-200 dark:border-neutral-800">
          <td className="py-2 text-neutral-500">Costo laboral actual (línea base)</td>
          <td className="py-2 text-right font-medium">{mxn(s.baselineCost)}</td>
        </tr>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-neutral-100 dark:border-neutral-900">
            <td className="py-2 pl-4 text-neutral-600 dark:text-neutral-400">{r.label}</td>
            <td className="py-2 text-right text-emerald-700 dark:text-emerald-400">
              −{mxn(r.value)}
            </td>
          </tr>
        ))}
        <tr className="border-b border-neutral-200 dark:border-neutral-800">
          <td className="py-2 text-neutral-500">Costo laboral propuesto</td>
          <td className="py-2 text-right font-medium">{mxn(s.proposedCost)}</td>
        </tr>
        <tr>
          <td className="py-2 font-semibold">Ahorro semanal</td>
          <td className="py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">
            {mxn(s.total)} ({pct(s.percent)})
          </td>
        </tr>
      </tbody>
    </table>
  );
}
