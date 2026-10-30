/**
 * Traduce entre lo que usa la tienda y lo que guarda el servidor.
 *
 * Es el otro lado de `catalogMap.mjs`: ahí se lee, acá se escribe. Vive sin
 * React y sin red a propósito, porque armar mal una fila es la forma más
 * callada de perder datos, y así se puede probar sin navegador.
 */

const CATEGORIAS = ["Hombre", "Accesorios"];
const MOTIVOS = ["Ingreso", "Venta", "Ajuste", "Rotura", "Devolución"];
const ENTREGAS = ["pickup", "shipping"];
const ESTADOS = [
  "Pendiente",
  "Preparando",
  "Listo para retirar",
  "Completado",
  "Devuelto",
  "Cancelado",
];
const ESTADOS_PAGO = [
  "sin_pago",
  "pendiente",
  "aprobado",
  "rechazado",
  "devuelto",
];

function entero(valor, porDefecto = 0) {
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) ? n : porDefecto;
}

function texto(valor, porDefecto = "") {
  return typeof valor === "string" ? valor : porDefecto;
}

function lista(valor) {
  return Array.isArray(valor)
    ? valor.filter((x) => typeof x === "string" && x)
    : [];
}

/**
 * Un producto de la tienda, como fila de `products`.
 *
 * `position` entra aparte porque el orden lo decide la lista, no el producto.
 * El stock NO va acá: vive en su propia tabla, con `stockRows`.
 */
export function productToRow(product, position = 0) {
  if (!product || typeof product.id !== "string" || !product.id)
    throw new Error("El producto no tiene id");
  const category = CATEGORIAS.includes(product.category)
    ? product.category
    : "Hombre";
  return {
    id: product.id,
    name: texto(product.name).trim(),
    brand: texto(product.brand).trim(),
    source_catalog_id: texto(product.sourceCatalogId) || null,
    category,
    // La base exige un tipo; la tienda a veces lo deja en blanco.
    type: texto(product.type).trim() || "Prenda",
    price: Math.max(0, entero(product.price)),
    // null y no `undefined`: así el servidor lo borra cuando se saca el
    // precio viejo, en vez de dejar el anterior.
    old_price: product.oldPrice ? Math.max(0, entero(product.oldPrice)) : null,
    image: texto(product.image),
    images: lista(product.images),
    color: texto(product.color),
    color_hex: texto(product.colorHex) || "#132457",
    sizes: lista(product.sizes),
    is_new: Boolean(product.isNew),
    active: product.active !== false,
    description: texto(product.description),
    position: entero(position),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Las filas de `stock` de un producto: una por talle.
 *
 * Solo los talles que el producto tiene hoy. Los que se sacaron no aparecen,
 * y por eso hay que borrarlos aparte (`sizesFilter`).
 */
export function stockRows(product) {
  const guardado = product?.stock && typeof product.stock === "object"
    ? product.stock
    : {};
  return lista(product?.sizes).map((size) => ({
    product_id: product.id,
    size,
    qty: Math.max(0, entero(guardado[size])),
  }));
}

/**
 * El filtro de PostgREST para borrar los talles que ya no existen.
 *
 * Devuelve `null` cuando el producto no tiene ningún talle: ahí no hay nada
 * que conservar y el que llama tiene que borrar todo el stock del producto.
 */
export function sizesFilter(product) {
  const sizes = lista(product?.sizes);
  if (!sizes.length) return null;
  // PostgREST separa por comas, así que un talle con coma rompería el filtro.
  // Las comillas dobles lo dejan pasar entero.
  return `(${sizes.map((s) => `"${s.replace(/"/g, '""')}"`).join(",")})`;
}

/** Un movimiento de stock, como fila de `movements`. */
export function movementToRow(movement) {
  if (!movement || typeof movement.id !== "string" || !movement.id)
    throw new Error("El movimiento no tiene id");
  if (!MOTIVOS.includes(movement.reason))
    throw new Error(`Motivo desconocido: ${movement.reason}`);
  return {
    id: movement.id,
    fecha: movement.date || new Date().toISOString(),
    product_id: texto(movement.productId),
    product_name: texto(movement.productName),
    size: texto(movement.size),
    delta: entero(movement.delta),
    reason: movement.reason,
    order_id: movement.orderId || null,
  };
}

/** Una fila de `movements`, como movimiento de la tienda. */
export function rowToMovement(row) {
  return {
    id: texto(row?.id),
    date: texto(row?.fecha),
    productId: texto(row?.product_id),
    productName: texto(row?.product_name),
    size: texto(row?.size),
    delta: entero(row?.delta),
    reason: MOTIVOS.includes(row?.reason) ? row.reason : "Ajuste",
    ...(row?.order_id ? { orderId: row.order_id } : {}),
  };
}

/** Un pedido, como fila de `orders`. */
export function orderToRow(order) {
  if (!order || typeof order.id !== "string" || !order.id)
    throw new Error("El pedido no tiene id");
  return {
    id: order.id,
    fecha: order.date || new Date().toISOString(),
    customer: texto(order.customer),
    items: Array.isArray(order.items) ? order.items : [],
    total: Math.max(0, entero(order.total)),
    delivery: ENTREGAS.includes(order.delivery) ? order.delivery : "pickup",
    envio: Math.max(0, entero(order.envio)),
    zone: order.zone || null,
    payment: order.payment || null,
    status: ESTADOS.includes(order.status) ? order.status : "Pendiente",
    // El estado del cobro y el mail los escribe el servidor, no el panel.
    // Sólo se mandan si el pedido que tenemos los trae: si no, un guardado
    // del panel pisaría un pago aprobado con un "sin_pago".
    ...(ESTADOS_PAGO.includes(order.paymentStatus)
      ? { payment_status: order.paymentStatus }
      : {}),
  };
}

/** Una fila de `orders`, como pedido de la tienda. */
export function rowToOrder(row) {
  return {
    id: texto(row?.id),
    date: texto(row?.fecha),
    items: Array.isArray(row?.items) ? row.items : [],
    total: Math.max(0, entero(row?.total)),
    delivery: ENTREGAS.includes(row?.delivery) ? row.delivery : "pickup",
    status: ESTADOS.includes(row?.status) ? row.status : "Pendiente",
    customer: texto(row?.customer),
    ...(row?.payment ? { payment: row.payment } : {}),
    ...(row?.zone ? { zone: row.zone } : {}),
    ...(row?.envio ? { envio: Math.max(0, entero(row.envio)) } : {}),
    ...(ESTADOS_PAGO.includes(row?.payment_status)
      ? { paymentStatus: row.payment_status }
      : {}),
    ...(row?.pago_ref ? { pagoRef: texto(row.pago_ref) } : {}),
    ...(row?.email ? { email: texto(row.email) } : {}),
    ...(row?.mail_enviado_at
      ? { mailEnviadoAt: texto(row.mail_enviado_at) }
      : {}),
  };
}
