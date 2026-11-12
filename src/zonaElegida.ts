/**
 * Cómo eligió recibir la compra el cliente (retiro o envío y a qué zona), para que la bolsa y el
 * checkout muestren lo mismo sin preguntárselo dos veces. Vive sólo en esta pestaña
 * (sessionStorage) y se valida contra las zonas actuales: si el local sacó la zona, se ignora.
 */
const CLAVE = "zero-envio-elegido-v1";

export type Eleccion = { delivery: "pickup" | "shipping"; zone: string; cp: string };

export function leerEleccion(zonas: { nombre: string }[]): Eleccion | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
    const cp = typeof v?.cp === "string" ? v.cp.slice(0, 10) : "";
    if (v?.delivery === "pickup") return { delivery: "pickup", zone: zonas[0]?.nombre || "", cp };
    // Con códigos postales, la zona puede estar vacía mientras el cliente todavía escribe.
    if (v?.delivery === "shipping" && (v.zone === "" || zonas.some((z) => z.nombre === v.zone))) return { delivery: "shipping", zone: v.zone, cp };
  } catch {
    /* Sin almacenamiento o con basura: se arranca de cero. */
  }
  return null;
}

export function guardarEleccion(e: Eleccion) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* Sin almacenamiento sigue andando: sólo no se acuerda de la elección. */
  }
}
