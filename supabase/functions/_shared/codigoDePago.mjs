// El código de pago de un pedido: lo que prueba que quien llama a una función del servidor es quien hizo el pedido.
//
// Los números de pedido son correlativos (M-00030, M-00031…), así que el número solo no puede ser la llave: cualquiera
// podría recorrerlos. `crear_pedido` le da a cada pedido un código al azar (64 caracteres hexadecimales, guardado en
// `orders.pago_token`) y sólo se lo devuelve a quien lo hizo. Las funciones que actúan sobre un pedido desde la tienda
// (cobrar, armar el link de Mercado Pago, mandar la confirmación) lo piden.

/** Un código bien formado: 64 caracteres hexadecimales. */
export const FORMATO_CODIGO = /^[a-f0-9]{64}$/;

/**
 * ¿El código recibido es el del pedido? Compara en tiempo constante (sin cortar en la primera diferencia) y
 * devuelve false si falta alguno de los dos o si no tienen el formato esperado, para que un pedido inexistente, uno sin
 * código y un código equivocado den la MISMA respuesta.
 */
export function codigoDePagoValido(esperado, recibido) {
  if (typeof esperado !== "string" || typeof recibido !== "string") return false;
  if (!FORMATO_CODIGO.test(esperado) || !FORMATO_CODIGO.test(recibido)) return false;
  let diferencia = 0;
  for (let i = 0; i < esperado.length; i++) diferencia |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i);
  return diferencia === 0;
}

/** ¿El monto que dice Mercado Pago es el del pedido? Se compara en centavos, para no tropezar con decimales. */
export function montoCoincide(pagado, total) {
  const a = Math.round(Number(pagado) * 100);
  const b = Math.round(Number(total) * 100);
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && a === b;
}
