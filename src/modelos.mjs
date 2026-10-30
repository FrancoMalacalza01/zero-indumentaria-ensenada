import { vistaPrevia } from "./priceTools.mjs";
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

/** La primera versión seleccionada fija la regla de cada modelo; la vista y la
 * aplicación usan las mismas filas, incluso para versiones fuera del filtro. */
export function vistaPorModelo(seleccion, todos, op, valor, redondeo, propagar) {
  if (!propagar) return vistaPrevia(seleccion.map(a => ({ key: a.key, precio: a.precio, ...(a.antes ? { base: a.antes } : {}) })), op, valor, redondeo);
  const procesados = new Set();
  const filas = [];
  for (const a of seleccion) {
    if (procesados.has(a.key)) continue;
    const grupo = [a, ...delMismoModelo(a, todos)];
    for (const miembro of grupo) procesados.add(miembro.key);
    const resultado = vistaPrevia([{ key: a.key, precio: a.precio, ...(a.antes ? { base: a.antes } : {}) }], op, valor, redondeo).filas[0];
    if (resultado.estado === "error") {
      filas.push(resultado);
      continue;
    }
    for (const miembro of grupo) {
      const igual = miembro.precio === resultado.despues && (op !== "oferta" || miembro.antes === resultado.base);
      filas.push({ key: miembro.key, antes: miembro.precio, despues: resultado.despues, estado: igual ? "igual" : "cambia", ...(op === "oferta" ? { base: resultado.base } : {}) });
    }
  }
  const cambios = filas.filter(f => f.estado === "cambia");
  const suma = cambios.reduce((s, f) => s + ((f.despues - f.antes) / f.antes) * 100, 0);
  return { filas, cambian: cambios.length, iguales: filas.filter(f => f.estado === "igual").length, errores: filas.filter(f => f.estado === "error").length, promedioPct: cambios.length ? Math.round(suma / cambios.length * 10) / 10 : 0 };
}

/** Cada versión en oferta recupera su propio precio anterior. */
export function ofertasDelModelo(seleccion, todos, propagar) {
  const encontrados = new Map();
  for (const a of seleccion) {
    for (const miembro of propagar ? [a, ...delMismoModelo(a, todos)] : [a]) {
      if (miembro.antes) encontrados.set(miembro.key, miembro);
    }
  }
  return [...encontrados.values()];
}
