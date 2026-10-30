/** Lee todas las páginas de la Data API, que limita el número de filas. */
export async function pedirTodasLasFilas(pedir, ruta, limite = 1000) {
  const todas = [];
  for (let inicio = 0; ; inicio += limite) {
    const separador = ruta.includes("?") ? "&" : "?";
    const pagina = await pedir(`${ruta}${separador}limit=${limite}&offset=${inicio}`);
    if (!Array.isArray(pagina)) throw new Error("El servidor no devolvió una lista de productos.");
    todas.push(...pagina);
    if (pagina.length < limite) return todas;
  }
}
