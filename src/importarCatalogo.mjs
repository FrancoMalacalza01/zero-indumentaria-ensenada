/**
 * Prepara una ficha importada para su edición en el panel. La fuente sólo
 * describe las prendas de la marca: nunca es evidencia de stock del local.
 * El identificador conserva el origen para que la misma ficha no se importe dos
 * veces. Esta función no guarda datos ni publica productos.
 */
export function prepararFichaImportada(prenda, ajuste = {}) {
  if (!prenda || typeof prenda.id !== "string" || !prenda.id.trim()) {
    throw new Error("La ficha importada no tiene identificador.");
  }
  const imagenes = Array.isArray(prenda.images)
    ? prenda.images.filter((imagen) => typeof imagen === "string" && imagen.trim())
    : [];
  const talles = Array.isArray(prenda.sizes)
    ? [...new Set(prenda.sizes.filter((talle) => typeof talle === "string" && talle.trim()).map((talle) => talle.trim().toUpperCase()))]
    : [];
  const colores = Array.isArray(prenda.colors)
    ? prenda.colors.filter((color) => typeof color === "string" && color.trim())
    : [];
  const precio = Number.isInteger(ajuste.price) && ajuste.price > 0 ? ajuste.price : prenda.priceARS;
  const anterior = Number.isInteger(ajuste.old) && ajuste.old > precio ? ajuste.old : undefined;
  return {
    id: `importado-${prenda.id}`,
    sourceCatalogId: prenda.id,
    name: typeof prenda.name === "string" ? prenda.name : "",
    brand: typeof prenda.brand === "string" ? prenda.brand : "",
    category: "Hombre",
    type: typeof prenda.category === "string" ? prenda.category : "",
    price: precio,
    ...(anterior ? { oldPrice: anterior } : {}),
    image: prenda.cover || imagenes[0] || "",
    images: imagenes,
    color: colores.join(", "),
    colorHex: "#132457",
    sizes: talles,
    stock: Object.fromEntries(talles.map((talle) => [talle, 0])),
    isNew: false,
    active: ajuste.active !== false,
    description: "",
  };
}

/** La ficha administrada reemplaza a la importada con el mismo origen. */
export function unirCatalogo(importados, productos, ajustes, ocultos) {
  if (!Array.isArray(ocultos)) return [];
  const escondidos = new Set(ocultos);
  const porOrigen = new Map(productos.filter((p) => p.sourceCatalogId).map((p) => [p.sourceCatalogId, p]));
  const fichas = importados.flatMap((original) => {
    if (escondidos.has(original.id)) return [];
    const p = porOrigen.get(original.id);
    if (p) {
      if (!p.active || p.category !== "Hombre") return [];
      const fotos = [p.image, ...(p.images || [])].filter(Boolean);
      return [{ ...original, name: p.name, brand: p.brand || original.brand, category: p.type,
        priceARS: p.price, precioZero: true, precioAnterior: p.oldPrice,
        colors: p.color ? p.color.split(",").map((c) => c.trim()).filter(Boolean) : [], sizes: p.sizes.filter((t) => (p.stock[t] || 0) > 0),
        cover: p.image, images: [...new Set(fotos)], shopId: p.id }];
    }
    const ajuste = ajustes[original.id];
    if (ajuste?.active === false) return [];
    return [{ ...original, sizes: [], priceARS: ajuste?.price ?? original.priceARS,
      precioZero: ajuste?.price != null, precioAnterior: ajuste?.old }];
  });
  const propios = [];
  for (const p of productos) {
    if (p.sourceCatalogId || !p.active || p.category !== "Hombre") continue;
    const fotos = [...new Set([p.image, ...(p.images || [])].filter(Boolean))];
    propios.push({ id: `tienda-${p.id}`, name: p.name, brand: p.brand || "Zero", category: p.type,
      priceARS: p.price, precioZero: true, precioAnterior: p.oldPrice, shopId: p.id,
      colors: p.color ? p.color.split(",").map((c) => c.trim()).filter(Boolean) : [],
      sizes: p.sizes.filter((t) => (p.stock[t] || 0) > 0), cover: p.image, images: fotos });
  }
  return [...propios, ...fichas];
}

/**
 * Qué fichas importadas están ocultas, para decidir qué mostrar.
 *
 * Si el servidor contestó (`respuesta` es una lista, aunque esté vacía), manda eso. Si no
 * contestó (`null`: sin red, caído, error), se usa lo último que se supo (`guardados`), y si
 * tampoco hay nada, se muestra el catálogo entero. La alternativa, no mostrar nada, dejaba la
 * tienda vacía ante cualquier falla de una consulta que sólo sirve para esconder unas pocas fichas.
 */
export function ocultosParaMostrar(respuesta, guardados) {
  if (Array.isArray(respuesta)) return respuesta.filter((id) => typeof id === "string");
  if (Array.isArray(guardados)) return guardados.filter((id) => typeof id === "string");
  return [];
}

/** Tope de unidades por talle que se puede poner de una vez: evita un cero de más al tipear. */
export const TOPE_UNIDADES_POR_TALLE = 999;

/**
 * Las fichas importadas que se pueden habilitar para la compra online de una vez, cada una
 * con `unidades` por cada talle que tiene.
 *
 * El stock lo decide el local: esta función no lo inventa, sólo lo reparte como se le pide.
 * Quedan afuera (y se cuentan aparte) las que ya están administradas, las que el local dio
 * de baja y las que no tienen talles (no hay qué comprar).
 *
 * @returns { fichas, yaHabilitadas, dadasDeBaja, sinTalles }; `fichas` es [] si las
 *          unidades no son un entero de 1 a TOPE_UNIDADES_POR_TALLE.
 */
export function fichasParaHabilitar({ catalogo, productos, ajustes, unidades }) {
  const vacio = { fichas: [], yaHabilitadas: 0, dadasDeBaja: 0, sinTalles: 0 };
  if (!Number.isInteger(unidades) || unidades < 1 || unidades > TOPE_UNIDADES_POR_TALLE) return vacio;
  const origenes = new Set((Array.isArray(productos) ? productos : []).map((p) => p?.sourceCatalogId).filter(Boolean));
  const salida = { ...vacio, fichas: [] };
  for (const prenda of Array.isArray(catalogo) ? catalogo : []) {
    if (!prenda || typeof prenda.id !== "string") continue;
    if (origenes.has(prenda.id)) {
      salida.yaHabilitadas++;
      continue;
    }
    const ajuste = ajustes?.[prenda.id] || {};
    if (ajuste.active === false) {
      salida.dadasDeBaja++;
      continue;
    }
    const ficha = prepararFichaImportada(prenda, ajuste);
    if (!ficha.sizes.length || !(ficha.price > 0)) {
      salida.sinTalles++;
      continue;
    }
    salida.fichas.push({ ...ficha, stock: Object.fromEntries(ficha.sizes.map((t) => [t, unidades])) });
  }
  return salida;
}
