import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CartItem,
  Movement,
  Order,
  PaymentMethodId,
  Product,
  StockChange,
  StoreContextType,
} from "./types";
import { seedProducts } from "./data";
import { prepareOrder } from "./commerce.mjs";
const KEY = "mistral-local-demo-v1";
type Data = {
  products: Product[];
  orders: Order[];
  cart: CartItem[];
  favorites: string[];
  movements: Movement[];
};
const initial = (): Data => ({
  products: structuredClone(seedProducts),
  orders: [],
  cart: [],
  favorites: [],
  movements: [],
});
function restore(): Data {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      data &&
      Array.isArray(data.products) &&
      data.products.every(
        (p: Product) => p.id && p.stock && Array.isArray(p.sizes),
      ) &&
      Array.isArray(data.orders) &&
      Array.isArray(data.cart) &&
      Array.isArray(data.favorites)
    )
      // Los movimientos se incorporaron después: una demo guardada antes no
      // los tiene y no por eso hay que descartarla.
      return { ...data, movements: data.movements || [] };
  } catch {
    /* Use clean demo if storage is unavailable. */
  }
  return initial();
}
interface Context extends StoreContextType {
  favorites: string[];
  movements: Movement[];
  toggleFavorite: (id: string) => void;
  /** Aplica cambios de stock y los deja asentados en el historial. */
  applyStock: (changes: StockChange[]) => void;
  /** Solo asienta el historial, para cuando el stock ya quedó guardado. */
  recordMovements: (changes: StockChange[]) => void;
  placeOrder: (
    delivery: "pickup" | "shipping",
    customer: string,
    payment?: PaymentMethodId,
    zone?: string,
  ) => { error?: string; order?: Order };
}
const StoreContext = createContext<Context | null>(null);
export const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
let movementSeq = 0;
function buildMovements(
  products: Product[],
  changes: StockChange[],
  date = new Date().toISOString(),
): Movement[] {
  return changes
    .filter((change) => change.delta !== 0)
    .map((change) => ({
      id: `mov-${Date.now().toString(36)}-${movementSeq++}`,
      date,
      productId: change.productId,
      productName:
        products.find((p) => p.id === change.productId)?.name ||
        "Producto eliminado",
      size: change.size,
      delta: change.delta,
      reason: change.reason,
      orderId: change.orderId,
    }));
}
function applyToProducts(products: Product[], changes: StockChange[]) {
  return products.map((product) => {
    const mine = changes.filter((c) => c.productId === product.id);
    if (!mine.length) return product;
    const stock = structuredClone(product.stock);
    mine.forEach((change) => {
      const current = stock[change.size] || 0;
      // El stock nunca queda en negativo, por más que el ajuste lo pida.
      stock[change.size] = Math.max(0, current + change.delta);
    });
    return { ...product, stock };
  });
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(restore);
  const live = useRef(data);
  live.current = data;
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = (text: string) => {
    clearTimeout(timer.current);
    setToast(text);
    timer.current = setTimeout(() => setToast(""), 4200);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [data]);
  const value: Context = {
    ...data,
    notify,
    setProducts: (products) => setData((d) => ({ ...d, products })),
    setOrders: (orders) => setData((d) => ({ ...d, orders })),
    setCart: (cart) => setData((d) => ({ ...d, cart })),
    recordMovements: (changes) =>
      setData((d) => ({
        ...d,
        movements: [...buildMovements(d.products, changes), ...d.movements],
      })),
    applyStock: (changes) =>
      setData((d) => ({
        ...d,
        products: applyToProducts(d.products, changes),
        movements: [...buildMovements(d.products, changes), ...d.movements],
      })),
    toggleFavorite: (id) =>
      setData((d) => ({
        ...d,
        favorites: d.favorites.includes(id)
          ? d.favorites.filter((x) => x !== id)
          : [...d.favorites, id],
      })),
    resetDemo: () => {
      setData(initial());
      notify("Demo restablecida.");
    },
    placeOrder: (delivery, customer, payment, zone) => {
      const d = live.current;
      const result = prepareOrder(
        d.products,
        d.cart,
        delivery,
        customer,
        `M-${Date.now().toString(36).toUpperCase()}`,
        new Date().toISOString(),
      );
      if (result.error) return { error: result.error };
      // Ni la forma de pago ni la zona de envío entran en prepareOrder: no
      // participan de la validación ni del descuento de stock.
      const order = {
        ...(result.order as Order),
        payment,
        zone: delivery === "shipping" ? zone : undefined,
      };
      const sales = buildMovements(
        d.products,
        order.items.map((item) => ({
          productId: item.productId,
          size: item.size,
          delta: -item.quantity,
          reason: "Venta" as const,
          orderId: order.id,
        })),
        order.date,
      );
      const next = {
        ...d,
        products: result.products as Product[],
        orders: [order, ...d.orders],
        cart: [],
        movements: [...sales, ...d.movements],
      };
      live.current = next;
      setData(next);
      return { order };
    },
  };
  return (
    <StoreContext.Provider value={value}>
      {children}
      {storageError && (
        <div className="storage-notice" role="alert">
          No se pudo guardar la demo en este navegador. Los cambios se
          conservarán solo mientras esta página esté abierta.
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("StoreProvider missing");
  return context;
}
