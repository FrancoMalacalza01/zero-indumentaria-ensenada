// Prueba de `payway-anular` con Supabase y Payway SIMULADOS: no toca la base ni devuelve plata.
// Lo central: sólo un admin puede anular; sólo se anula un pago aprobado por Payway; nunca se
// da por devuelta una plata que Payway no confirmó; y dos anulaciones a la vez no pasan las dos.
//
//   deno run --allow-env --allow-net=x.supabase.co --no-check supabase/functions/payway-anular/prueba.ts
Deno.env.set("SUPABASE_URL", "https://x.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.set("PAYWAY_PRIVATE_API_KEY", "PRIVADA");
let handler: (r: Request) => Promise<Response> = async () => new Response("");
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: any) => { handler = h; };
await import("./index.ts");

type Fila = Record<string, unknown>;
const ADMIN = "11111111-1111-1111-1111-111111111111";
const CLIENTE = "22222222-2222-2222-2222-222222222222";
let pedidos: Record<string, Fila> = {};
let llamadas: { url: string; apikey: string | null; cuerpo: string }[] = [];
let payway: () => Response | Promise<Response> = () => new Response("{}");
const realFetch = globalThis.fetch;
globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = String(entrada);
  if (url.includes("payway.com.ar")) {
    llamadas.push({ url, apikey: new Headers(init?.headers).get("apikey"), cuerpo: String(init?.body) });
    return await payway();
  }
  if (url === "https://x.supabase.co/auth/v1/user") {
    const t = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "");
    if (t === "jwt-admin") return Response.json({ id: ADMIN });
    if (t === "jwt-cliente") return Response.json({ id: CLIENTE });
    return new Response("{}", { status: 401 }); // la clave pública de la tienda no es un usuario
  }
  if (url.startsWith("https://x.supabase.co/rest/v1/admins")) {
    return Response.json(new URL(url).searchParams.get("user_id") === `eq.${ADMIN}` ? [{ user_id: ADMIN }] : []);
  }
  if (url.startsWith("https://x.supabase.co/rest/v1/orders")) {
    const u = new URL(url);
    const id = (u.searchParams.get("id") || "").replace("eq.", "");
    const p = pedidos[id];
    if ((init?.method || "GET") === "GET") return Response.json(p ? [p] : []);
    const ps = u.searchParams.get("payment_status");
    if (ps && p?.payment_status !== ps.replace("eq.", "")) return Response.json([]);
    const pr = u.searchParams.get("pago_ref");
    if (pr && p?.pago_ref !== decodeURIComponent(pr.replace("eq.", ""))) return Response.json([]);
    if (!p) return Response.json([]);
    Object.assign(p, JSON.parse(String(init?.body)));
    return JSON.stringify(init?.headers).includes("representation") ? Response.json([{ id }]) : new Response(null, { status: 204 });
  }
  return realFetch(entrada, init);
}) as typeof fetch;

const pagado = (extra: Fila = {}): Fila => ({ id: "M-00007", payment_status: "aprobado", pago_ref: "payway:15523975", ...extra });
const llamar = async (cuerpo: unknown, jwt = "jwt-admin") => {
  const r = await handler(new Request("https://x/functions/v1/payway-anular", {
    method: "POST", headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}, body: JSON.stringify(cuerpo),
  }));
  return { status: r.status, datos: await r.json() };
};
let fallos = 0;
const chk = (n: string, c: unknown) => { console.log(c ? "OK  " : "FAIL", n); if (!c) fallos++; };
const ped = { pedido: "M-00007" };

// quién puede
pedidos = { "M-00007": pagado() }; llamadas = [];
chk("sin sesión: 403", (await llamar(ped, "")).status === 403);
chk("con la clave pública de la tienda: 403", (await llamar(ped, "sb_publishable_xxx")).status === 403);
chk("un usuario que NO es admin: 403", (await llamar(ped, "jwt-cliente")).status === 403);
chk("y a Payway no llegó nada ni se tocó el pedido", llamadas.length === 0 && pedidos["M-00007"].payment_status === "aprobado");

// anulación confirmada
payway = () => Response.json({ id: 99, status: "annulled" });
let r = await llamar(ped);
chk("admin + Payway confirma: anulado", r.datos.estado === "anulado");
chk("el pedido queda devuelto", pedidos["M-00007"].payment_status === "devuelto");
chk("llamó a /payments/15523975/refunds con la clave PRIVADA y cuerpo vacío",
  llamadas[0].url.endsWith("/api/v2/payments/15523975/refunds") && llamadas[0].apikey === "PRIVADA" && llamadas[0].cuerpo === "{}");
pedidos = { "M-00007": pagado() }; llamadas = [];
await llamar({ pedido: "M-00007", payment_id: "999", pago_ref: "payway:999" });
chk("el id del pago sale de la base, no del panel", llamadas.length === 1 && llamadas[0].url.includes("/payments/15523975/refunds"));
llamadas = [];
chk("recién anulado: no se anula de nuevo (409) y no llega a Payway", (await llamar(ped)).status === 409 && llamadas.length === 0);

// qué pedidos se pueden anular
pedidos = { "M-00007": pagado({ pago_ref: "98765" }) }; llamadas = [];
chk("pagado por Mercado Pago: no se anula acá (409)", (await llamar(ped)).status === 409 && llamadas.length === 0);
pedidos = { "M-00007": pagado({ payment_status: "sin_pago" }) };
chk("sin pagar: 409", (await llamar(ped)).status === 409);
pedidos = { "M-00007": pagado({ payment_status: "devuelto" }) };
chk("ya devuelto: 409 y no llega a Payway", (await llamar(ped)).status === 409 && llamadas.length === 0);
chk("pedido inexistente: 404", (await llamar({ pedido: "M-99999" })).status === 404);

// Payway no confirma: NO se da por devuelta
for (const [nombre, resp, esperado] of [
  ["rechaza (lote cerrado)", () => Response.json({ error: "x" }, { status: 409 }), "rechazado"],
  ["contesta sin confirmar", () => Response.json({ id: 1, status: "approved" }), "incierto"],
  ["credenciales mal", () => Response.json({}, { status: 401 }), "error"],
  ["se cae", () => new Response("", { status: 500 }), "error"],
] as const) {
  pedidos = { "M-00007": pagado() }; payway = resp;
  r = await llamar(ped);
  chk(`${nombre}: ${esperado} y el pedido vuelve a aprobado`, r.datos.estado === esperado && pedidos["M-00007"].payment_status === "aprobado");
}
pedidos = { "M-00007": pagado() }; payway = () => { throw new Error("timeout"); };
r = await llamar(ped);
chk("sin respuesta: incierto, avisa que revise en Payway y vuelve a aprobado",
  r.datos.estado === "incierto" && /backoffice/.test(r.datos.mensaje) && pedidos["M-00007"].payment_status === "aprobado");

// dos anulaciones a la vez
pedidos = { "M-00007": pagado() }; llamadas = [];
let liberar: (x: Response) => void = () => {};
payway = () => new Promise<Response>((ok) => { liberar = ok; });
const a = llamar(ped);
await new Promise((ok) => setTimeout(ok, 20));
const b = await llamar(ped);
chk("dos anulaciones a la vez: la segunda se frena (409) y Payway recibe UNA", b.status === 409 && llamadas.length === 1);
liberar(Response.json({ id: 5, status: "annulled" }));
chk("la primera termina bien", (await a).datos.estado === "anulado");

console.log(fallos ? `\n${fallos} FALLOS` : "\ntodo bien");
Deno.exit(fallos ? 1 : 0);
