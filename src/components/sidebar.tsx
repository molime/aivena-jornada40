"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegación lateral del producto. Grupos: Operación, Análisis, Administración.
const GROUPS: {
  label: string;
  items: { href: string; label: string; icon: string }[];
}[] = [
  {
    label: "Operación",
    items: [
      { href: "/dashboard", label: "Panel", icon: "▦" },
      { href: "/programacion", label: "Programaciones", icon: "◷" },
      { href: "/tiendas", label: "Tiendas", icon: "⌂" },
      { href: "/personal", label: "Personal", icon: "☰" },
      { href: "/demanda", label: "Demanda", icon: "∿" },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/escenarios", label: "Escenarios", icon: "◇" },
      { href: "/cumplimiento", label: "Cumplimiento", icon: "✓" },
    ],
  },
  {
    label: "Administración",
    items: [{ href: "/ajustes", label: "Ajustes", icon: "⚙" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-overlay bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-overlay px-4">
        <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden />
        <span className="text-sm font-bold tracking-tight">
          JORNADA<span className="text-brand">40</span>
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-5">
            <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-faint">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-brand-soft font-medium text-brand"
                          : "text-muted hover:bg-elevated hover:text-ink"
                      }`}
                    >
                      <span className="w-4 text-center text-xs opacity-80" aria-hidden>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-overlay px-4 py-3 text-[10px] leading-relaxed text-faint">
        AIvena · Workforce optimization
        <br />
        Datos 100% sintéticos (demo)
      </div>
    </aside>
  );
}
