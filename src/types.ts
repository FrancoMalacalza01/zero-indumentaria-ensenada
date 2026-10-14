export type Branch = "La Plata" | "Ensenada";
export type Category = "Hombre" | "Mujer" | "Accesorios";
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
  stock: Record<Branch, Record<string, number>>;
  isNew: boolean;
  active: boolean;
  description: string;
}
export interface CartItem {
  productId: string;
  size: string;
  branch: Branch;
  quantity: number;
}
export interface Order {
  id: string;
  date: string;
  items: (CartItem & { name: string; price: number; image: string })[];
  total: number;
  branch: Branch;
  delivery: "pickup" | "shipping";
  status: "Pendiente" | "Preparando" | "Listo para retirar" | "Completado";
  customer: string;
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
  branch: Branch;
  /** Positivo suma al stock, negativo lo descuenta. */
  delta: number;
  reason: MovementReason;
  orderId?: string;
}
export interface StockChange {
  productId: string;
  size: string;
  branch: Branch;
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
  branch: Branch;
  setBranch: (branch: Branch) => void;
  notify: (text: string) => void;
  resetDemo: () => void;
}
