/**
 * Cobra el pedido con Payway (tarjeta), con el monto exacto.
 *
 * CÓMO ES EL FLUJO (modelo NO PCI):
 *   1. En la tienda, el cliente carga la tarjeta. El NAVEGADOR se la manda
 *      directo a Payway (POST /tokens, con la clave pública) y recibe un token.
 *   2. El navegador nos manda a esta función SÓLO: el número de pedido, el token,
 *      los 6 primeros dígitos de la tarjeta y el medio de pago. Nunca el número
 *      de tarjeta, el vencimiento ni el código.
 *   3. Esta función cobra con el token (POST /payments, con la clave PRIVADA).
 *
 * QUÉ NO HACE. No decide cuánto se paga: el monto sale del pedido guardado en la
 * base, no de lo que mande el navegador. Tampoco le cree al navegador que el
 * pago salió bien: lo dice la respuesta de Payway, y si Payway contesta algo
 * que no entendemos, el pedido NO se da por pagado.
 *
 * QUÉ VALIDA ANTES DE COBRAR (paso 3 de la documentación de Payway):
 *   - que el pedido exista y esté activo, y sea de hace menos de dos horas;
 *   - que no esté ya pagado, ni con un cobro en curso (evita cobrar dos veces:
 *     el pedido se "reserva" con una sola escritura antes de llamar a Payway);
 *   - que el monto sea el del pedido.
 *
 * SIN LA CLAVE NO HACE NADA. Mientras el local no cargue PAYWAY_PRIVATE_API_KEY,
 * contesta que no está configurado y la tienda sigue con lo de siempre.
 *
 * POR QUÉ NO PIDE JWT. La llama la tienda, donde el cliente no tiene cuenta. Lo
 * que la protege es lo de arriba: sólo cobra un pedido que ya existe, reciente y
 * sin pagar, por el monto que dice la base. Y la tarjeta no pasa por acá.
 *
 * CÓMO SE CONFIGURA:
 *   1. Payway te da, para Sandbox, una clave pública y una privada (Pagos Online).
 *   2. En Supabase: Edge Functions → Secrets → PAYWAY_PRIVATE_API_KEY (la privada).
 *      Opcional: PAYWAY_URL, sólo para pasar a producción (la da Payway).
 *   3. En el panel de la tienda: Configuración → "Cobrar con tarjeta por Payway":
 *      la clave PÚBLICA y la misma dirección de API.
 *   Producción: Payway no la habilita hasta aprobar los casos de prueba.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  ENTORNO_SANDBOX,
  centavos,
  cuerpoDePago,
  idTransaccion,
  interpretarPago,
  medioValido,
  urlPaywayValida,
} from "../_shared/payway.mjs";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLAVE_PRIVADA = Deno.env.get("PAYWAY_PRIVATE_API_KEY") || "";
const URL_PAYWAY_CONFIGURADA = Deno.env.get("PAYWAY_URL") || "";
/** Si PAYWAY_URL está cargada pero no es de Payway, no se cobra: es adonde viaja la clave privada. */
const URL_PAYWAY = URL_PAYWAY_CONFIGURADA
  ? urlPaywayValida(URL_PAYWAY_CONFIGURADA)
  : ENTORNO_SANDBOX;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Un pedido viejo no se puede pagar: evita que alguien ande probando ids. */
