// Prueba de la función `payway-pagar` con Supabase y Payway SIMULADOS: no toca la
// base ni cobra nada. Cubre los casos que importan con plata: aprobado, rechazado,
// doble cobro a la vez, estados raros (no se dan por pagados), credenciales mal,
// falta de respuesta y entradas inválidas.
//
//   deno run --allow-env --allow-net=x.supabase.co --no-check supabase/functions/payway-pagar/prueba.ts
//
// Necesita Deno (https://deno.com). `--no-check` porque el paquete de tipos de
// Supabase no se resuelve fuera de su entorno; los tipos de la función se revisan
// aparte con `deno check`.
// Prueba la función con Supabase y Payway simulados.
Deno.env.set("SUPABASE_URL", "https://x.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.set("PAYWAY_PRIVATE_API_KEY", "PRIVADA");
let handler: (r: Request) => Promise<Response> = async () => new Response("");
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: any) => { handler = h; };
await import("./index.ts");

type Fila = Record<string, unknown>;
let pedidos: Record<string, Fila> = {};
let llamadasPayway: { url: string; apikey: string | null; cuerpo: Record<string, unknown> }[] = [];
let paywayRespuesta: () => Response | Promise<Response> = () => new Response("{}");
const realFetch = globalThis.fetch;
globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = String(entrada);
  const cuerpo = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.includes("payway.com.ar")) {
    llamadasPayway.push({ url, apikey: new Headers(init?.headers).get("apikey"), cuerpo });
    return await paywayRespuesta();
  }
  if (url.startsWith("https://x.supabase.co/rest/v1/orders")) {
    const u = new URL(url);
    const id = (u.searchParams.get("id") || "").replace("eq.", "");
    const p = pedidos[id];
    if ((init?.method || "GET") === "GET") return Response.json(p ? [p] : []);
    // PATCH con filtros: payment_status=in.(..) y/o pago_ref=eq.X
    const ps = u.searchParams.get("payment_status");
    if (ps && !(ps.replace("in.(", "").replace(")", "").split(",").includes(String(p?.payment_status)))) return Response.json([]);
    const pr = u.searchParams.get("pago_ref");
    if (pr && p?.pago_ref !== pr.replace("eq.", "")) return Response.json([]);
    if (!p) return Response.json([]);
    Object.assign(p, cuerpo);
    return init?.headers && JSON.stringify(init.headers).includes("representation") ? Response.json([{ id }]) : new Response(null, { status: 204 });
  }
  return realFetch(entrada, init);
}) as typeof fetch;

const nuevo = (extra: Fila = {}): Fila => ({ id: "M-00007", total: 35900, fecha: new Date().toISOString(), status: "Nuevo", payment_status: "sin_pago", pago_ref: null, ...extra });
const llamar = async (cuerpo: unknown) => {
  const r = await handler(new Request("https://x/functions/v1/payway-pagar", { method: "POST", body: JSON.stringify(cuerpo) }));
  return { status: r.status, datos: await r.json() };
};
const TOKEN = "4f7c2d1e-aaaa-bbbb-cccc-123456789012";
const valido = { pedido: "M-00007", token: TOKEN, bin: "450799", medio: 1 };
let fallos = 0;
const chk = (n: string, c: unknown) => { console.log(c ? "OK  " : "FAIL", n); if (!c) fallos++; };

// 1) aprobado
pedidos = { "M-00007": nuevo() }; llamadasPayway = [];
paywayRespuesta = () => Response.json({ id: 15523975, status: "approved", status_details: { error: null } });
let r = await llamar(valido);
chk("aprobado: responde aprobado", r.datos.estado === "aprobado");
chk("aprobado: el pedido queda pagado y en Preparando", pedidos["M-00007"].payment_status === "aprobado" && pedidos["M-00007"].status === "Preparando");
chk("aprobado: guarda el id del pago de Payway", pedidos["M-00007"].pago_ref === "payway:15523975");
chk("cobró con la clave PRIVADA, a /payments", llamadasPayway[0].apikey === "PRIVADA" && llamadasPayway[0].url.endsWith("/api/v2/payments"));
chk("el monto sale de la base (35900 -> 3590000 centavos)", llamadasPayway[0].cuerpo.amount === 3590000 && llamadasPayway[0].cuerpo.currency === "ARS" && llamadasPayway[0].cuerpo.installments === 1);
chk("el cuerpo no lleva datos de tarjeta, sólo el token", llamadasPayway[0].cuerpo.token === TOKEN && !("card_data" in llamadasPayway[0].cuerpo));
chk("el identificador de operación es alfanumérico", /^[A-Za-z0-9]{1,40}$/.test(String(llamadasPayway[0].cuerpo.site_transaction_id)));

