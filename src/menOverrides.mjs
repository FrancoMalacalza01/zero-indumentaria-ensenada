/**
 * Ajustes del local sobre el catálogo de hombre.
 *
 * El catálogo de hombre viene armado de fábrica (`men-catalog.json`) con el
 * precio que publica cada marca. El local necesita dos cosas que ese archivo no
 * puede dar: ponerle su propio precio a una prenda y sacar la que no tiene.
 * Eso vive acá, aparte, como una lista de excepciones por producto: lo que no
 * está en la lista se muestra tal como viene.
 *
 * Una excepción es `{ price, active }`:
 * - `price`: el precio de Zero, en pesos enteros. `null` = usar el de la marca.
 * - `active`: `false` = dada de baja, la tienda no la muestra.
 *
 * Todo es puro, para poder probarlo sin red ni navegador.
 */

/** Más que esto casi seguro es un cero de más. */
export const PRECIO_MAXIMO = 10_000_000;

import { hastaValido, precioVigente } from "./ofertas.mjs";

const SIN_AJUSTE = { price: null, active: true };

function precioValido(valor) {
  return Number.isInteger(valor) && valor > 0 && valor <= PRECIO_MAXIMO;
}

/**
 * El precio anterior (el que se muestra tachado) sólo existe si hay un precio
 * propio y el anterior es mayor: si no, no hay oferta, y un "descuento" que
 * sube el precio no se muestra nunca. Devuelve el precio o `null`.
 */
function anteriorValido(anterior, precio) {
  return precioValido(anterior) && precioValido(precio) && anterior > precio
    ? anterior
    : null;
}

/**
 * Lo que guardó el servidor, convertido en `{ [id]: { price, active, old?, hasta? } }`.
 * `hasta` es cuándo termina la oferta; las ya vencidas vuelven al precio de antes.
 * Una fila rota se ignora en vez de romper la tienda.
 */
export function leerAjustes(filas, ahora = Date.now()) {
  const ajustes = {};
  if (!Array.isArray(filas)) return ajustes;
  for (const f of filas) {
    if (!f || typeof f.product_id !== "string" || !f.product_id) continue;
    const price = precioValido(f.price) ? f.price : null;
    const active = f.active !== false;
    if (price === null && active) continue;
    // Una oferta vencida ya es el precio de antes (igual que `precio_vigente` en la base).
    // Se resuelve acá, al leer, para que el resto de la app no tenga que acordarse.
    const oferta = price === null ? { price, old: null, hasta: null } : precioVigente({ price, old: anteriorValido(f.old_price, price), hasta: f.offer_until }, ahora);
    if (oferta.price === null && active) continue;
    ajustes[f.product_id] = {
      price: oferta.price, active,
      ...(oferta.old ? { old: oferta.old } : {}),
      ...(oferta.old && oferta.hasta ? { hasta: oferta.hasta } : {}),
    };
  }
  return ajustes;
}

/** El vencimiento que se guarda: sólo tiene sentido si hay oferta. */
function ajusteHasta(ajuste) {
  return anteriorValido(ajuste?.old, ajuste?.price) ? hastaValido(ajuste.hasta) : null;
}

/** La fila que se manda al servidor para una excepción. */
export function ajusteAFila(id, ajuste) {
  return {
    product_id: id,
    price: precioValido(ajuste?.price) ? ajuste.price : null,
    old_price: anteriorValido(ajuste?.old, ajuste?.price),
    // `null` borra el vencimiento; sin la clave no se toca la columna, así una base
    // a la que todavía no se le agregó `offer_until` sigue andando mientras nadie lo use.
    ...(ajuste?.hasta !== undefined ? { offer_until: ajusteHasta(ajuste) } : {}),
    active: ajuste?.active !== false,
  };
}

/**
 * Devuelve las excepciones con un cambio aplicado a un producto. Si el
 * producto vuelve a quedar como viene de fábrica, su excepción desaparece: la
 * lista sólo guarda lo que de verdad es distinto.
 */
