/**
 * Convierte una demo guardada con la forma vieja a la actual.
 *
 * Cuando había dos locales, el stock se guardaba por sucursal:
 * `{"La Plata": {M: 3}, "Ensenada": {M: 6}}`. Al unificar pasó a ser
 * `{M: 9}`. Un navegador que abrió el sitio antes del cambio sigue teniendo
 * la forma vieja, y sumarla como si fueran números da texto
 * ("0[object Object]") en vez de un total.
 */
export function flattenStock(stock) {
  if (!stock || typeof stock !== "object" || Array.isArray(stock)) return {};
  const entries = Object.entries(stock);
  const porSucursal = entries.some(
    ([, value]) => value && typeof value === "object",
  );
  if (!porSucursal)
    return Object.fromEntries(
      entries.map(([size, n]) => [size, Math.max(0, Math.trunc(Number(n)) || 0)]),
    );
  const total = {};
  for (const [, sizes] of entries) {
    if (!sizes || typeof sizes !== "object") continue;
    for (const [size, n] of Object.entries(sizes))
      total[size] = (total[size] || 0) + (Math.trunc(Number(n)) || 0);
  }
  // Sumar dos sucursales nunca puede dar negativo.
  return Object.fromEntries(
    Object.entries(total).map(([size, n]) => [size, Math.max(0, n)]),
  );
}

/** true si algún producto todavía guarda el stock por sucursal. */
export function needsStockMigration(products) {
  return (
    Array.isArray(products) &&
    products.some(
      (p) =>
        p?.stock &&
        typeof p.stock === "object" &&
        Object.values(p.stock).some((v) => v && typeof v === "object"),
    )
  );
}
