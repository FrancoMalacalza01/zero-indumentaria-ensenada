/**
 * Anula en Payway el pago de un pedido (POST /payments/{payment_id}/refunds).
 *
 * POR QUÉ EXISTE. Cancelar un pedido en el panel devuelve el stock, pero NO devuelve la
 * plata del cliente: un pago de tarjeta hay que anularlo en Payway. Esta función es lo
 * que lo hace, y el panel la llama ANTES de cancelar un pedido pagado por Payway.
 *
 * A DIFERENCIA DE `payway-pagar`, ESTA SÍ EXIGE SER ADMIN. Devolver plata es lo que
 * nadie que entre a la tienda puede poder hacer. La función verifica que quien llama
 * tenga una sesión válida Y esté en la tabla `admins`; la clave pública de la tienda no
 * alcanza. (Se despliega con la verificación de JWT prendida, que es la de fábrica.)
 *
 * QUÉ HACE, EN ORDEN:
 *   1. Comprueba que sea un admin.
 *   2. Lee el pedido: tiene que estar pagado (`aprobado`) y por Payway (`pago_ref` con el
 *      formato `payway:<id>`). El id sale de la base, no de lo que mande el panel.
 *   3. Lo marca `devuelto` con una escritura condicional, ANTES de llamar a Payway: dos
 *      anulaciones a la vez no pueden seguir las dos.
 *   4. Llama a Payway con la clave privada.
 *   5. Sólo si Payway confirma la anulación el pedido queda `devuelto`. Si dice que no,
 *      si no se entiende lo que dijo, o si no contesta, vuelve a `aprobado`: no se da por
 *      devuelta una plata que no sabemos si volvió.
 *
 * SOLO ANULACIÓN. Anula el pago completo, antes del cierre de lote (cuerpo vacío, como en
 * la documentación). La devolución parcial o posterior al cierre no está: se hace desde el
 * backoffice de Payway. El panel se lo dice al dueño si Payway rechaza la anulación.
 *
 * CÓMO SE CONFIGURA: igual que `payway-pagar` (PAYWAY_PRIVATE_API_KEY y, para producción,
 * PAYWAY_URL).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  ENTORNO_SANDBOX,
  idDePagoDe,
  interpretarAnulacion,
  urlDeAnulacion,
  urlPaywayValida,
} from "../_shared/payway.mjs";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLAVE_PRIVADA = Deno.env.get("PAYWAY_PRIVATE_API_KEY") || "";
const URL_PAYWAY_CONFIGURADA = Deno.env.get("PAYWAY_URL") || "";
const URL_PAYWAY = URL_PAYWAY_CONFIGURADA
  ? urlPaywayValida(URL_PAYWAY_CONFIGURADA)
  : ENTORNO_SANDBOX;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ESPERA_MAXIMA_MS = 25_000;

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function base(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: CLAVE_SERVICIO,
      Authorization: `Bearer ${CLAVE_SERVICIO}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`base: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/** Quién llama, si es un usuario con sesión y está en la tabla de admins. */
async function esAdmin(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  const r = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: CLAVE_SERVICIO, Authorization: `Bearer ${jwt}` },
  });
  if (!r.ok) return false; // la clave pública de la tienda no es un usuario: no pasa
  const usuario = await r.json().catch(() => null);
  const id = String(usuario?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const filas = await base(`admins?user_id=eq.${id}&select=user_id`);
  return Array.isArray(filas) && filas.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);

  if (!(await esAdmin(req).catch(() => false)))
    return responder({ estado: "error", mensaje: "Para anular un pago hay que ser administrador." }, 403);

  if (!CLAVE_PRIVADA || !URL_PAYWAY)
    return responder({ estado: "error", mensaje: "Payway no está configurado en el servidor." }, 503);

  let pedidoId = "";
  try {
    pedidoId = String((await req.json())?.pedido || "").trim().slice(0, 40);
  } catch {
    return responder({ estado: "error", mensaje: "No entendí el pedido." }, 400);
  }
  if (!pedidoId) return responder({ estado: "error", mensaje: "Falta el número de pedido." }, 400);

  try {
    const filas = await base(`orders?id=eq.${encodeURIComponent(pedidoId)}&select=id,payment_status,pago_ref`);
    const pedido = Array.isArray(filas) ? filas[0] : null;
    if (!pedido) return responder({ estado: "error", mensaje: "No encontramos ese pedido." }, 404);

    const idPago = idDePagoDe(pedido.pago_ref);
    if (pedido.payment_status !== "aprobado" || !idPago)
      return responder({ estado: "error", mensaje: "Ese pedido no tiene un pago aprobado por Payway para anular." }, 409);

    const url = urlDeAnulacion(URL_PAYWAY, idPago);
    if (!url) return responder({ estado: "error", mensaje: "No se pudo armar la anulación." }, 500);

    // Se reserva el pedido antes de llamar: dos anulaciones a la vez no pasan las dos.
    const reservado = await base(
      `orders?id=eq.${encodeURIComponent(pedido.id)}&payment_status=eq.aprobado&pago_ref=eq.${encodeURIComponent(pedido.pago_ref)}&select=id`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ payment_status: "devuelto" }) },
    );
    if (!Array.isArray(reservado) || !reservado.length)
      return responder({ estado: "error", mensaje: "Ese pago ya se está anulando o ya no está aprobado." }, 409);

    const volverAAprobado = () =>
      base(`orders?id=eq.${encodeURIComponent(pedido.id)}&payment_status=eq.devuelto`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ payment_status: "aprobado" }),
      });

    let http = 0;
    let datos: unknown = null;
    try {
      const corte = new AbortController();
      const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA_MS);
      try {
        const r = await fetch(url, {
          method: "POST",
          signal: corte.signal,
          headers: { apikey: CLAVE_PRIVADA, "Content-Type": "application/json", Accept: "application/json" },
          body: "{}", // anulación total, sin monto
        });
        http = r.status;
        datos = await r.json().catch(() => null);
      } finally {
        clearTimeout(reloj);
      }
    } catch (err) {
      console.error("payway no contestó la anulación", pedido.id, idPago, err);
      await volverAAprobado();
      return responder({
        estado: "incierto",
        mensaje:
          "Payway no contestó. No sabemos si la anulación se hizo: revisala en el backoffice de Payway antes de repetir.",
      });
    }

    const r = interpretarAnulacion(http, datos);
    if (r.estado !== "anulado") {
      console.error("la anulación no se confirmó", pedido.id, idPago, http, datos);
      await volverAAprobado();
    }
    return responder({ estado: r.estado, mensaje: r.mensaje });
  } catch (err) {
    console.error("payway-anular falló", err);
    return responder({ estado: "error", mensaje: "No pudimos anular el pago. Probá de nuevo." }, 500);
  }
});
