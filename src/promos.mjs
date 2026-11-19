/**
 * Las promos que se muestran junto al precio de una prenda, como en las tiendas de las marcas:
 * "3 cuotas sin interés de $X" y "$Y con Transferencia 15% OFF".
 *
 * Todo sale de lo que el local configuró (cuotas, descuento por pago al contado, qué formas de
 * pago acepta): si no hay nada configurado, no se muestra ninguna promo. Nunca se inventa una.
 * Es sólo para mostrar: el cobro lo hace el local (ver `payment.ts`).
 *
 * @param pago   `settings.pago`
 * @param precio el precio de la prenda, en pesos enteros
 * @returns { cuotas: { cantidad, monto } | null, contado: { porcentaje, monto, medios } | null }
 */
export function promosDePrecio(pago, precio) {
  const salida = { cuotas: null, contado: null };
  if (!pago || !Number.isFinite(precio) || precio <= 0) return salida;
  const sin = Math.trunc(Number(pago.cuotasSinInteres)) || 0;
  // Las cuotas son de tarjeta de crédito: sin esa forma de pago no se ofrecen.
  if (pago.credito && sin > 1) salida.cuotas = { cantidad: sin, monto: Math.round((precio / sin) * 100) / 100 };
  const pct = Math.min(90, Math.max(0, Math.trunc(Number(pago.descuentoContado)) || 0));
  const medios = [];
  if (pago.banco && (pago.banco.alias || pago.banco.cbu)) medios.push("Transferencia");
  if (pago.efectivo) medios.push("efectivo");
  if (pct > 0 && medios.length) {
    salida.contado = { porcentaje: pct, monto: Math.round(precio * (1 - pct / 100)), medios: medios.join(" o ") };
  }
  return salida;
}

/** "Envío gratis en compras de $100.000 o más", o `null` si el local no tiene envío gratis. */
export function textoEnvioGratis(envio, formato) {
  const desde = Math.trunc(Number(envio?.envioGratisDesde)) || 0;
  return desde > 0 ? `Envío gratis en compras de ${formato(desde)} o más` : null;
}
