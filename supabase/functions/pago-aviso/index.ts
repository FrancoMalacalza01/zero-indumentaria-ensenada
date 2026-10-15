/**
 * El aviso de Mercado Pago cuando un pago cambia de estado.
 *
 * LO QUE IMPORTA: **no se le cree al aviso**. Mercado Pago manda el id del
 * pago, no el resultado; esta función le pregunta a la API de Mercado Pago
 * cómo quedó ese pago, con el token del local. Si se confiara en el cuerpo
 * del aviso, cualquiera podría mandar un POST diciendo "el pedido M-00007
 * está pagado" y el local prepararía mercadería que nadie pagó.
 *
 * Por eso esta función es pública (Mercado Pago no puede mandar un JWT
 * nuestro) pero no decide nada por sí misma: todo lo que escribe sale de
 * preguntarle a Mercado Pago.
 *
 * Y contesta 200 casi siempre a propósito: si contesta error, Mercado Pago
 * reintenta el mismo aviso durante horas.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_MP = Deno.env.get("MP_ACCESS_TOKEN") || "";

/** Cómo se traduce el estado de Mercado Pago al nuestro. */
function traducir(estado: string) {
  if (estado === "approved") return "aprobado";
  if (["rejected", "cancelled"].includes(estado)) return "rechazado";
  if (["refunded", "charged_back"].includes(estado)) return "devuelto";
  // pending, in_process, in_mediation y lo que venga nuevo: todavía no está.
  return "pendiente";
}

Deno.serve(async (req: Request) => {
  const ok = () => new Response("ok", { status: 200 });
  if (req.method === "OPTIONS") return ok();
  if (!TOKEN_MP) {
    console.error("llegó un aviso de pago sin MP_ACCESS_TOKEN cargado");
    return ok();
  }

  try {
    // Mercado Pago manda el id de dos formas según la versión del aviso.
    const url = new URL(req.url);
    let idPago =
      url.searchParams.get("data.id") || url.searchParams.get("id") || "";
    const tipo =
      url.searchParams.get("type") || url.searchParams.get("topic") || "";
    if (!idPago || !/^payment$/i.test(tipo)) {
      const cuerpo = await req.json().catch(() => ({}));
      idPago = String(cuerpo?.data?.id || cuerpo?.id || idPago || "");
      const t = String(cuerpo?.type || cuerpo?.topic || tipo || "");
      // Mercado Pago avisa de varias cosas; las que no son pagos se ignoran.
      if (!idPago || !/payment/i.test(t)) return ok();
    }
    if (!/^\d+$/.test(idPago)) return ok();

    // Acá está la verificación: se le pregunta a Mercado Pago.
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${idPago}`, {
      headers: { Authorization: `Bearer ${TOKEN_MP}` },
    });
    if (!r.ok) {
      console.error("no se pudo leer el pago en Mercado Pago", idPago, r.status);
      return ok();
    }
    const pago = await r.json();
    const pedidoId = String(pago?.external_reference || "");
    if (!pedidoId) return ok();

    const estado = traducir(String(pago?.status || ""));
    const patch = await fetch(
      `${URL_BASE}/rest/v1/orders?id=eq.${encodeURIComponent(pedidoId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: CLAVE_SERVICIO,
          Authorization: `Bearer ${CLAVE_SERVICIO}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          payment_status: estado,
          pago_ref: String(idPago),
          // El pago aprobado adelanta el pedido: ya se puede preparar.
          ...(estado === "aprobado" ? { status: "Preparando" } : {}),
        }),
      },
    );
    if (!patch.ok)
      console.error("no se pudo anotar el pago", pedidoId, patch.status);
    return ok();
  } catch (err) {
    console.error("pago-aviso falló", err);
    return ok();
  }
});
