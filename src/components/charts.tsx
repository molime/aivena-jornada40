"use client";

// Kit de gráficas SVG del design system Aivena (sin dependencias).
// AreaChart y Donut con tooltip hover; Barras con valor encima.
// format: token serializable ("number" | "currency" | "percent") — no se pueden pasar
// funciones de Server a Client Components.
import { useId, useMemo, useState } from "react";

const INK = "#8a857c";
const GRID = "#26262b";

type FormatToken = "number" | "currency" | "percent";
const fmt = (v: number, token: FormatToken = "number") => {
  if (token === "currency")
    return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  if (token === "percent") return `${(v * 100).toFixed(1)}%`;
  return v.toLocaleString("es-MX");
};

/* ---------- Area/line chart ---------- */
export function AreaChart({
  series,
  height = 180,
  format = "number",
  color = "#f5a623",
}: {
  series: { label: string; value: number }[];
  height?: number;
  format?: FormatToken;
  color?: string;
}) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const padX = 8;
  const padTop = 14;
  const padBottom = 22;
  const max = Math.max(1, ...series.map((s) => s.value));
  const stepX = series.length > 1 ? (W - padX * 2) / (series.length - 1) : 0;

  const pts = useMemo(
    () =>
      series.map((s, i) => ({
        x: padX + i * stepX,
        y: padTop + (1 - s.value / max) * (H - padTop - padBottom),
        ...s,
      })),
    [series, stepX, max, H]
  );

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pts[pts.length - 1]?.x ?? padX).toFixed(1)},${H - padBottom} L${padX},${H - padBottom} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round((x - padX) / stepX);
          setHover(Math.max(0, Math.min(series.length - 1, idx)));
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padTop + f * (H - padTop - padBottom)}
            y2={padTop + f * (H - padTop - padBottom)}
            stroke={GRID}
            strokeDasharray="3 4"
          />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {hover !== null && pts[hover] && (
          <g>
            <line x1={pts[hover].x} x2={pts[hover].x} y1={padTop} y2={H - padBottom} stroke={INK} strokeDasharray="2 3" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="4" fill={color} stroke="#0a0a0c" strokeWidth="2" />
          </g>
        )}
        {pts.map((p, i) =>
          i % Math.ceil(pts.length / 8) === 0 ? (
            <text key={i} x={p.x} y={H - 6} textAnchor="middle" className="fill-faint" fontSize="9">
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      {hover !== null && pts[hover] && (
        <div
          className="pointer-events-none absolute rounded-md border border-overlay bg-elevated px-2 py-1 text-xs shadow-lg"
          style={{
            left: `${(pts[hover].x / W) * 100}%`,
            top: 0,
            transform: `translateX(${pts[hover].x > W * 0.75 ? "-110%" : "10px"})`,
          }}
        >
          <div className="text-faint">{pts[hover].label}</div>
          <div className="tnum font-semibold text-ink">{fmt(pts[hover].value, format)}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Barras verticales ---------- */
export function Bars({
  data,
  height = 160,
  format = "number",
  color = "#f5a623",
  secondary,
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: FormatToken;
  color?: string;
  // serie opcional de comparación (p.ej. línea base) en gris
  secondary?: { label: string; value: number }[];
}) {
  const W = 720;
  const H = height;
  const padBottom = 22;
  const max = Math.max(1, ...data.map((d) => d.value), ...(secondary?.map((s) => s.value) ?? []));
  const bw = (W - 16) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {data.map((d, i) => {
        const h = (d.value / max) * (H - padBottom - 16);
        return (
          <g key={i}>
            <rect
              x={i * bw + 6 + (bw - 14) / 2}
              y={H - padBottom - h}
              width={Math.max(4, bw - 14)}
              height={h}
              rx="2"
              fill={color}
              opacity="0.9"
            >
              <title>{`${d.label}: ${fmt(d.value, format)}`}</title>
            </rect>
            <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-faint" fontSize="9">
              {d.label}
            </text>
          </g>
        );
      })}
      {secondary && (
        <polyline
          fill="none"
          stroke={INK}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          points={secondary
            .map((s, i) => {
              const x = i * bw + bw / 2;
              const y = H - padBottom - (s.value / max) * (H - padBottom - 16);
              return `${x},${y}`;
            })
            .join(" ")}
        />
      )}
    </svg>
  );
}

/* ---------- Dona de composición ---------- */
export function Donut({
  segments,
  size = 150,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  // Rotación acumulada por segmento, calculada sin mutación (pure dentro del render).
  const rotations: number[] = [];
  let acc = 0;
  for (const s of segments) {
    rotations.push((acc / total) * 360 - 90);
    acc += Math.max(0, s.value);
  }
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={GRID} strokeWidth="14" />
        {segments.map((s, i) => {
          const frac = Math.max(0, s.value) / total;
          const dash = frac * 2 * Math.PI * r;
          const gap = 2 * Math.PI * r - dash;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="butt"
              transform={`rotate(${rotations[i]} ${cx} ${cy})`}
            >
              <title>{`${s.label}: ${s.value.toLocaleString("es-MX")}`}</title>
            </circle>
          );
        })}
        {centerValue && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" className="fill-ink tnum" fontSize="16" fontWeight="600">
              {centerValue}
            </text>
            {centerLabel && (
              <text x={cx} y={cy + 14} textAnchor="middle" className="fill-faint" fontSize="8">
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="tnum ml-auto font-medium text-ink">
              {((Math.max(0, s.value) / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
