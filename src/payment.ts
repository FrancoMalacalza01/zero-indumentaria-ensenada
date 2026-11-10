import type { PaymentMethodId, Settings } from "./types";

/**
 * Las formas de pago que el local tiene prendidas.
 *
 * Se configuran desde el panel, no acá: lo que había en este archivo ahora
 * vive en la base (`settings`). Lo que quede vacío o apagado no se muestra.
 *
 * QUÉ PUEDE Y QUÉ NO PUEDE HACER EL SITIO. El sitio **no cobra**. Muestra el
 * link, el alias o el QR y el pago se arregla aparte; el posnet del local es
 * del local. Cobrar adentro del sitio, con el monto exacto de la bolsa,
 * necesita un servidor que hable con Mercado Pago, porque el token de la
 * cuenta no puede vivir en el navegador.
 *
 * POR QUÉ HAY DESCUENTO POR CONTADO Y NO RECARGO POR TARJETA. Cobrar más por
 * pagar con tarjeta está prohibido (Ley 25.065, art. 37, y las resoluciones
 * de Defensa del Consumidor que lo recuerdan). Una promo por pagar en
 * efectivo o por transferencia es la forma en que se hace. El sitio muestra
 * el precio de lista y avisa el descuento; el local lo aplica al cobrar.
 */

export interface PaymentOption {
  id: PaymentMethodId;
  label: string;
  /** Qué le pasa al cliente si elige esta forma de pago. */
  detail: string;
  /** Datos para copiar: alias, CBU, titular. */
  data: { label: string; value: string }[];
  /** Link externo para pagar, si esta forma lo tiene. */
  url?: string;
  /** Imagen para mostrar, como el QR de Cuenta DNI. */
  image?: string;
  /** El pago se hace antes de retirar, así que conviene pedir comprobante. */
  needsReceipt: boolean;
  /** Por ciento de descuento que tiene esta forma, si tiene alguno. */
  descuento?: number;
  /** Se paga en el local, no antes. */
  enElLocal?: boolean;
}

const labels: Record<PaymentMethodId, string> = {
  mercadopago: "Mercado Pago",
  cuentadni: "Cuenta DNI",
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo",
  debito: "Tarjeta de débito",
  credito: "Tarjeta de crédito",
  tarjeta: "Tarjeta en el local",
};

/** Nombre de la forma de pago, para el pedido, el panel y el WhatsApp. */
export function paymentLabel(id?: PaymentMethodId) {
  return id ? labels[id] : "";
}

/** Cómo se cuentan las cuotas, en una línea. */
export function cuotasLabel(pago: Settings["pago"]) {
  const { cuotasSinInteres: sin, cuotasMaximas: max } = pago;
  if (sin > 1 && max > sin)
    return `${sin} cuotas sin interés, o hasta ${max} con el interés del banco`;
  if (sin > 1) return `${sin} cuotas sin interés`;
  if (max > 1) return `hasta ${max} cuotas con el interés del banco`;
  return "en un pago";
}

/** Solo las formas de pago que el local tiene configuradas. */
export function paymentOptions(settings: Settings): PaymentOption[] {
  const p = settings.pago;
  const desc = p.descuentoContado > 0 ? p.descuentoContado : undefined;
  const options: PaymentOption[] = [];

  if (p.mercadoPagoUrl || p.mercadoPagoAlias)
    options.push({
      id: "mercadopago",
      label: labels.mercadopago,
      detail: p.mercadoPagoUrl
        ? "Pagás con el link de Mercado Pago: tarjeta, dinero en cuenta o efectivo."
        : "Transferís a nuestra cuenta de Mercado Pago y nos mandás el comprobante.",
      data: p.mercadoPagoAlias
        ? [{ label: "Alias", value: p.mercadoPagoAlias }]
        : [],
      url: p.mercadoPagoUrl || undefined,
      needsReceipt: true,
    });

  if (p.cuentaDniAlias || p.cuentaDniQr)
    options.push({
      id: "cuentadni",
      label: labels.cuentadni,
      detail: p.cuentaDniQr
        ? "Escaneás el QR desde Cuenta DNI, o transferís al alias."
        : "Transferís desde Cuenta DNI al alias y nos mandás el comprobante.",
      data: p.cuentaDniAlias
        ? [{ label: "Alias", value: p.cuentaDniAlias }]
        : [],
      image: p.cuentaDniQr || undefined,
      needsReceipt: true,
      descuento: desc,
    });

  if (p.banco.alias || p.banco.cbu)
    options.push({
      id: "transferencia",
      label: labels.transferencia,
      detail: "Transferís el importe exacto y nos mandás el comprobante.",
      data: [
        ...(p.banco.alias ? [{ label: "Alias", value: p.banco.alias }] : []),
        ...(p.banco.cbu ? [{ label: "CBU", value: p.banco.cbu }] : []),
        ...(p.banco.titular
          ? [{ label: "Titular", value: p.banco.titular }]
          : []),
        ...(p.banco.nombre ? [{ label: "Banco", value: p.banco.nombre }] : []),
      ],
      needsReceipt: true,
      descuento: desc,
    });

  if (p.efectivo)
    options.push({
      id: "efectivo",
      label: labels.efectivo,
      detail: "Pagás al retirar el pedido en el local.",
      data: [],
      needsReceipt: false,
      descuento: desc,
      enElLocal: true,
    });

  if (p.debito)
    options.push({
      id: "debito",
      label: labels.debito,
      // Importante que el cliente sepa que es un pago, no cuotas: el débito
      // no tiene cuotas y el precio es el de lista.
      detail: "Por el posnet del local, al retirar. En un pago.",
      data: [],
      needsReceipt: false,
      enElLocal: true,
    });

  if (p.credito)
    options.push({
      id: "credito",
      label: labels.credito,
      detail: `Por el posnet del local, al retirar. ${cuotasLabel(p)}.`,
      data: [],
      needsReceipt: false,
      enElLocal: true,
    });

  return options;
}

/**
 * true si alguna forma de pago mueve dinero de verdad.
 *
 * Sirve para avisar en la demo: con un link o un alias cargado, un visitante
 * puede pagar en serio aunque los precios todavía sean de ejemplo.
 */
export function chargesRealMoney(settings: Settings) {
  const p = settings.pago;
  return Boolean(
    (p.paywayOnline && p.paywayClavePublica) ||
      p.mercadoPagoUrl ||
      p.mercadoPagoAlias ||
      p.cuentaDniAlias ||
      p.cuentaDniQr ||
      p.banco.alias ||
      p.banco.cbu,
  );
}

/** El precio con el descuento por contado aplicado. */
export function conDescuento(monto: number, descuento?: number) {
  if (!descuento) return monto;
  return Math.round(monto * (1 - descuento / 100));
}