// 2) el navegador no puede cambiar el monto
pedidos = { "M-00007": nuevo() }; llamadasPayway = [];
paywayRespuesta = () => Response.json({ id: 1, status: "approved" });
await llamar({ ...valido, total: 1, amount: 1, monto: 1 });
chk("un monto mandado por el navegador se ignora", llamadasPayway[0].cuerpo.amount === 3590000);

// 3) rechazado: 402 con motivo
pedidos = { "M-00007": nuevo() }; llamadasPayway = [];
paywayRespuesta = () => Response.json({ id: 9, status: "rejected", status_details: { error: { reason: { id: 51 } } } }, { status: 402 });
r = await llamar(valido);
chk("rechazado: mensaje de fondos insuficientes", r.datos.estado === "rechazado" && /fondos/i.test(r.datos.mensaje));
chk("rechazado: el pedido queda rechazado y NO pasa a Preparando", pedidos["M-00007"].payment_status === "rechazado" && pedidos["M-00007"].status === "Nuevo");
paywayRespuesta = () => Response.json({ id: 10, status: "approved" });
r = await llamar(valido);
chk("después de un rechazo se puede reintentar y cobrar", r.datos.estado === "aprobado" && pedidos["M-00007"].payment_status === "aprobado");

// 4) doble cobro
chk("un pedido ya pagado no se cobra de nuevo", (await llamar(valido)).status === 409);
pedidos = { "M-00007": nuevo() }; llamadasPayway = [];
let liberar: (r: Response) => void = () => {};
paywayRespuesta = () => new Promise<Response>((ok) => { liberar = ok; });
const a = llamar(valido);
await new Promise((ok) => setTimeout(ok, 20));
const b = await llamar(valido);
chk("dos cobros a la vez: el segundo se frena (409) y Payway recibe UNA sola llamada", b.status === 409 && llamadasPayway.length === 1);
liberar(Response.json({ id: 77, status: "approved" }));
chk("el primero termina bien", (await a).datos.estado === "aprobado");

// 5) estados raros: NO se da por pagado
pedidos = { "M-00007": nuevo() };
paywayRespuesta = () => Response.json({ id: 5, status: "review" });
r = await llamar(valido);
chk("review: queda pendiente, no pagado, y no se puede volver a cobrar solo", r.datos.estado === "pendiente" && pedidos["M-00007"].payment_status === "pendiente" && (await llamar(valido)).status === 409);

// 6) credenciales mal: no hubo cobro, el pedido vuelve a poder pagarse
pedidos = { "M-00007": nuevo() };
paywayRespuesta = () => Response.json({ error: "Invalid authentication credentials" }, { status: 401 });
r = await llamar(valido);
chk("401 de Payway: error genérico, sin filtrar detalles técnicos", r.datos.estado === "error" && !/apikey|credentials|401/i.test(r.datos.mensaje));
chk("y el pedido vuelve a sin_pago", pedidos["M-00007"].payment_status === "sin_pago" && pedidos["M-00007"].pago_ref === null);

// 7) sin respuesta de Payway: puede haber cobrado, no se reintenta
pedidos = { "M-00007": nuevo() };
paywayRespuesta = () => { throw new Error("timeout"); };
r = await llamar(valido);
chk("sin respuesta: queda pendiente y avisa que no lo repita", r.datos.estado === "pendiente" && /no lo repitas/.test(r.datos.mensaje) && pedidos["M-00007"].payment_status === "pendiente");

// 8) validaciones de entrada
llamadasPayway = []; pedidos = { "M-00007": nuevo() };
chk("sin token: 400", (await llamar({ ...valido, token: "x" })).status === 400);
chk("bin roto: 400", (await llamar({ ...valido, bin: "12" })).status === 400);
chk("medio no permitido: 400", (await llamar({ ...valido, medio: 15 })).status === 400);
chk("pedido inexistente: 404", (await llamar({ ...valido, pedido: "M-99999" })).status === 404);
pedidos = { "M-00007": nuevo({ status: "Cancelado" }) };
chk("pedido cancelado: 409", (await llamar(valido)).status === 409);
pedidos = { "M-00007": nuevo({ fecha: new Date(Date.now() - 3 * 3600_000).toISOString() }) };
chk("pedido de hace 3 horas: 409", (await llamar(valido)).status === 409);
pedidos = { "M-00007": nuevo({ total: 0 }) };
chk("pedido sin monto válido: 409", (await llamar(valido)).status === 409);
chk("nada de eso llegó a Payway", llamadasPayway.length === 0);

console.log(fallos ? `\n${fallos} FALLOS` : "\ntodo bien");
Deno.exit(fallos ? 1 : 0);
