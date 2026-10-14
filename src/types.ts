export type Category = "Hombre" | "Mujer" | "Accesorios";
export type PaymentMethodId =
  | "mercadopago"
  | "cuentadni"
  | "transferencia"
  | "efectivo"
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
  status: "Pendiente" | "Preparando" | "Listo para retirar" | "Completado";
  customer: string;
  /**
   * Forma de pago elegida. Opcional: los pedidos guardados antes de que
   * existieran las formas de pago no la tienen.
   */
  payment?: PaymentMethodId;
  /** Zona de envío, cuando el pedido no es para retirar. */
  zone?: string;
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