const VENTANA_HORAS = 2;
/** Payway tarda unos 6 segundos; más de esto, se deja el pedido "en revisión". */
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);

  if (!CLAVE_PRIVADA || !URL_PAYWAY)
    return responder({
      estado: "error",
      error: "El cobro con tarjeta todavía no está configurado.",
      mensaje: "El cobro con tarjeta todavía no está disponible. Escribinos por WhatsApp y lo resolvemos.",
    }, 503);

  let pedidoId = "", token = "", bin = "", medio = 0;
  try {
    const c = await req.json();
    pedidoId = String(c?.pedido || "").trim().slice(0, 40);
    token = String(c?.token || "").trim();
    bin = String(c?.bin || "").trim();
    medio = Number(c?.medio);
  } catch {
    return responder({ error: "No entendí el pedido." }, 400);
  }
  if (!pedidoId) return responder({ error: "Falta el número de pedido." }, 400);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(token)) return responder({ error: "Falta el token de la tarjeta." }, 400);
  if (!/^\d{6}$/.test(bin)) return responder({ error: "Faltan los primeros dígitos de la tarjeta." }, 400);
  if (!medioValido(medio)) return responder({ error: "Ese medio de pago no está disponible." }, 400);

  try {
    const filas = await base(
      `orders?id=eq.${encodeURIComponent(pedidoId)}&select=id,total,fecha,status,payment_status`,
    );
    const pedido = Array.isArray(filas) ? filas[0] : null;
    if (!pedido) return responder({ error: "No encontramos ese pedido." }, 404);

    if (["Cancelado", "Devuelto"].includes(pedido.status))
      return responder({ error: "Ese pedido ya no está activo." }, 409);
    if (pedido.payment_status === "aprobado")
      return responder({ error: "Ese pedido ya está pagado." }, 409);

    const edad = Date.now() - new Date(pedido.fecha).getTime();
    if (edad > VENTANA_HORAS * 3600_000)
      return responder({ error: "Ese pedido es de hace rato. Escribinos por WhatsApp y lo cobramos." }, 409);

    // El monto sale de la base. Si no sirve, no se cobra.
    const monto = Number(pedido.total);
    if (!centavos(monto)) return responder({ error: "El pedido no tiene un monto válido." }, 409);

    // Se "reserva" el pedido con UNA escritura condicional: sólo pasa si estaba
    // sin pago o rechazado. Si dos cobros llegan a la vez, uno solo sigue.
    const tx = idTransaccion(pedido.id);
    const reservado = await base(
      `orders?id=eq.${encodeURIComponent(pedido.id)}&payment_status=in.(sin_pago,rechazado)&select=id`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ payment_status: "pendiente", pago_ref: `payway-tx:${tx}` }),
      },
    );
    if (!Array.isArray(reservado) || !reservado.length)
      return responder({ error: "Ese pedido ya tiene un cobro en curso. Esperá un momento y revisá tu WhatsApp." }, 409);

    const cuerpo = cuerpoDePago({
      idTransaccion: tx,
      token,
      medio,
      bin,
      total: monto,
      descripcion: `Pedido ${pedido.id}`,
    });

    let http = 0;
    let datos: unknown = null;
    try {
      const corte = new AbortController();
      const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA_MS);
      try {
        const r = await fetch(`${URL_PAYWAY}/payments`, {
          method: "POST",
          signal: corte.signal,
          headers: {
            apikey: CLAVE_PRIVADA,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(cuerpo),
        });
        http = r.status;
        datos = await r.json().catch(() => null);
      } finally {
        clearTimeout(reloj);
      }
    } catch (err) {
      // Sin respuesta no sabemos si cobró: el pedido queda "pendiente" y se revisa
      // en el panel de Payway por el identificador de operación. No se reintenta solo.
      console.error("payway no contestó", tx, err);
      return responder({
        estado: "pendiente",
        mensaje: "Estamos confirmando tu pago con el banco. Te avisamos por WhatsApp apenas lo veamos; no lo repitas.",
      });
    }

    const r = interpretarPago(http, datos);
    if (r.estado === "error") console.error("payway rechazó el pedido de cobro", tx, http, datos);

    if (r.estado === "aprobado" || r.estado === "rechazado") {
      // Sólo se actualiza si el pedido sigue reservado por ESTE cobro.
      await base(
        `orders?id=eq.${encodeURIComponent(pedido.id)}&pago_ref=eq.${encodeURIComponent(`payway-tx:${tx}`)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            payment_status: r.estado === "aprobado" ? "aprobado" : "rechazado",
            pago_ref: `payway:${r.paymentId || tx}`,
            // El pago aprobado adelanta el pedido: ya se puede preparar.
            ...(r.estado === "aprobado" ? { status: "Preparando" } : {}),
          }),
        },
      );
    } else if (r.estado === "error") {
      // No hubo cobro: el pedido vuelve a poder pagarse.
      await base(
        `orders?id=eq.${encodeURIComponent(pedido.id)}&pago_ref=eq.${encodeURIComponent(`payway-tx:${tx}`)}`,
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ payment_status: "sin_pago", pago_ref: null }) },
      );
    }
    // "pendiente" (Payway contestó algo raro): queda reservado, a revisar a mano.

    return responder({ estado: r.estado, mensaje: r.mensaje });
  } catch (err) {
    console.error("payway-pagar falló", err);
    return responder({
      estado: "error",
      mensaje: "No pudimos procesar el pago. Escribinos por WhatsApp y lo resolvemos.",
    }, 500);
  }
});
