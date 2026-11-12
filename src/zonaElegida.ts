/**
 * Cómo eligió recibir la compra el cliente (retiro o envío y a qué zona), para que la bolsa y el
 * checkout muestren lo mismo sin preguntárselo dos veces. Vive sólo en esta pestaña
 * (sessionStorage) y se valida contra las zonas actuales: si el local sacó la zona, se ignora.
 */
const CLAVE = "zero-envio-elegido-v1";

export type Eleccion = { delivery: "pickup" | "shipping"; zone: string };

export function leerEleccion(zonas: { nombre: string }[]): Eleccion | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
    if (v?.delivery === "pickup") return { delivery: "pickup", zone: zonas[0]?.nombre || "" };
    if (v?.delivery === "shipping" && zonas.some((z) => z.nombre === v.zone)) return { delivery: "shipping", zone: v.zone };
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
