/**
 * Las cuentas de los reportes.
 *
 * Vive sin React y sin red para poder probarla: un reporte que suma mal es
 * peor que no tener reporte, porque el dueño toma decisiones con eso.
 *
 * DOS COSAS QUE HAY QUE TENER CLARAS, porque si no los números engañan:
 *
 * 1. **La facturación sale sólo de los pedidos.** La venta del mostrador se
 *    carga para saber el stock, no el precio: no tiene importe. Así que
 *    "unidades vendidas" incluye el mostrador y "facturado" no. Están
 *    separados a propósito en vez de mezclados en un número lindo y falso.
 * 2. **Los días se cuentan en hora argentina.** Una venta de las diez de la
 *    noche es del día de hoy, no de mañana. En UTC caería al día siguiente, y
 *    para un local que cierra a las nueve eso desarmaría todos los días.
 * 3. **Lo que volvió no se vendió.** Las unidades netas descuentan las
 *    devoluciones y las cancelaciones: si entró un pedido y después se
 *    canceló, esa venta no existió. El gráfico por día sí muestra lo bruto,
 *    porque una devolución de hoy no cambia lo que pasó el martes; por eso la
 *    tarjeta aclara cuántas volvieron.
 */

const ZONA = "America/Argentina/Buenos_Aires";

/** El día de una fecha ISO, en hora argentina, como "2026-10-15". */
export function diaLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA da el formato YYYY-MM-DD, que ordena solo.
  return d.toLocaleDateString("en-CA", { timeZone: ZONA });
}

/** De dónde salió la venta: el mostrador usa V-… y la web M-…. */
function origen(movimiento) {
  const id = String(movimiento?.orderId || "");
  if (id.startsWith("V-")) return "mostrador";
  if (id.startsWith("M-")) return "web";
  return "otro";
}

function entero(valor) {
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Los últimos `dias` días, de más viejo a más nuevo, en hora argentina.
 * Incluye los días sin ventas: un hueco en el gráfico también dice algo.
 */
export function ultimosDias(dias, hasta = new Date()) {
  const lista = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const d = new Date(hasta.getTime() - i * 86400_000);
    lista.push(d.toLocaleDateString("en-CA", { timeZone: ZONA }));
  }
  // Dos días iguales no pueden pasar con pasos de 24 h, pero si pasara, el
  // gráfico no tiene que repetir la columna.
  return [...new Set(lista)];
}

/**
 * El reporte del período.
 *
 * @param productos  el catálogo, para precios y stock de hoy
 * @param movimientos el historial completo
 * @param pedidos     los pedidos, para la facturación
 * @param dias        cuántos días hacia atrás, contando hoy
 */
