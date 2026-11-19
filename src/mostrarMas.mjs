/**
 * Listas largas "de a poco": se muestran las primeras N y un botón "Mostrar más" suma otras N.
 *
 * Existe porque el panel dibujaba las ~970 prendas del catálogo de una vez (más de 140.000 caracteres de
 * pantalla), y en un celular eso se siente trabado. Con 50 por vez, la pestaña abre al instante.
 */
export const POR_PAGINA = 50;

/**
 * @param lista     la lista completa, ya filtrada y ordenada
 * @param visibles  cuántos se muestran hoy
 * @returns { items, quedan } los que se dibujan y cuántos faltan mostrar
 */
export function recortar(lista, visibles = POR_PAGINA) {
  const todos = Array.isArray(lista) ? lista : [];
  const n = Number.isFinite(visibles) ? Math.max(0, Math.trunc(visibles)) : POR_PAGINA;
  return { items: todos.slice(0, n), quedan: Math.max(0, todos.length - n) };
}
