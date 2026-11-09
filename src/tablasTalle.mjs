// Tabla de talles de una prenda de hombre, tal como la publica su marca.
//
// - Lo mejor es la tabla de ESA prenda: las medidas por talle que Mistral y
//   Brooksfield cargan en la ficha de cada producto (las copia
//   `scripts/scrape-men-detalles.py` en `men-detalles.json`, por id).
// - Si la ficha de Brooksfield no trae medidas, se muestra la tabla general
//   que publica para ese tipo de prenda (`public/men-medidas/brooksfield-*.jpg`).
//
// Son medidas de la marca, de la prenda en plano: no se inventa ninguna. Si la
// marca no publicó una tabla para esa prenda, no hay tabla.

const IMAGENES_BROOKSFIELD = Object.freeze({
  Remeras: "remeras",
  Polos: "polos",
  Camisas: "camisas",
  Sweaters: "sweaters",
  Camperas: "camperas",
});

/**
 * @param prenda    { id, brand, category, name }
 * @param detalles  el contenido de men-detalles.json: { [id]: { medidas: { nota, filas: [{ talle, medidas }] } } }
 * @returns una tabla de filas, una imagen (Brooksfield) o `null`
 */
export function tablaDeTalles(prenda, detalles) {
  if (!prenda || typeof prenda !== "object") return null;
  if (prenda.brand !== "Mistral" && prenda.brand !== "Brooksfield") return null;
  const d = detalles && Object.hasOwn(detalles, prenda.id) ? detalles[prenda.id] : null;
  const m = d?.medidas;
  const filas = Array.isArray(m?.filas) ? m.filas.filter((f) => f?.talle && f?.medidas) : [];
  if (filas.length) return { tipo: "filas", marca: prenda.brand, nota: typeof m.nota === "string" ? m.nota : "", filas };
  if (prenda.brand === "Brooksfield") {
    const esJean = /\bjeans?\b/i.test(String(prenda.name || ""));
    const tipo = esJean ? "jeans" : IMAGENES_BROOKSFIELD[prenda.category];
    if (!tipo) return null;
    return {
      tipo: "imagen",
      marca: "Brooksfield",
      src: `/men-medidas/brooksfield-${tipo}.jpg`,
      alt: `Tabla de medidas de Brooksfield: ${tipo}`,
    };
  }
  return null;
}
