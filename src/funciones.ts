/**
 * Las funciones que corren en el servidor, llamadas desde la tienda.
 *
 * Son dos y las dos existen por el mismo motivo: hay cosas que no se pueden
 * hacer desde el navegador sin regalar un secreto.
 *
 * - `crear-pago` le pide a Mercado Pago el cobro del monto exacto. Necesita
 *   el token privado de la cuenta, que no puede viajar al navegador.
 * - `enviar-mail` le manda al cliente la confirmación. Necesita la clave del
 *   correo, idem.
 *
 * Las dos son opcionales: si el local no las configuró, contestan que no
 * están configuradas y la compra sigue andando igual. Por eso ninguna de las
 * dos puede hacer fallar un pedido que ya entró.
 */
import { URL_SERVIDOR, CLAVE_PUBLICA, serverConfigured } from "./server";

const ESPERA_MAXIMA = 20_000;

async function llamar(
  nombre: string,
  cuerpo: unknown,
): Promise<Record<string, unknown>> {
  if (!serverConfigured) return { error: "No hay servidor configurado." };
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  try {
    const r = await fetch(`${URL_SERVIDOR}/functions/v1/${nombre}`, {
      method: "POST",
      signal: corte.signal,
      headers: {
        apikey: CLAVE_PUBLICA,
        Authorization: `Bearer ${CLAVE_PUBLICA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok)
      return {
        error:
          typeof datos?.error === "string"
            ? datos.error
            : `El servidor respondió ${r.status}`,
      };
    return (datos || {}) as Record<string, unknown>;
  } catch {
    return { error: "No pudimos llegar al servidor." };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Pide el link de pago del pedido.
 *
 * Devuelve la URL de Mercado Pago, o el motivo por el que no se pudo en
 * palabras que se le pueden mostrar al cliente.
 */
export async function pedirLinkDePago(pedido: string) {
  const r = await llamar("crear-pago", { pedido });
  if (typeof r.url === "string" && r.url) return { url: r.url };
  return { error: typeof r.error === "string" ? r.error : "No se pudo armar el cobro." };
}

/**
 * Le manda la confirmación al cliente.
 *
 * No devuelve nada que la tienda tenga que mostrar: si el mail no sale, el
 * pedido ya entró y eso es lo que importa. El motivo queda en la consola
 * para poder revisarlo.
 */
export async function mandarConfirmacion(pedido: string, email: string) {
  if (!email) return;
  const r = await llamar("enviar-mail", { pedido, email });
  if (r?.error) console.warn("no salió el mail de confirmación:", r.error);
}

/**
 * Le pide al servidor que cobre el pedido con el token que Payway le dio al navegador.
 *
 * Al servidor viajan sólo el pedido, el token, los 6 primeros dígitos y el medio de
 * pago: nunca el número de tarjeta. Devuelve el resultado ya traducido para el cliente
 * (`estado` y `mensaje`); el navegador no interpreta nada de Payway.
 */
export async function pagarConPayway(datos: {
  pedido: string;
  token: string;
  bin: string;
  medio: number;
}): Promise<{ estado: "aprobado" | "rechazado" | "pendiente" | "error"; mensaje: string }> {
  const r = await llamar("payway-pagar", datos);
  const estado = r.estado;
  if (estado === "aprobado" || estado === "rechazado" || estado === "pendiente" || estado === "error")
    return { estado, mensaje: typeof r.mensaje === "string" ? r.mensaje : "" };
  return {
    estado: "error",
    mensaje: typeof r.error === "string" ? r.error : "No pudimos procesar el pago. Escribinos por WhatsApp.",
  };
}
