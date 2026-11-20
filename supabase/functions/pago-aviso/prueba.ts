// Prueba de `pago-aviso` y `crear-pago` con Supabase y Mercado Pago SIMULADOS: no toca la base ni cobra nada.
// Cubre: el aviso no marca pagado un monto distinto, no pisa un pago aprobado con un rechazo tardío, sí deja
// pasar una devolución; y `crear-pago` no arma nada sin el código de pago del pedido.
//
//   deno run --allow-env --allow-net=x.supabase.co,api.mercadopago.com --no-check supabase/functions/pago-aviso/prueba.ts
Deno.env.set("SUPABASE_URL", "https://x.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.set("MP_ACCESS_TOKEN", "MP");
// deno-lint-ignore no-explicit-any
const manejadores: Record<string, (r: Request) => Promise<Response>> = {};
let actual = "";
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: any) => { manejadores[actual] = h; };
actual = "aviso"; await import("../pago-aviso/index.ts");
actual = "crear"; await import("../crear-pago/index.ts");

type Fila = Record<string, unknown>;
let pedidos: Record<string, Fila> = {};
let pagoMP: Record<string, unknown> = {};
let preferencias = 0;
globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = String(entrada);
  if (url.startsWith("https://api.mercadopago.com/v1/payments/")) return Response.json(pagoMP);
  if (url === "https://api.mercadopago.com/checkout/preferences") { preferencias++; return Response.json({ init_point: "https://mp/pagar" }); }
  if (url.startsWith("https://x.supabase.co/rest/v1/orders")) {
    const id = (new URL(url).searchParams.get("id") || "").replace("eq.", "");
    const p = pedidos[id];
    if ((init?.method || "GET") === "GET") return Response.json(p ? [p] : []);
    if (p) Object.assign(p, JSON.parse(String(init!.body)));
    return new Response(null, { status: 204 });
  }
  throw new Error("llamada inesperada: " + url);
}) as typeof fetch;

const nuevo = (extra: Fila = {}): Fila => ({ id: "M-00007", total: 35900, envio: 0, items: [{ productId: "a", name: "Remera", size: "M", quantity: 1, price: 35900 }], fecha: new Date().toISOString(), status: "Pendiente", payment_status: "sin_pago", customer: "Ana", pago_token: "a".repeat(64), ...extra });
const aviso = () => manejadores.aviso(new Request("https://x/functions/v1/pago-aviso?data.id=123&type=payment", { method: "POST", body: "{}" }));
const pagar = (cuerpo: unknown) => manejadores.crear(new Request("https://x/functions/v1/crear-pago", { method: "POST", body: JSON.stringify(cuerpo) }));
let fallos = 0;
const chk = (n: string, c: unknown) => { console.log(c ? "OK  " : "FAIL", n); if (!c) fallos++; };

// aviso: monto
pedidos = { "M-00007": nuevo() };
pagoMP = { status: "approved", external_reference: "M-00007", transaction_amount: 100 };
await aviso();
chk("aprobado por un monto distinto al del pedido: NO se marca pagado", pedidos["M-00007"].payment_status === "sin_pago");
pagoMP = { status: "approved", external_reference: "M-00007", transaction_amount: 35900 };
await aviso();
chk("aprobado por el monto exacto: pagado y en Preparando", pedidos["M-00007"].payment_status === "aprobado" && pedidos["M-00007"].status === "Preparando");

// aviso: no pisar un pago aprobado
pagoMP = { status: "rejected", external_reference: "M-00007", transaction_amount: 35900 };
await aviso();
chk("un aviso rechazado tardío no pisa un pago aprobado", pedidos["M-00007"].payment_status === "aprobado");
pagoMP = { status: "refunded", external_reference: "M-00007", transaction_amount: 35900 };
await aviso();
chk("una devolución sí cambia un pago aprobado", pedidos["M-00007"].payment_status === "devuelto");
pagoMP = { status: "approved", external_reference: "M-00007", transaction_amount: 35900 };
await aviso();
chk("un pedido devuelto no vuelve a aprobado", pedidos["M-00007"].payment_status === "devuelto");
pagoMP = { status: "approved", external_reference: "M-99999", transaction_amount: 1 };
chk("un pedido inexistente no rompe nada", (await aviso()).status === 200);

// crear-pago: código de pago
pedidos = { "M-00007": nuevo() }; preferencias = 0;
let r = await pagar({ pedido: "M-00007" });
chk("sin código de pago: 404 y no se arma ninguna preferencia", r.status === 404 && preferencias === 0);
r = await pagar({ pedido: "M-00007", codigoPago: "b".repeat(64) });
chk("código equivocado: 404, igual que un pedido inexistente", r.status === 404 && preferencias === 0);
r = await pagar({ pedido: "M-99999", codigoPago: "a".repeat(64) });
chk("pedido inexistente: 404", r.status === 404);
r = await pagar({ pedido: "M-00007", codigoPago: "a".repeat(64) });
chk("con el código del pedido: arma el link de pago", r.status === 200 && preferencias === 1 && (await r.json()).url === "https://mp/pagar");

console.log(fallos ? `\n${fallos} FALLOS` : "\ntodo bien");
Deno.exit(fallos ? 1 : 0);
