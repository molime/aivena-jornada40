export const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
