export type Category = "Hombre" | "Accesorios";
export type PaymentMethodId =
  | "mercadopago"
  | "cuentadni"
  | "transferencia"
  | "efectivo"
  | "debito"
  | "credito"
  /** Pedidos de antes de que débito y crédito fueran opciones separadas. */
  | "tarjeta";
export interface Product {
  id: string;
  name: string;
  brand?: string;
  sourceCatalogId?: string;
  category: Category;
  type: string;
  price: number;
  oldPrice?: number;
  /** Hasta cuándo dura la oferta (ISO). Sin esto la oferta no vence sola. */
  offerUntil?: string;
  image: string;
  images?: string[];
  color: string;
  colorHex: string;
  sizes: string[];
  /** Unidades por talle. Un solo local, un solo stock. */
  stock: Record<string, number>;
  isNew: boolean;
  active: boolean;
  description: string;
}
export interface CartItem {
  productId: string;
  size: string;
  quantity: number;
}
export interface Order {
  id: string;
  /** Código para cobrar este pedido. Sólo lo recibe quien lo acaba de hacer; no se guarda en el navegador. */
  pagoToken?: string;
  date: string;
  items: (CartItem & { name: string; price: number; image: string })[];
  total: number;
  delivery: "pickup" | "shipping";
  status:
    | "Pendiente"
    | "Preparando"
    | "Listo para retirar"
    | "Completado"
    /** Volvió la mercadería. El stock se repone y queda el movimiento. */
    | "Devuelto"
    /** Nadie lo pagó o no se concretó. El stock también vuelve. */
    | "Cancelado";
  customer: string;
  /**
   * Forma de pago elegida. Opcional: los pedidos guardados antes de que
   * existieran las formas de pago no la tienen.
   */
  payment?: PaymentMethodId;
  /** Zona de envío, cuando el pedido no es para retirar. */
  zone?: string;
  /**
   * Cuánto de `total` es el envío. `total` es lo que paga el cliente, con el
   * envío incluido; así el pedido no hay que recalcularlo después.
   */
  envio?: number;
  /** Las prendas solas, sin el envío. */
  subtotal?: number;
  /** Cómo viene el cobro. Es distinto del estado del pedido. */
  paymentStatus?:
    | "sin_pago"
    | "pendiente"
    | "aprobado"
    | "rechazado"
    | "devuelto";
  /** El id que devolvió la pasarela, para cruzarlo con el resumen. */
  pagoRef?: string;
  /** El mail al que se le mandó la confirmación. */
  email?: string;
  /** Cuándo salió el mail de confirmación. */
  mailEnviadoAt?: string;
}
export interface ZonaEnvio {
  id: string;
  nombre: string;
  /** Local es reparto propio; correo es Correo Argentino. */
  tipo: "local" | "correo";
  /** Sin definir, el checkout dice que se coordina por WhatsApp. */
  costo?: number;
  nota?: string;
  /**
   * Los códigos postales que cubre, como los escribe el local: "1923, 1925, 1900-1909".
   * Si alguna zona lo tiene, el cliente escribe su código y la zona sale sola.
   */
  cp?: string;
  /**
   * Cuánto tarda en llegar, en las palabras que ve el cliente ("2 a 5 días
   * hábiles"). Vacío = no se dice nada. Las zonas de Correo Argentino traen el
   * de Paq.ar Clásico de fábrica.
   */
  plazo?: string;
}
/**
 * La configuración del local, cargada desde el panel.
 *
 * Antes esto vivía en el código y había que tocar archivos para cambiar un
 * alias. Ahora vive en la base: la lee la tienda y la escribe el dueño.
 */
export interface Settings {
  whatsapp: string;
  direccion: {
    calle: string;
    ciudad: string;
    provincia: string;
    cp: string;
    horarios: string;
  };
  pago: {
    mercadoPagoUrl: string;
    mercadoPagoAlias: string;
    cuentaDniAlias: string;
    /** URL o la imagen del QR cargada desde el panel. */
    cuentaDniQr: string;
    /**
     * Cobrar online el monto exacto con Mercado Pago. Necesita además el
     * token de la cuenta cargado como secreto en el servidor.
     */
    mercadoPagoOnline: boolean;
    /**
     * Cobrar con tarjeta por Payway, dentro de la tienda. Además de prenderlo hay
     * que cargar la clave PRIVADA como secreto en el servidor (PAYWAY_PRIVATE_API_KEY).
     */
    paywayOnline: boolean;
    /** La clave PÚBLICA de Payway: es pública a propósito, con ella el navegador sólo puede sacar tokens. */
    paywayClavePublica: string;
    /** Dirección de la API de Payway (Sandbox o producción). Sólo se aceptan las de payway.com.ar. */
    paywayUrl: string;
    banco: { nombre: string; titular: string; alias: string; cbu: string };
    efectivo: boolean;
    debito: boolean;
    credito: boolean;
    cuotasSinInteres: number;
    cuotasMaximas: number;
    /** Por ciento de descuento pagando en efectivo o por transferencia. */
    descuentoContado: number;
  };
  envio: {
    zonas: ZonaEnvio[];
    /** Monto de prendas desde el que el envío va sin cargo. 0 = nunca. */
    envioGratisDesde: number;
    /** Localidades que el cliente puede elegir en vez de escribir su código postal. */
    localidades: { nombre: string; cp: string }[];
  };
  pedidos: {
    /** Horas hasta que un pedido de pago online sin pagar se cancela solo y devuelve el stock. 0 = nunca. */
    vencenEnHoras: number;
  };
  /** Quién vende. El consumidor tiene que poder saberlo antes de comprar. */
  empresa: {
    razonSocial: string;
    cuit: string;
    domicilioLegal: string;
    emailContacto: string;
  };
  /** La tabla de medidas corporales que exige la Ley 27.521 (SUNITI). */
  talles: {
    filas: { talle: string; pecho: string; cintura: string; cadera: string }[];
    nota: string;
  };
  devoluciones: {
    dias: number;
    /** Días para cambiar por talle o color, desde la recepción del pedido. */
    cambioDias: number;
    cambioGratisDesde: number;
    direccion: string;
    notas: string;
  };
}
export type MovementReason =
  | "Ingreso"
  | "Venta"
  | "Ajuste"
  | "Rotura"
  | "Devolución";
/** Cada cambio de stock queda registrado: nada se edita sin dejar rastro. */
export interface Movement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  size: string;
  /** Positivo suma al stock, negativo lo descuenta. */
  delta: number;
  reason: MovementReason;
  orderId?: string;
}
export interface StockChange {
  productId: string;
  size: string;
  delta: number;
  reason: MovementReason;
  orderId?: string;
}
export interface StoreContextType {
  products: Product[];
  setProducts: (products: Product[]) => void;
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  notify: (text: string) => void;
  resetDemo: () => void;
}
