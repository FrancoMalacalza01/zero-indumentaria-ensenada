// Cuántas cuotas le deja elegir Mercado Pago al comprador: las que el local dice que ofrece.
//
// El local carga en la configuración `cuotasSinInteres` (las que absorbe él) y `cuotasMaximas` (hasta cuántas se
// puede pagar, con el interés del banco). Mercado Pago, sin indicación, ofrece todas las que permita la tarjeta
// (hasta 12 o más). Con `payment_methods.installments` se le pone un tope.
//
// OJO: el tope sólo limita cuántas se ofrecen. Que sean **sin interés** (que las pague el local) se activa en la
// cuenta de Mercado Pago, en Tu negocio → Costos y cuotas; la tienda no lo puede hacer por su cuenta.

/**
 * @param pago  { cuotasSinInteres, cuotasMaximas } de la configuración del local
 * @returns el tope de cuotas para Mercado Pago, o `null` si el local no dijo nada (no se pone tope)
 */
export function topeDeCuotas(pago) {
  const sin = Math.trunc(Number(pago?.cuotasSinInteres));
  const max = Math.trunc(Number(pago?.cuotasMaximas));
  const tope = Math.max(Number.isFinite(sin) ? sin : 0, Number.isFinite(max) ? max : 0);
  // Mercado Pago acepta de 1 a 24; lo que no sirve se ignora en vez de romper el cobro.
  return tope >= 1 && tope <= 24 ? tope : null;
}
