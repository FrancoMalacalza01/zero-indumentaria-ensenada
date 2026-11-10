// Lo que la marca cuenta de una prenda: material (composición), color,
// características y cuidados. Sale de la ficha de cada marca
// (`scripts/scrape-men-detalles.py` → `men-detalles.json`) y del color del
// catálogo. Lo que la ficha no dice, no se muestra ni se inventa.

// Sin textos vacíos ni repetidos: las fichas de las marcas repiten renglones.
const textos = (lista) =>
  Array.isArray(lista)
    ? [...new Set(lista.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()))]
    : [];

/**
 * @param prenda    { id, colors }
 * @param detalles  { [id]: { composicion, descripcion, caracteristicas, cuidados } }
 * @returns { composicion, colores, descripcion, caracteristicas, cuidados } o `null` si no hay nada para mostrar
 */
export function detallesDePrenda(prenda, detalles) {
  if (!prenda || typeof prenda !== "object") return null;
  const d = detalles && Object.hasOwn(detalles, prenda.id) ? detalles[prenda.id] : null;
  const composicion = typeof d?.composicion === "string" && d.composicion.trim() ? d.composicion.trim() : "";
  const colores = textos(prenda.colors);
  const caracteristicas = textos(d?.caracteristicas).filter((c) => c !== composicion);
  // Los párrafos que escribe la marca, tal cual. Si uno repite una característica, no se muestra dos veces.
  const descripcion = textos(d?.descripcion).filter((p) => !caracteristicas.includes(p));
  const cuidados = textos(d?.cuidados);
  if (!composicion && !colores.length && !descripcion.length && !caracteristicas.length && !cuidados.length) return null;
  return { composicion, colores, descripcion, caracteristicas, cuidados };
}
