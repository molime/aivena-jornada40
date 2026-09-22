"use client";

import { useState } from "react";
import { DAYS } from "@/lib/solver/types";

/** Gráfica SVG: demanda requerida vs. cobertura propuesta, por hora, con selector de día. */
export function DemandChart({
  demand,
  coverage,
  openHour,
  closeHour,
}: {
  demand: number[][]; // [day][hour]
  coverage: number[][]; // [day][hour]
  openHour: number;
  closeHour: number;
}) {
  const [day, setDay] = useState(0);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const max = Math.max(2, ...hours.map((h) => Math.max(demand[day][h], coverage[day][h])));
  const W = 720;
  const H = 180;
  const bw = W / hours.length;

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {DAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            className={`rounded px-2 py-1 text-xs ${
              i === day
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
        {hours.map((h, i) => {
          const dh = demand[day][h];
          const ch = coverage[day][h];
          return (
            <g key={h}>
              <rect
                x={i * bw + 3}
                y={H - (dh / max) * (H - 20)}
                width={bw - 6}
                height={(dh / max) * (H - 20)}
                className="fill-neutral-300 dark:fill-neutral-700"
              />
              <rect
                x={i * bw + 3}
                y={H - (ch / max) * (H - 20)}
                width={bw - 6}
                height={(ch / max) * (H - 20)}
                className={ch >= dh ? "fill-emerald-500/70" : "fill-red-500/70"}
              />
              <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" className="fill-neutral-500 text-[9px]">
                {h}h
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-neutral-300 dark:bg-neutral-700" /> Demanda requerida
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-emerald-500/70" /> Cobertura propuesta
        </span>
      </div>
    </div>
  );
}
