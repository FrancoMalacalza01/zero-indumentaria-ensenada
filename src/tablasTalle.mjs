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

// Prendas para las que Brooksfield no publicó una tabla propia: se les muestra la de la prenda más parecida,
// AVISANDO que es de referencia. Los pantalones y bermudas usan las medidas de cintura, cadera y largo de sus
// jeans; los buzos y chalecos, las de sus sweaters. Los cortes distintos pueden variar un poco.
const REFERENCIA_BROOKSFIELD = Object.freeze({
  Pantalones: { tipo: "jeans", como: "jeans" },
  Bermudas: { tipo: "jeans", como: "jeans" },
  Buzos: { tipo: "sweaters", como: "sweaters" },
  Chalecos: { tipo: "sweaters", como: "sweaters" },
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
    if (!tipo) {
      const ref = Object.hasOwn(REFERENCIA_BROOKSFIELD, prenda.category) ? REFERENCIA_BROOKSFIELD[prenda.category] : null;
      if (!ref) return null;
      return {
        tipo: "imagen",
        marca: "Brooksfield",
        src: `/men-medidas/brooksfield-${ref.tipo}.jpg`,
        alt: `Tabla de medidas de Brooksfield: ${ref.como}`,
        referencia: `Medidas de referencia: son las de los ${ref.como} de Brooksfield. En otros cortes pueden variar; ante la duda, consultanos.`,
      };
    }
    return {
      tipo: "imagen",
      marca: "Brooksfield",
      src: `/men-medidas/brooksfield-${tipo}.jpg`,
      alt: `Tabla de medidas de Brooksfield: ${tipo}`,
    };
  }
  return null;
}

/**
 * Convierte filas "Ancho de pecho 51 cm, Largo total 70 cm" en una tabla de verdad: una columna por
 * medida (Talle | Ancho de pecho | Largo total). Sólo si todos los talles traen las mismas medidas, en
 * el mismo orden: si no, devuelve `null` y se muestra el texto de cada fila tal cual lo escribió la marca.
 *
 * @returns { titulos: string[], filas: [{ talle, valores: string[] }] } o `null`
 */
export function columnasDeMedidas(filas) {
  if (!Array.isArray(filas) || !filas.length) return null;
  let titulos = null;
  const salida = [];
  for (const f of filas) {
    if (!f || typeof f.talle !== "string" || typeof f.medidas !== "string") return null;
    const partes = f.medidas.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
    const celdas = [];
    for (const parte of partes) {
      // "Ancho de pecho 51 cm" -> título "Ancho de pecho", valor "51 cm"; el valor empieza en el primer número.
      const m = /^(\D+?)\s*(\d.*)$/.exec(parte);
      if (!m) return null;
      celdas.push({ titulo: m[1].trim().replace(/\s+/g, " "), valor: m[2].trim() });
    }
    if (!celdas.length) return null;
    const t = celdas.map((c) => c.titulo.toLowerCase());
    if (titulos === null) titulos = celdas.map((c) => c.titulo);
    else if (t.join("|") !== titulos.map((x) => x.toLowerCase()).join("|")) return null;
    salida.push({ talle: f.talle, valores: celdas.map((c) => c.valor) });
  }
  return { titulos, filas: salida };
}
