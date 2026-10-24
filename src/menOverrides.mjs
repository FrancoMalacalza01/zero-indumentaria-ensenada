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

const SIN_AJUSTE = { price: null, active: true };

function precioValido(valor) {
  return Number.isInteger(valor) && valor > 0 && valor <= PRECIO_MAXIMO;
}

/**
 * Lo que guardó el servidor, convertido en `{ [id]: { price, active } }`.
 * Una fila rota se ignora en vez de romper la tienda.
 */
export function leerAjustes(filas) {
  const ajustes = {};
  if (!Array.isArray(filas)) return ajustes;
  for (const f of filas) {
    if (!f || typeof f.product_id !== "string" || !f.product_id) continue;
    const price = precioValido(f.price) ? f.price : null;
    const active = f.active !== false;
    if (price === null && active) continue;
    ajustes[f.product_id] = { price, active };
  }
  return ajustes;
}

/** La fila que se manda al servidor para una excepción. */
export function ajusteAFila(id, ajuste) {
  return {
    product_id: id,
    price: precioValido(ajuste?.price) ? ajuste.price : null,
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
  const resto = { ...ajustes };
  if (siguiente.price === null && siguiente.active) delete resto[id];
  else resto[id] = siguiente;
  return resto;
}

/**
 * Lo que ve el cliente: las dadas de baja desaparecen y las que tienen precio
 * propio lo muestran. `precioZero` dice de dónde salió el precio, para que la
 * tienda no le atribuya a la marca un precio que puso el local.
 */
export function aplicarAjustes(productos, ajustes) {
  const lista = [];
  for (const p of productos) {
    const a = ajustes?.[p.id];
    if (a && a.active === false) continue;
    if (a && precioValido(a.price))
      lista.push({ ...p, priceARS: a.price, precioZero: true });
    else lista.push({ ...p, precioZero: false });
  }
  return lista;
}

/** Cuántas prendas están dadas de baja y cuántas tienen precio propio. */
export function resumenAjustes(productos, ajustes) {
  let baja = 0;
  let conPrecio = 0;
  for (const p of productos) {
    const a = ajustes?.[p.id];
    if (!a) continue;
    if (a.active === false) baja++;
    if (precioValido(a.price)) conPrecio++;
  }
  return { total: productos.length, baja, conPrecio, activas: productos.length - baja };
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
