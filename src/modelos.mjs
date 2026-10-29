// Una misma prenda aparece más de una vez: en la tienda como "Remera Blank MC" y
// en el catálogo de hombre una vez por color, como "Remera Blank MC - 10206-5".
// La clave de modelo es lo que tienen en común: el nombre sin el código del
// final, para que un cambio de precio llegue a todas las versiones.

/** El nombre sin el " - código" del final, sin mayúsculas ni espacios de más. */
export function claveDeModelo(nombre) {
  if (typeof nombre !== "string") return "";
  return nombre
    .replace(/\s+-\s+[\w.]+(?:-[\w.]+)*\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-AR");
}

/** Los otros artículos del mismo modelo que `articulo`, de cualquier fuente. */
export function delMismoModelo(articulo, todos) {
  const clave = claveDeModelo(articulo?.nombre);
  if (!clave) return [];
  return todos.filter((x) => x.key !== articulo.key && claveDeModelo(x.nombre) === clave);
}
