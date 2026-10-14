import type { PaymentMethodId } from "./types";

/**
 * Formas de pago del local. Lo que quede vacío o en `false` no se muestra: el
 * pedido sigue saliendo por WhatsApp y el pago se arregla en la conversación,
 * como hasta ahora.
 *
 * Sin servidor propio no se puede cobrar el total exacto de la bolsa de forma
 * automática: para eso Mercado Pago tiene que hablar con un backend nuestro,
 * que es Etapa 2. Lo que sí funciona hoy, sin backend:
 *
 * - `mercadoPagoUrl`: el link de pago que genera Mercado Pago (Cobrar → Link
 *   de pago). Lleva el monto con el que lo creaste, así que sirve para una
 *   seña fija o un precio redondo, no para el total de una bolsa cualquiera.
 * - `mercadoPagoAlias` y los datos del banco: el cliente transfiere el importe
 *   exacto y manda el comprobante por WhatsApp. Sirve para cualquier monto.
 * - `cash` y `cardInStore`: se cobra al retirar y no hay nada que configurar.
 *
 * CUIDADO: en cuanto pongas un link o un alias de verdad, un visitante puede
 * pagar de verdad, y hoy los precios y el stock son de ejemplo. Completalos
 * recién cuando el catálogo sea el real.
 */
export const payment = {
  /** Link de pago de Mercado Pago, completo y con https://. Monto fijo. */
  mercadoPagoUrl: "",
  /** Alias o CVU de Mercado Pago, para que transfieran el importe exacto. */
  mercadoPagoAlias: "",
  /**
   * Cuenta DNI (Banco Provincia). Poné el alias o CVU donde recibís el pago;
   * el cliente transfiere desde la app. `cuentaDniQr` es opcional: la URL de
   * la imagen de tu QR de comercio, si lo tenés, para que lo escaneen.
   *
   * Un cobro de verdad dentro del sitio, con el QR que se arma solo por cada
   * pedido, necesita darse de alta como comercio en Banco Provincia y que un
   * servidor nuestro hable con el banco. Eso es Etapa 2.
   */
  cuentaDniAlias: "",
  cuentaDniQr: "",
  /** Transferencia bancaria. Con alias o CBU alcanza para mostrarla. */
  bankName: "",
  bankHolder: "",
  bankAlias: "",
  bankCbu: "",
  /** Efectivo al retirar el pedido en la sucursal. */
  cash: true,
  /** Tarjeta por el posnet del local, al retirar. */
  cardInStore: true,
};

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
}

const labels: Record<PaymentMethodId, string> = {
  mercadopago: "Mercado Pago",
  cuentadni: "Cuenta DNI",
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo al retirar",
  tarjeta: "Tarjeta en el local",
};

/** Nombre de la forma de pago, para el pedido, el panel y el WhatsApp. */
export function paymentLabel(id?: PaymentMethodId) {
  return id ? labels[id] : "";
}

/** Solo las formas de pago que el local tiene configuradas. */
export function paymentOptions(): PaymentOption[] {
  const options: PaymentOption[] = [];
  if (payment.mercadoPagoUrl || payment.mercadoPagoAlias)
    options.push({
      id: "mercadopago",
      label: labels.mercadopago,
      detail: payment.mercadoPagoUrl
        ? "Pagás con el link de Mercado Pago: tarjeta, dinero en cuenta o efectivo."
        : "Transferís a nuestra cuenta de Mercado Pago y nos mandás el comprobante.",
      data: payment.mercadoPagoAlias
        ? [{ label: "Alias", value: payment.mercadoPagoAlias }]
        : [],
      url: payment.mercadoPagoUrl || undefined,
      needsReceipt: true,
    });
  if (payment.cuentaDniAlias || payment.cuentaDniQr)
    options.push({
      id: "cuentadni",
      label: labels.cuentadni,
      detail: payment.cuentaDniQr
        ? "Escaneás el QR desde Cuenta DNI, o transferís al alias."
        : "Transferís desde Cuenta DNI al alias y nos mandás el comprobante.",
      data: payment.cuentaDniAlias
        ? [{ label: "Alias", value: payment.cuentaDniAlias }]
        : [],
      image: payment.cuentaDniQr || undefined,
      needsReceipt: true,
    });
  if (payment.bankAlias || payment.bankCbu)
    options.push({
      id: "transferencia",
      label: labels.transferencia,
      detail: "Transferís el importe exacto y nos mandás el comprobante.",
      data: [
        ...(payment.bankAlias
          ? [{ label: "Alias", value: payment.bankAlias }]
          : []),
        ...(payment.bankCbu ? [{ label: "CBU", value: payment.bankCbu }] : []),
        ...(payment.bankHolder
          ? [{ label: "Titular", value: payment.bankHolder }]
          : []),
        ...(payment.bankName
          ? [{ label: "Banco", value: payment.bankName }]
          : []),
      ],
      needsReceipt: true,
    });
  if (payment.cash)
    options.push({
      id: "efectivo",
      label: labels.efectivo,
      detail: "Pagás en efectivo cuando pasás a buscar el pedido.",
      data: [],
      needsReceipt: false,
    });
  if (payment.cardInStore)
    options.push({
      id: "tarjeta",
      label: labels.tarjeta,
      detail: "Pagás con tarjeta en el local, al retirar.",
      data: [],
      needsReceipt: false,
    });
  return options;
}

/**
 * Si hay un link o una cuenta de verdad cargados, el pago deja de ser una
 * demostración y el aviso de la pantalla final tiene que decirlo.
 */
export const chargesRealMoney = Boolean(
  payment.mercadoPagoUrl ||
    payment.mercadoPagoAlias ||
    payment.cuentaDniAlias ||
    payment.cuentaDniQr ||
    payment.bankAlias ||
    payment.bankCbu,
);
