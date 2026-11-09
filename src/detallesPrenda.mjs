// Lo que la marca cuenta de una prenda: material (composición), color,
// características y cuidados. Sale de la ficha de cada marca
// (`scripts/scrape-men-detalles.py` → `men-detalles.json`) y del color del
// catálogo. Lo que la ficha no dice, no se muestra ni se inventa.

const textos = (lista) =>
  Array.isArray(lista) ? lista.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];

/**
 * @param prenda    { id, colors }
 * @param detalles  { [id]: { composicion, caracteristicas, cuidados } }
 * @returns { composicion, colores, caracteristicas, cuidados } o `null` si no hay nada para mostrar
 */
export function detallesDePrenda(prenda, detalles) {
  if (!prenda || typeof prenda !== "object") return null;
  const d = detalles && Object.hasOwn(detalles, prenda.id) ? detalles[prenda.id] : null;
  const composicion = typeof d?.composicion === "string" && d.composicion.trim() ? d.composicion.trim() : "";
  const colores = textos(prenda.colors);
  const caracteristicas = textos(d?.caracteristicas).filter((c) => c !== composicion);
  const cuidados = textos(d?.cuidados);
  if (!composicion && !colores.length && !caracteristicas.length && !cuidados.length) return null;
  return { composicion, colores, caracteristicas, cuidados };
}
