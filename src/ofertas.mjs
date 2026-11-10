/**
 * Ofertas con fecha de fin.
 *
 * Una oferta es un precio bajo (`price`) con el de antes (`old_price`, el que se
 * muestra tachado). Si además tiene `offer_until`, a partir de ese momento vale
 * otra vez el de antes. Nadie tiene que acordarse de terminarla.
 *
 * **Esta regla existe dos veces a propósito**: acá, para lo que ve el cliente, y
 * en la base (`public.precio_vigente`, en `db/ofertas-con-vencimiento.sql`), que
 * es la que decide lo que se cobra. Tienen que decir lo mismo: si la pantalla
 * mostrara un precio y la base cobrara otro, el cliente pagaría de más (o el
 * local de menos). `tests/ofertas.test.mjs` fija el comportamiento de ésta.
 *
 * Todo es puro (la hora entra por parámetro) para poder probarlo sin reloj.
 */

/** Argentina no tiene horario de verano: el huso es siempre UTC-3. */
const HUSO = "-03:00";

/**
 * El momento exacto de un vencimiento, como texto ISO en UTC, o `null` si no es
 * una fecha. Acepta lo que guarda la base (con hora) y no inventa: una fecha
 * ilegible es "sin vencimiento", nunca "vencida" ni "para siempre vencida".
 */
export function hastaValido(valor) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Convierte el día que elige el local ("2026-11-30") en el momento en que
 * termina la oferta: el final de ese día, hora de Argentina. Así "hasta el 30"
 * incluye todo el 30. Devuelve `null` si no es un día real (31 de febrero…).
 */
export function finDelDia(dia) {
  if (typeof dia !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia.trim());
  if (!m) return null;
  const [, a, mes, d] = m;
  const prueba = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  if (prueba.getUTCFullYear() !== Number(a) || prueba.getUTCMonth() !== Number(mes) - 1 || prueba.getUTCDate() !== Number(d)) return null;
  return hastaValido(`${a}-${mes}-${d}T23:59:59${HUSO}`);
}

/** El día (AAAA-MM-DD, hora de Argentina) de un vencimiento, para mostrarlo en un campo de fecha. */
export function diaDe(hasta) {
  const iso = hastaValido(hasta);
  if (!iso) return "";
  return new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10);
}

/** true si ese vencimiento ya pasó. Sin vencimiento (o ilegible) nunca vence. */
export function vencida(hasta, ahora = Date.now()) {
  const iso = hastaValido(hasta);
  return iso !== null && Date.parse(iso) <= ahora;
}

/**
 * El precio que vale ahora.
 *
 * `{ price, old, hasta }` son los tres campos guardados. Devuelve lo mismo pero
 * con la oferta ya resuelta: vigente, queda igual (con `hasta` normalizado);
 * vencida, el precio es el de antes y ya no hay ni tachado ni fecha. `old`
 * y `hasta` quedan en `null` cuando no corresponden.
 */
export function precioVigente({ price, old = null, hasta = null }, ahora = Date.now()) {
  const fin = hastaValido(hasta);
  const hayAnterior = Number.isInteger(old) && old > price;
  // Un vencimiento sin precio anterior no es una oferta: no hay a qué volver.
  if (!hayAnterior) return { price, old: null, hasta: null };
  if (fin !== null && Date.parse(fin) <= ahora) return { price: old, old: null, hasta: null };
  return { price, old, hasta: fin };
}
