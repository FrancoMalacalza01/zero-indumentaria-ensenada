/**
 * Qué pedidos siguen "activos": los que todavía hay que preparar o entregar.
 *
 * Antes se contaba todo lo que no estuviera "Completado", y entonces un pedido **cancelado** o
 * **devuelto** seguía sumando en el numerito del menú y en el Resumen, como si hubiera algo por hacer.
 */
const CERRADOS = new Set(["Completado", "Cancelado", "Devuelto"]);

/** true si el pedido todavía está en marcha (pendiente, preparando o listo para retirar). */
export function esPedidoActivo(pedido) {
  return Boolean(pedido) && typeof pedido.status === "string" && !CERRADOS.has(pedido.status);
}

export function pedidosActivos(pedidos) {
  return Array.isArray(pedidos) ? pedidos.filter(esPedidoActivo) : [];
}

/**
 * Cuánto se vendió: el total de los pedidos que siguen en pie. Un pedido cancelado o devuelto no es una
 * venta, así que no suma (antes sumaba todo y el número del Resumen quedaba inflado).
 */
export function importeDeVentas(pedidos) {
  if (!Array.isArray(pedidos)) return 0;
  return pedidos
    .filter((p) => p && p.status !== "Cancelado" && p.status !== "Devuelto")
    .reduce((suma, p) => suma + (Number.isFinite(p.total) ? p.total : 0), 0);
}
