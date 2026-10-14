/**
 * Convierte lo que devuelve el servidor en los productos que usa la tienda.
 *
 * Vive aparte y sin React a propósito: es la frontera entre la base y la app,
 * y es donde se rompen las cosas cuando alguien agrega una columna o deja un
 * campo en null. Acá se puede probar sin navegador ni red.
 */

const CATEGORIAS = ["Hombre", "Mujer", "Accesorios"];

function entero(valor, porDefecto = 0) {
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) ? n : porDefecto;
}

function lista(valor) {
  return Array.isArray(valor) ? valor.filter((x) => typeof x === "string" && x) : [];
}

/**
 * @param productRows filas de `products`, ya ordenadas por `position`
 * @param stockRows   filas de `stock`
 * @returns los productos listos para la tienda; descarta los que no sirven
 */
export function rowsToProducts(productRows, stockRows) {
  if (!Array.isArray(productRows)) return [];
  // El stock llega suelto: se agrupa por producto antes de armar nada.
  const porProducto = new Map();
  for (const fila of Array.isArray(stockRows) ? stockRows : []) {
    const id = fila?.product_id;
    const size = fila?.size;
    if (typeof id !== "string" || typeof size !== "string" || !size) continue;
    if (!porProducto.has(id)) porProducto.set(id, {});
    porProducto.get(id)[size] = Math.max(0, entero(fila.qty));
  }

  const productos = [];
  for (const fila of productRows) {
    const id = fila?.id;
    const name = fila?.name;
    // Sin id o sin nombre no hay producto que mostrar.
    if (typeof id !== "string" || !id || typeof name !== "string" || !name)
      continue;
    const sizes = lista(fila.sizes);
    if (!sizes.length) continue;
    const stockGuardado = porProducto.get(id) || {};
    productos.push({
      id,
      name,
      category: CATEGORIAS.includes(fila.category) ? fila.category : "Hombre",
      type: typeof fila.type === "string" && fila.type ? fila.type : "Prenda",
      price: Math.max(0, entero(fila.price)),
      ...(fila.old_price ? { oldPrice: Math.max(0, entero(fila.old_price)) } : {}),
      image: typeof fila.image === "string" ? fila.image : "",
      ...(lista(fila.images).length ? { images: lista(fila.images) } : {}),
      color: typeof fila.color === "string" ? fila.color : "",
      colorHex: typeof fila.color_hex === "string" ? fila.color_hex : "#132457",
      sizes,
      // Un talle sin fila de stock es un talle sin unidades, no un talle roto.
      stock: Object.fromEntries(sizes.map((s) => [s, stockGuardado[s] || 0])),
      isNew: Boolean(fila.is_new),
      active: fila.active !== false,
      description: typeof fila.description === "string" ? fila.description : "",
    });
  }
  return productos;
}
