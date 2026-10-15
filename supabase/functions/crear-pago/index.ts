/**
 * Arma el cobro del pedido en Mercado Pago, con el monto exacto.
 *
 * POR QUÉ ESTO VIVE EN UN SERVIDOR Y NO EN EL NAVEGADOR. Para que Mercado
 * Pago cobre el total de una bolsa cualquiera hay que pedirle una
 * "preferencia" con el token privado de la cuenta. Ese token no puede viajar
 * al navegador: con él, cualquiera cobra en nombre del local. Por eso hay una
 * función acá, que es el único lugar donde el token existe.
 *
 * QUÉ NO HACE. No decide cuánto se paga: el monto, los items y el envío salen
 * del pedido que ya está guardado en la base, no de lo que manda el navegador.
 * El navegador sólo dice "cobrame el pedido M-00007".
 *
 * SIN TOKEN NO HACE NADA. Mientras el local no cargue MP_ACCESS_TOKEN, la
 * función contesta que no está configurada y la tienda sigue mostrando el
 * alias y el link de siempre. No se rompe nada.
 *
 * POR QUÉ NO PIDE JWT. La llama la tienda, donde el cliente no tiene cuenta:
 * no hay ningún usuario que autenticar. Lo que la protege es que no decide
 * nada por sí misma: sólo cobra un pedido que ya existe, que es de hace menos
 * de dos horas y que todavía no está pagado. Lo peor que puede conseguir
 * alguien probando números de pedido es el link para pagarle a otro.
 *
 * CÓMO SE CONFIGURA:
 *   1. En Mercado Pago: Tu negocio → Credenciales → Credenciales de
 *      producción → Access Token.
 *   2. En Supabase: Edge Functions → Secrets → MP_ACCESS_TOKEN.
 *   3. En el panel de la tienda: Configuración → "Cobrar online con Mercado
 *      Pago".
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_MP = Deno.env.get("MP_ACCESS_TOKEN") || "";
/** De dónde vuelve el cliente después de pagar. Sin esto, vuelve a la raíz. */
const SITIO = Deno.env.get("SITIO_URL") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Un pedido viejo no se puede pagar: evita que alguien ande probando ids. */
const VENTANA_HORAS = 2;

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

  if (!TOKEN_MP)
    return responder({
      error: "El cobro online todavía no está configurado.",
      detalle: "Falta cargar MP_ACCESS_TOKEN en Supabase.",
    }, 503);

  let pedidoId = "";
  try {
    const cuerpo = await req.json();
    pedidoId = String(cuerpo?.pedido || "").trim().slice(0, 40);
  } catch {
    return responder({ error: "No entendí el pedido." }, 400);
  }
  if (!pedidoId) return responder({ error: "Falta el número de pedido." }, 400);

  try {
    const filas = await base(
      `orders?id=eq.${encodeURIComponent(pedidoId)}&select=id,items,total,envio,fecha,status,payment_status,customer`,
    );
    const pedido = Array.isArray(filas) ? filas[0] : null;
    if (!pedido) return responder({ error: "No encontramos ese pedido." }, 404);

    if (["Cancelado", "Devuelto"].includes(pedido.status))
      return responder({ error: "Ese pedido ya no está activo." }, 409);
    if (pedido.payment_status === "aprobado")
      return responder({ error: "Ese pedido ya está pagado." }, 409);

    const edad = Date.now() - new Date(pedido.fecha).getTime();
    if (edad > VENTANA_HORAS * 3600_000)
      return responder({
        error: "Ese pedido es de hace rato. Escribinos por WhatsApp y lo cobramos.",
      }, 409);

    const items = (Array.isArray(pedido.items) ? pedido.items : []).map(
      (i: Record<string, unknown>) => ({
        id: String(i.productId ?? ""),
        title: `${i.name ?? "Prenda"} · Talle ${i.size ?? ""}`.trim(),
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.price) || 0,
        currency_id: "ARS",
      }),
    );
    if (!items.length) return responder({ error: "El pedido no tiene prendas." }, 409);

    const envio = Number(pedido.envio) || 0;
    const preferencia = {
      items,
      // El envío va como costo de envío y no como un item más, así el cliente
      // ve en Mercado Pago el mismo desglose que vio en la tienda.
      ...(envio ? { shipments: { cost: envio, mode: "not_specified" } } : {}),
      // Esto es lo que ata el pago al pedido cuando vuelve el aviso.
      external_reference: pedido.id,
      statement_descriptor: "MISTRAL",
      notification_url: `${URL_BASE}/functions/v1/pago-aviso`,
      ...(SITIO
        ? {
            back_urls: {
              success: `${SITIO}/pago?estado=aprobado&pedido=${encodeURIComponent(pedido.id)}`,
              pending: `${SITIO}/pago?estado=pendiente&pedido=${encodeURIComponent(pedido.id)}`,
              failure: `${SITIO}/pago?estado=rechazado&pedido=${encodeURIComponent(pedido.id)}`,
            },
            auto_return: "approved",
          }
        : {}),
    };

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN_MP}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencia),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("mercadopago rechazó la preferencia", r.status, datos);
      return responder({
        error: "Mercado Pago no pudo armar el cobro. Probá de nuevo o escribinos.",
      }, 502);
    }

    // Queda en "pendiente" desde ya: si el cliente abandona, el panel lo
    // muestra sin pagar en vez de hacer de cuenta que no pasó nada.
    await base(`orders?id=eq.${encodeURIComponent(pedido.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payment_status: "pendiente" }),
    });

    return responder({ url: datos.init_point || datos.sandbox_init_point });
  } catch (err) {
    console.error("crear-pago falló", err);
    return responder({
      error: "No pudimos armar el cobro. Escribinos por WhatsApp y lo resolvemos.",
    }, 500);
  }
});
