"use client";

// Selector de tienda con auto-submit (lo usan páginas de servidor en Demanda y Escenarios).
export function StoreSelector({
  stores,
  currentId,
  preserve = {},
}: {
  stores: { id: string; name: string }[];
  currentId: string;
  // params adicionales que la página necesita conservar al cambiar de tienda
  preserve?: Record<string, string>;
}) {
  return (
    <form method="get" suppressHydrationWarning>
      {Object.entries(preserve).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="block" suppressHydrationWarning>
        <span className="mb-1.5 block text-xs font-medium text-muted">Tienda</span>
        <select
          name="store"
          defaultValue={currentId}
          onChange={(e) => e.currentTarget.form?.submit()}
          className="w-full rounded-lg border border-overlay bg-elevated px-3 py-2 text-sm text-ink focus:border-brand/60"
          suppressHydrationWarning
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