export function cambiarAjuste(ajustes, id, cambio) {
  const actual = ajustes?.[id] || SIN_AJUSTE;
  const siguiente = {
    price: cambio && "price" in cambio ? cambio.price : actual.price,
    active: cambio && "active" in cambio ? cambio.active !== false : actual.active,
  };
  if (siguiente.price !== null && !precioValido(siguiente.price))
    siguiente.price = null;
  // Si cambia el precio y el anterior deja de ser mayor, la oferta termina sola.
  const old = anteriorValido(
    cambio && "old" in cambio ? cambio.old : actual.old,
    siguiente.price,
  );
  // El vencimiento sigue a la oferta: se puede cambiar junto con ella, y si la oferta
  // termina el vencimiento también. Si antes había uno, queda `null` (no ausente) para
  // que al guardar se borre de la base.
  let hasta;
  if (old) {
    hasta = cambio && "hasta" in cambio ? hastaValido(cambio.hasta) : actual.hasta ?? null;
    if (hasta === null && actual.hasta === undefined) hasta = undefined; // nunca hubo: nada que borrar
  } else hasta = actual.hasta !== undefined ? null : undefined;
  const resto = { ...ajustes };
  if (siguiente.price === null && siguiente.active) delete resto[id];
  else resto[id] = { ...siguiente, ...(old ? { old } : {}), ...(hasta !== undefined ? { hasta } : {}) };
  return resto;
}

/**
 * Lo que ve el cliente: las dadas de baja desaparecen y las que tienen precio
 * propio lo muestran. `precioZero` dice de dónde salió el precio, para que la
 * tienda no le atribuya a la marca un precio que puso el local. Las que están
 * en oferta traen además `precioAnterior`, el que se muestra tachado.
 */
export function aplicarAjustes(productos, ajustes) {
  const lista = [];
  for (const p of productos) {
    const a = ajustes?.[p.id];
    if (a && a.active === false) continue;
    if (a && precioValido(a.price)) {
      const anterior = anteriorValido(a.old, a.price);
      lista.push({
        ...p,
        priceARS: a.price,
        precioZero: true,
        ...(anterior ? { precioAnterior: anterior } : {}),
      });
    } else lista.push({ ...p, precioZero: false });
  }
  return lista;
}

/** Cuántas prendas están dadas de baja, con precio propio y en oferta. */
export function resumenAjustes(productos, ajustes) {
  let baja = 0;
  let conPrecio = 0;
  let ofertas = 0;
  for (const p of productos) {
    const a = ajustes?.[p.id];
    if (!a) continue;
    if (a.active === false) baja++;
    if (precioValido(a.price)) conPrecio++;
    if (anteriorValido(a.old, a.price)) ofertas++;
  }
  return {
    total: productos.length,
    baja,
    conPrecio,
    ofertas,
    activas: productos.length - baja,
  };
}

/**
 * Lee un precio escrito a mano. Acepta lo que la gente escribe de verdad:
 * "32900", "32.900", "$ 32.900". Rechaza los centavos y lo que no es plata en
 * vez de adivinar: un precio mal leído se cobra mal.
 */
export function leerPrecio(entrada) {
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return { ok: false, error: "Ingresá un precio." };
    entrada = String(entrada);
  }
  const texto = String(entrada ?? "").replace(/[$\s]/g, "");
  if (!texto) return { ok: false, error: "Ingresá un precio." };
  if (!/^[\d.,-]+$/.test(texto))
    return { ok: false, error: "El precio sólo puede llevar números." };
  if (texto.startsWith("-"))
    return { ok: false, error: "El precio tiene que ser mayor a cero." };
  // Con puntos de a tres cifras (32.900 / 1.234.567) son miles, no decimales.
  let enteros = texto;
  if (/^\d{1,3}(\.\d{3})+$/.test(texto)) enteros = texto.replace(/\./g, "");
  else if (/[.,]/.test(texto))
    return {
      ok: false,
      error: "Poné el precio en pesos enteros, sin centavos (ej. 32900).",
    };
  const valor = Number(enteros);
  if (!Number.isInteger(valor) || valor <= 0)
    return { ok: false, error: "El precio tiene que ser mayor a cero." };
  if (valor > PRECIO_MAXIMO)
    return {
      ok: false,
      error: "Ese precio es demasiado alto. ¿Sobran ceros?",
    };
  return { ok: true, value: valor };
}

/**
 * Un aviso cuando el cambio es tan grande que parece un error de tipeo
 * (32900 → 3290). Devuelve el texto de la pregunta, o `null` si el cambio es
 * razonable. No bloquea: hay descuentos y remarcaciones de verdad.
 */
export function avisoDeCambio(actual, nuevo) {
  if (!precioValido(actual) || !precioValido(nuevo) || actual === nuevo) return null;
  if (nuevo <= actual * 2 && nuevo >= actual / 2) return null;
  const por = Math.round(((nuevo - actual) / actual) * 100);
  const signo = por > 0 ? "+" : "";
  return `El precio pasa de ${pesos(actual)} a ${pesos(nuevo)} (${signo}${por}%). ¿Es correcto?`;
}

function pesos(n) {
  return `$${n.toLocaleString("es-AR")}`;
}
