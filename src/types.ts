export type Category = "Hombre" | "Mujer" | "Accesorios";
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
  category: Category;
  type: string;
  price: number;
  oldPrice?: number;
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
    | "Devuelto";
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
}
export interface ZonaEnvio {
  id: string;
  nombre: string;
  /** Local es reparto propio; correo es Correo Argentino. */
  tipo: "local" | "correo";
  /** Sin definir, el checkout dice que se coordina por WhatsApp. */
  costo?: number;
  nota?: string;
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
  };
  devoluciones: {
    dias: number;
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