export function reporte(productos, movimientos, pedidos, dias = 30, hasta = new Date()) {
  const cat = Array.isArray(productos) ? productos : [];
  const movs = Array.isArray(movimientos) ? movimientos : [];
  const peds = Array.isArray(pedidos) ? pedidos : [];
  const diasPeriodo = ultimosDias(dias, hasta);
  const desde = diasPeriodo[0];
  const porId = new Map(cat.map((p) => [p.id, p]));

  // ---- ventas (unidades) --------------------------------------------------
  const ventas = movs.filter(
    (m) => m?.reason === "Venta" && entero(m.delta) < 0 && diaLocal(m.date) >= desde,
  );
  // Lo que volvió en el período: devoluciones y cancelaciones dejan el mismo
  // movimiento, y las dos cosas significan que esa venta no fue.
  const vueltas = movs.filter(
    (m) =>
      m?.reason === "Devolución" &&
      entero(m.delta) > 0 &&
      diaLocal(m.date) >= desde,
  );
  const devueltasPorProducto = new Map();
  let devueltas = 0;
  for (const m of vueltas) {
    const cuantas = entero(m.delta);
    devueltas += cuantas;
    devueltasPorProducto.set(
      m.productId,
      (devueltasPorProducto.get(m.productId) || 0) + cuantas,
    );
  }

  const porDia = new Map(diasPeriodo.map((d) => [d, 0]));
  const porProducto = new Map();
  const porTalle = new Map();
  let vendidasBrutas = 0;
  let unidadesWeb = 0;
  let unidadesMostrador = 0;

  for (const m of ventas) {
    const cuantas = Math.abs(entero(m.delta));
    vendidasBrutas += cuantas;
    const dia = diaLocal(m.date);
    if (porDia.has(dia)) porDia.set(dia, porDia.get(dia) + cuantas);
    if (origen(m) === "mostrador") unidadesMostrador += cuantas;
    else if (origen(m) === "web") unidadesWeb += cuantas;

    const clave = m.productId;
    const previo = porProducto.get(clave) || {
      productId: clave,
      nombre: m.productName || porId.get(clave)?.name || "Producto eliminado",
      unidades: 0,
    };
    previo.unidades += cuantas;
    porProducto.set(clave, previo);

    porTalle.set(m.size, (porTalle.get(m.size) || 0) + cuantas);
  }

  // ---- facturación (sólo pedidos) ----------------------------------------
  // Los cancelados y los devueltos no se cuentan: esa plata no entró.
  const pedidosPeriodo = peds.filter(
    (o) =>
      diaLocal(o?.date) >= desde &&
      !["Cancelado", "Devuelto"].includes(o?.status),
  );
  const facturado = pedidosPeriodo.reduce((s, o) => s + entero(o.total), 0);
  const pagados = pedidosPeriodo.filter((o) => o.paymentStatus === "aprobado");
  const cobrado = pagados.reduce((s, o) => s + entero(o.total), 0);

  // ---- lo que se vende y lo que no ---------------------------------------
  const masVendidos = [...porProducto.values()]
    .map((x) => ({
      ...x,
      // Netas: lo que volvió no se vendió.
      unidades: Math.max(
        0,
        x.unidades - (devueltasPorProducto.get(x.productId) || 0),
      ),
      // Valorizado al precio de hoy: el movimiento no guarda el precio de
      // cuando se vendió, así que es una referencia, no la facturación.
      valorHoy:
        Math.max(0, x.unidades - (devueltasPorProducto.get(x.productId) || 0)) *
        entero(porId.get(x.productId)?.price),
      stockHoy: Object.values(porId.get(x.productId)?.stock || {}).reduce(
        (s, n) => s + entero(n),
        0,
      ),
    }))
    .filter((x) => x.unidades > 0)
    .sort((a, b) => b.unidades - a.unidades || a.nombre.localeCompare(b.nombre));

  const talles = [...porTalle.entries()]
    .map(([talle, u]) => ({ talle, unidades: u }))
    .sort((a, b) => b.unidades - a.unidades || a.talle.localeCompare(b.talle));

  // Para "lo que no se movió" cuenta lo bruto: un producto que se vendió y
  // volvió igual se movió, no está dormido en el perchero.
  const vendidos = new Set(porProducto.keys());
  const quietos = cat
    .filter((p) => p.active && !vendidos.has(p.id))
    .map((p) => {
      const stock = Object.values(p.stock || {}).reduce(
        (s, n) => s + entero(n),
        0,
      );
      return { id: p.id, nombre: p.name, stock, valor: stock * entero(p.price) };
    })
    .filter((x) => x.stock > 0)
    .sort((a, b) => b.valor - a.valor);

  // ---- a punto de agotarse -----------------------------------------------
  // Lo que se vendió en el período y tiene poco en el perchero: es donde la
  // próxima compra al proveedor rinde más.
  const porReponer = masVendidos
    .filter((x) => x.unidades > 0 && x.stockHoy <= 5)
    .slice(0, 8);

  return {
    desde,
    dias: diasPeriodo,
    /** Netas: lo vendido menos lo que volvió. Es el número que importa. */
    unidades: Math.max(0, vendidasBrutas - devueltas),
    vendidasBrutas,
    devueltas,
    unidadesWeb,
    unidadesMostrador,
    pedidos: pedidosPeriodo.length,
    facturado,
    cobrado,
    pagados: pagados.length,
    ticket: pedidosPeriodo.length
      ? Math.round(facturado / pedidosPeriodo.length)
      : 0,
    porDia: diasPeriodo.map((d) => ({ dia: d, unidades: porDia.get(d) || 0 })),
    masVendidos,
    talles,
    quietos,
    porReponer,
    /** Cuánta plata hay parada en el perchero, a precio de venta. */
    valorInventario: cat
      .filter((p) => p.active)
      .reduce(
        (s, p) =>
          s +
          Object.values(p.stock || {}).reduce((t, n) => t + entero(n), 0) *
            entero(p.price),
        0,
      ),
  };
}
