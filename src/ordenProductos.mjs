// Orden de las listas de prendas de hombre. Es lógica pura para poder probarla:
// en pantalla sólo se elige la opción.

export const ORDENES = Object.freeze([
  { id: "destacados", etiqueta: "Destacados" },
  { id: "precio-menor", etiqueta: "Precio: menor a mayor" },
  { id: "precio-mayor", etiqueta: "Precio: mayor a menor" },
]);

const esPrecio = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Devuelve una copia ordenada; no toca la lista original. "destacados" deja el
 * orden del catálogo. Con precios iguales se conserva ese orden, y una prenda
 * sin precio válido va siempre al final, ordenen como ordenen.
 */
export function ordenarProductos(productos, orden) {
  const lista = Array.isArray(productos) ? [...productos] : [];
  if (orden !== "precio-menor" && orden !== "precio-mayor") return lista;
  const signo = orden === "precio-menor" ? 1 : -1;
  return lista
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const va = esPrecio(a.p?.priceARS);
      const vb = esPrecio(b.p?.priceARS);
      if (va !== vb) return va ? -1 : 1;
      if (!va) return a.i - b.i;
      return signo * (a.p.priceARS - b.p.priceARS) || a.i - b.i;
    })
    .map(({ p }) => p);
}
