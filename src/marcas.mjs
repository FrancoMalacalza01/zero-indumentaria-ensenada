// Las dos marcas que vende el local y cómo se ordenan sus categorías.
//
// Mistral y Brooksfield tienen cada una su propia línea de prendas: se muestran separadas, cada una con su
// nombre (y su logo, si el local lo cargó en `public/marcas/`) y con SUS categorías, no una lista mezclada.

/** Las marcas, en el orden en que se muestran. */
export const MARCAS = Object.freeze(["Mistral", "Brooksfield"]);

/** El nombre de archivo del logo de una marca: `public/marcas/<slug>.png` (o `.svg`). */
export function slugDeMarca(marca) {
  return String(marca ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Las categorías de cada marca con su cantidad de prendas, de la más numerosa a la menos (y por nombre si
 * empatan). Una categoría que sólo existe en una marca no aparece en la otra.
 *
 * @param productos  [{ brand, category }]
 * @returns { [marca]: [{ nombre, cantidad }] }, con las marcas conocidas primero y vacías si no tienen prendas
 */
export function categoriasPorMarca(productos) {
  const porMarca = new Map();
  for (const p of Array.isArray(productos) ? productos : []) {
    const marca = typeof p?.brand === "string" ? p.brand : "";
    const categoria = typeof p?.category === "string" ? p.category : "";
    if (!marca || !categoria) continue;
    const cuenta = porMarca.get(marca) ?? new Map();
    cuenta.set(categoria, (cuenta.get(categoria) ?? 0) + 1);
    porMarca.set(marca, cuenta);
  }
  const salida = {};
  const orden = [...MARCAS, ...[...porMarca.keys()].filter((m) => !MARCAS.includes(m)).sort((a, b) => a.localeCompare(b, "es-AR"))];
  for (const marca of orden) {
    const cuenta = porMarca.get(marca) ?? new Map();
    salida[marca] = [...cuenta.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es-AR"));
  }
  return salida;
}
