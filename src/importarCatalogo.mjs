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
