/**
 * Le manda al cliente la confirmación de su pedido.
 *
 * POR QUÉ POR SMTP Y NO CON UN SERVICIO. Para mandar mails con un servicio
 * tipo Resend hace falta un dominio propio verificado, y el local no tiene
 * dominio: el sitio vive en vercel.app. Por SMTP se puede usar el Gmail del
 * local con una contraseña de aplicación, que no cuesta nada y no necesita
 * dominio. Y si algún día tiene dominio, se cambian los secretos y listo: la
 * función no sabe ni le importa quién manda el mail.
 *
 * LO QUE NO SE PUEDE HACER CON ESTO. Un pedido se confirma una sola vez. Sin
 * ese freno, alguien podría llamar a esta función mil veces con el mismo
 * pedido y usarla para bombardear el mail del cliente. Por eso la función
 * anota cuándo mandó, y si ya mandó, no manda de nuevo.
 *
 * SIN SECRETOS NO HACE NADA. Si el local no configuró el SMTP, contesta que
 * no está configurada y la compra sigue igual. El mail es un extra, no una
 * parte de la que dependa que el pedido entre.
 *
 * POR QUÉ NO PIDE JWT. La llama la tienda, donde el cliente no tiene cuenta.
 * Lo que la protege es el freno de arriba: un pedido, un mail, y sólo si el
 * pedido es de hace menos de dos horas.
 *
 * CÓMO SE CONFIGURA (Supabase → Edge Functions → Secrets):
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      465
 *   SMTP_USER      el mail del local
 *   SMTP_PASS      contraseña de aplicación (no la del mail)
 *   SMTP_DESDE     "Mistral Ensenada <elmail@gmail.com>"
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOST = Deno.env.get("SMTP_HOST") || "";
const PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const USER = Deno.env.get("SMTP_USER") || "";
const PASS = Deno.env.get("SMTP_PASS") || "";
const DESDE = Deno.env.get("SMTP_DESDE") || USER;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const VENTANA_HORAS = 2;
/** Suficiente para descartar lo que claramente no es un mail, sin pelearse
 *  con las direcciones raras que igual existen. */
const MAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;

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

const pesos = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

