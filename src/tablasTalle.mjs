// Tabla de talles de una prenda de hombre, tal como la publica su marca.
//
// - Mistral carga las medidas en la ficha de cada prenda (la copia
//   `scripts/scrape-men-medidas.py` en `men-medidas.json`, por id).
// - Brooksfield publica una imagen por tipo de prenda
//   (`public/men-medidas/brooksfield-*.jpg`).
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
 * @param prenda   { id, brand, category, name }
 * @param medidas  el contenido de men-medidas.json: { [id]: { nota, filas: [{ talle, medidas }] } }
 * @returns una tabla de filas (Mistral), una imagen (Brooksfield) o `null`
 */
export function tablaDeTalles(prenda, medidas) {
  if (!prenda || typeof prenda !== "object") return null;
  if (prenda.brand === "Mistral") {
    const m = medidas && Object.hasOwn(medidas, prenda.id) ? medidas[prenda.id] : null;
    const filas = Array.isArray(m?.filas) ? m.filas.filter((f) => f?.talle && f?.medidas) : [];
    if (!filas.length) return null;
    return { tipo: "filas", marca: "Mistral", nota: typeof m.nota === "string" ? m.nota : "", filas };
  }
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
