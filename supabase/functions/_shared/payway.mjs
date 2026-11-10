// Cobro con tarjeta por Payway, modelo NO PCI.
//
// El navegador manda los datos de la tarjeta DIRECTO a Payway (POST /tokens, con
// la clave pública) y recibe un token. A nuestro servidor sólo llega ese token:
// el número de tarjeta no pasa por acá. El servidor cobra con el token
// (POST /payments, con la clave privada) el monto que dice el pedido en la base.
//
// Esto es la parte pura, sin red, para probarla: la usan la función del servidor
// (`supabase/functions/payway-pagar`) y la tienda (el formulario).
// Documentación: https://docs.payway.com.ar/docs/ventas-online

/** Entorno de pruebas. */
export const ENTORNO_SANDBOX = "https://developers-ventasonline.payway.com.ar/api/v2";
/**
 * Producción. Payway no la habilita (ni da las claves productivas) hasta aprobar los
 * casos de prueba en Sandbox. Al pasar, sólo cambian las claves y esta dirección.
 */
export const ENTORNO_PRODUCCION = "https://ventasonline.payway.com.ar/api/v2";

/**
 * Medios de pago que se ofrecen. Los ids son los de la tabla de pruebas de Payway
 * (Visa crédito 1, Visa débito 31). Para sumar otro (Mastercard, Cabal…) se agrega
 * acá con el id de "Medios de pago disponibles" de la documentación: no se adivinan.
 */
export const MEDIOS = Object.freeze([
  Object.freeze({ id: 1, nombre: "Visa crédito" }),
  Object.freeze({ id: 31, nombre: "Visa débito" }),
]);

export const medioValido = (id) => MEDIOS.some((m) => m.id === Number(id));

/**
 * Sólo se aceptan direcciones https de Payway: es adonde viajan los datos de la
 * tarjeta, y no pueden ir a ningún otro lado aunque alguien cambie la configuración.
 * Devuelve la dirección sin la barra final, o "" si no sirve.
 */
export function urlPaywayValida(valor) {
  try {
    const u = new URL(String(valor || "").trim());
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || u.username || u.password) return "";
    if (host !== "payway.com.ar" && !host.endsWith(".payway.com.ar")) return "";
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Número de tarjeta plausible: 13 a 19 dígitos y dígito verificador (Luhn). */
export function tarjetaValida(numero) {
  const d = soloDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
  }
  return suma % 10 === 0;
}

/** Los primeros 6 dígitos: Payway los pide aparte. */
export const binDe = (numero) => soloDigitos(numero).slice(0, 6);

/**
 * "12/29" o "12/2029" -> { mes: "12", anio: "29" }, o null si no es una fecha o ya venció.
 * Una tarjeta vale hasta el último día de su mes.
 */
export function vencimiento(texto, ahora = new Date()) {
  const m = String(texto || "").trim().match(/^(\d{1,2})\s*[/\-]\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const mes = Number(m[1]);
  let anio = Number(m[2]);
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12) return null;
  if (anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1)) return null;
  return { mes: String(mes).padStart(2, "0"), anio: String(anio % 100).padStart(2, "0") };
}

export const codigoValido = (cvv) => /^\d{3,4}$/.test(String(cvv || "").trim());
export const dniValido = (dni) => /^\d{7,8}$/.test(soloDigitos(dni)) && soloDigitos(dni) === String(dni).trim();

/**
 * Lo que se le manda a Payway para sacar el token. Lo arma el navegador, directo a
 * Payway: nunca viaja a nuestro servidor.
 */
export function cuerpoDeToken({ numero, vencimiento: v, codigo, titular, dni }) {
  return {
    card_number: soloDigitos(numero),
    card_expiration_month: v.mes,
    card_expiration_year: v.anio,
    security_code: String(codigo).trim(),
    card_holder_name: String(titular).trim().slice(0, 60),
    card_holder_identification: { type: "dni", number: soloDigitos(dni) },
  };
}

/**
 * Identificador único de la operación (alfanumérico, hasta 40). Cada intento lleva
 * el suyo: un pago rechazado no se reintenta con el mismo, y así tampoco se cobra dos veces.
 */