function escapar(texto: unknown) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function armarMail(pedido: Record<string, any>, cfg: Record<string, any>) {
  const dir = cfg?.direccion || {};
  const nombreLocal = "Mistral Ensenada";
  const filas = (Array.isArray(pedido.items) ? pedido.items : [])
    .map(
      (i: Record<string, unknown>) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eceef4">
            <strong style="color:#132457">${escapar(i.name)}</strong><br>
            <span style="color:#787b85;font-size:13px">Talle ${escapar(i.size)} · ${Number(i.quantity) || 0} ${
              (Number(i.quantity) || 0) === 1 ? "unidad" : "unidades"
            }</span>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #eceef4;white-space:nowrap">
            ${pesos((Number(i.price) || 0) * (Number(i.quantity) || 0))}
          </td>
        </tr>`,
    )
    .join("");

  const entrega =
    pedido.delivery === "shipping"
      ? `Envío a ${escapar(pedido.zone)}`
      : `Retiro en ${escapar(dir.calle)}, ${escapar(dir.ciudad)}`;

  const html = `<!doctype html>
<html lang="es-AR"><body style="margin:0;background:#f5f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 18px">
    <div style="background:#132457;color:#fff;padding:26px 24px;border-radius:9px 9px 0 0">
      <div style="font-size:19px;font-weight:700;letter-spacing:3px">MISTRAL</div>
      <div style="font-size:11px;letter-spacing:2px;opacity:.75">ENSENADA</div>
    </div>
    <div style="background:#fff;padding:28px 24px;border-radius:0 0 9px 9px">
      <h1 style="margin:0 0 6px;font-size:21px;color:#132457">Recibimos tu pedido</h1>
      <p style="margin:0 0 22px;color:#787b85;font-size:14px;line-height:1.6">
        ${escapar(pedido.customer)}, las prendas quedaron reservadas a tu nombre.
        Pedido <strong style="color:#132457">${escapar(pedido.id)}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#132457">
        ${filas}
        ${
          Number(pedido.envio)
            ? `<tr><td style="padding:10px 0;color:#787b85">Envío</td>
               <td align="right" style="padding:10px 0">${pesos(pedido.envio)}</td></tr>`
            : ""
        }
        <tr>
          <td style="padding:14px 0 0;font-weight:700">Total</td>
          <td align="right" style="padding:14px 0 0;font-weight:700;font-size:17px">${pesos(pedido.total)}</td>
        </tr>
      </table>
      <p style="margin:22px 0 0;color:#787b85;font-size:14px;line-height:1.6">
        <strong style="color:#132457">${entrega}</strong><br>
        ${
          pedido.payment_status === "aprobado"
            ? "Tu pago está acreditado."
            : "El pago lo coordinamos por WhatsApp. Todavía no se cobró nada."
        }
      </p>
      <p style="margin:22px 0 0;color:#787b85;font-size:13px;line-height:1.6">
        Tenés 10 días para arrepentirte de la compra, y el envío de vuelta lo
        pagamos nosotros. Si algo no era lo que esperabas, escribinos.
      </p>
      ${
        cfg?.whatsapp
          ? `<p style="margin:24px 0 0"><a href="https://wa.me/${escapar(cfg.whatsapp)}"
               style="display:inline-block;background:#132457;color:#fff;text-decoration:none;padding:12px 20px;border-radius:5px;font-size:14px">
               Escribinos por WhatsApp</a></p>`
          : ""
      }
      <p style="margin:26px 0 0;color:#a3a7b3;font-size:12px;line-height:1.6">
        ${nombreLocal} · ${escapar(dir.calle)}, ${escapar(dir.ciudad)}, ${escapar(dir.provincia)} (CP ${escapar(dir.cp)})
      </p>
    </div>
  </div>
</body></html>`;

  const texto = [
    `Recibimos tu pedido ${pedido.id}.`,
    "",
    ...(Array.isArray(pedido.items) ? pedido.items : []).map(
      (i: Record<string, unknown>) =>
        `- ${i.name} · Talle ${i.size} x${i.quantity} — ${pesos(
          (Number(i.price) || 0) * (Number(i.quantity) || 0),
        )}`,
    ),
    ...(Number(pedido.envio) ? [`Envío: ${pesos(pedido.envio)}`] : []),
    `Total: ${pesos(pedido.total)}`,
    "",
    pedido.delivery === "shipping"
      ? `Envío a ${pedido.zone}`
      : `Retiro en ${dir.calle}, ${dir.ciudad}`,
    "",
    "Tenés 10 días para arrepentirte de la compra y el envío de vuelta lo pagamos nosotros.",
  ].join("\n");

  return { html, texto };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);

  if (!HOST || !USER || !PASS)
    return responder({
      error: "El mail de confirmación todavía no está configurado.",
      detalle: "Faltan los secretos SMTP_HOST, SMTP_USER y SMTP_PASS.",
    }, 503);

  let pedidoId = "";
  let mail = "";
  try {
    const cuerpo = await req.json();
    pedidoId = String(cuerpo?.pedido || "").trim().slice(0, 40);
    mail = String(cuerpo?.email || "").trim().slice(0, 120).toLowerCase();
  } catch {
    return responder({ error: "No entendí el pedido." }, 400);
  }
  if (!pedidoId) return responder({ error: "Falta el número de pedido." }, 400);
  if (mail && !MAIL.test(mail))
    return responder({ error: "Ese mail no parece un mail." }, 400);

  try {
    const filas = await base(
      `orders?id=eq.${encodeURIComponent(pedidoId)}&select=*`,
    );
    const pedido = Array.isArray(filas) ? filas[0] : null;
    if (!pedido) return responder({ error: "No encontramos ese pedido." }, 404);

    // Un pedido se confirma una sola vez.
    if (pedido.mail_enviado_at)
      return responder({ ok: true, yaEstaba: true });

    const edad = Date.now() - new Date(pedido.fecha).getTime();
    if (edad > VENTANA_HORAS * 3600_000)
      return responder({ error: "Ese pedido es de hace rato." }, 409);

    const destino = mail || pedido.email || "";
    if (!destino) return responder({ error: "Ese pedido no tiene mail." }, 400);

    const cfgFilas = await base("settings?id=eq.local&select=datos");
    const cfg = (Array.isArray(cfgFilas) ? cfgFilas[0]?.datos : {}) || {};

    const { html, texto } = armarMail({ ...pedido, email: destino }, cfg);

    const cliente = new SMTPClient({
      connection: {
        hostname: HOST,
        port: PORT,
        tls: PORT === 465,
        auth: { username: USER, password: PASS },
      },
    });
    await cliente.send({
      from: DESDE,
      to: destino,
      subject: `Tu pedido ${pedido.id} — Mistral Ensenada`,
      content: texto,
      html,
    });
    await cliente.close();

    // Recién ahora se anota: si el envío falla, se puede reintentar.
    await base(`orders?id=eq.${encodeURIComponent(pedido.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email: destino,
        mail_enviado_at: new Date().toISOString(),
      }),
    });

    return responder({ ok: true });
  } catch (err) {
    console.error("enviar-mail falló", err);
    return responder({
      error: "No pudimos mandar el mail. El pedido entró igual.",
    }, 500);
  }
});