export function idTransaccion(pedidoId, ahora = Date.now()) {
  const base = String(pedidoId || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
  return `${base}T${Math.floor(ahora).toString(36)}`.slice(0, 40);
}

/** El importe va en centavos, como entero. Devuelve 0 si el monto no sirve. */
export function centavos(totalEnPesos) {
  const n = Math.round(Number(totalEnPesos) * 100);
  return Number.isSafeInteger(n) && n > 0 && String(n).length <= 12 ? n : 0;
}

/** El cuerpo de POST /payments (modelo NO PCI, pago simple, una cuota). */
export function cuerpoDePago({ idTransaccion: id, token, medio, bin, total, descripcion = "" }) {
  return {
    site_transaction_id: id,
    token,
    payment_method_id: Number(medio),
    bin: String(bin),
    amount: centavos(total),
    currency: "ARS",
    installments: 1,
    payment_type: "single",
    sub_payments: [],
    ...(descripcion ? { description: String(descripcion).slice(0, 255) } : {}),
  };
}

const MOTIVOS = {
  51: "La tarjeta no tiene fondos suficientes.",
  5: "El banco denegó la tarjeta.",
  4: "El banco denegó la tarjeta.",
  7: "El banco pide que lo llames antes de usar la tarjeta.",
  14: "La tarjeta no es válida.",
  54: "La tarjeta está vencida.",
  61: "El pago excede el límite de la tarjeta.",
  65: "El pago excede el límite de la tarjeta.",
  45: "Esta tarjeta no permite pagar en cuotas.",
  48: "Esa cantidad de cuotas no está permitida.",
  77: "Esa cantidad de cuotas no está permitida.",
  28: "El servicio del banco no está disponible ahora. Probá de nuevo en unos minutos.",
  91: "El banco no responde ahora. Probá de nuevo en unos minutos.",
  96: "Hubo un problema con el servicio. Probá de nuevo en unos minutos.",
  97: "Hubo un problema con el servicio. Probá de nuevo en unos minutos.",
};
export const mensajeDeRechazo = (id) =>
  MOTIVOS[Number(id)] || "El banco rechazó el pago. Probá con otra tarjeta o escribinos.";

/**
 * Lo que dijo Payway, en lo que necesita el pedido.
 * `estado`: "aprobado" | "rechazado" | "pendiente" | "error".
 *  - aprobado/rechazado: lo dice Payway en `status`.
 *  - pendiente: Payway contestó otra cosa (por ejemplo "review", en revisión, o
 *    "preapproved") y no sabemos cómo quedó: NO se da por pagado.
 *  - error: no se pudo ni preguntar (credenciales, formato, token vencido…).
 * El navegador sólo ve `estado` y `mensaje`: nunca los estados técnicos de Payway.
 */
export function interpretarPago(httpStatus, cuerpo) {
  const c = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const paymentId = c.id != null ? String(c.id) : "";
  const razon = c.status_details?.error?.reason?.id ?? null;
  const status = String(c.status || "").toLowerCase();
  if (status === "approved") return { estado: "aprobado", paymentId, codigo: null, mensaje: "Pago aprobado." };
  if (status === "rejected" || httpStatus === 402)
    return { estado: "rechazado", paymentId, codigo: razon, mensaje: mensajeDeRechazo(razon) };
  if (httpStatus >= 200 && httpStatus < 300 && status)
    return { estado: "pendiente", paymentId, codigo: null, mensaje: "Estamos confirmando tu pago. Te avisamos por WhatsApp apenas lo veamos." };
  return {
    estado: "error",
    paymentId: "",
    codigo: null,
    mensaje: "No pudimos procesar el pago. Revisá los datos de la tarjeta, o escribinos por WhatsApp.",
  };
}

/**
 * El id del pago de Payway que guardamos en `pago_ref` ("payway:15523975"), o "" si el
 * pedido no se pagó por Payway. Es lo que se usa para anular: sólo dígitos, porque va
 * dentro de la dirección.
 */
export const idDePagoDe = (pagoRef) => /^payway:(\d{1,20})$/.exec(String(pagoRef || ""))?.[1] ?? "";

/** La dirección para anular un pago: `/payments/{payment_id}/refunds`. "" si algo no sirve. */
export function urlDeAnulacion(base, paymentId) {
  const url = urlPaywayValida(base);
  return url && /^\d{1,20}$/.test(String(paymentId)) ? `${url}/payments/${paymentId}/refunds` : "";
}

// Estados con los que Payway describe un pago que ya no está vigente. "approved" NO está:
// un pago anulado que sigue diciendo "approved" es justo lo que no hay que dar por hecho.
const ANULADOS = new Set([
  "annulled",
  "annulment_approved",
  "cancelled",
  "canceled",
  "refunded",
  "refunded_approved",
  "approved_with_refund",
]);

/**
 * Lo que dijo Payway al anular un pago, para el panel.
 *  - anulado: Payway lo confirma con un estado de pago anulado/devuelto.
 *  - rechazado: Payway contestó que no (por ejemplo, ya se cerró el lote).
 *  - incierto: contestó bien pero sin un estado que confirme la anulación. NO se da por
 *    anulado: se revisa en el backoffice de Payway antes de repetir.
 *  - error: no se pudo ni preguntar (credenciales, caída).
 * Esto lo ve el dueño, no el cliente.
 */
export function interpretarAnulacion(httpStatus, cuerpo) {
  const c = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const status = String(c.status || "").toLowerCase();
  if (httpStatus >= 200 && httpStatus < 300) {
    if (ANULADOS.has(status)) return { estado: "anulado", mensaje: "Pago anulado en Payway." };
    return {
      estado: "incierto",
      mensaje:
        "Payway contestó, pero no pudimos confirmar que el pago quedó anulado. Revisalo en el backoffice de Payway antes de repetir.",
    };
  }
  if (httpStatus === 401 || httpStatus === 403)
    return { estado: "error", mensaje: "Payway no aceptó la clave. Revisá las credenciales cargadas en Supabase." };
  if (httpStatus >= 400 && httpStatus < 500)
    return {
      estado: "rechazado",
      mensaje:
        "Payway no pudo anular el pago (puede ser que ya se haya cerrado el lote). La devolución se hace desde el backoffice de Payway.",
    };
  return { estado: "error", mensaje: "Payway no respondió bien. Probá de nuevo en un momento." };
}
