import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  Branch,
  CartItem,
  Order,
  Product,
  StoreContextType,
} from "./types";
import { seedProducts } from "./data";
import { prepareOrder } from "./commerce.mjs";
const KEY = "mistral-local-demo-v1";
type Data = {
  products: Product[];
  orders: Order[];
  cart: CartItem[];
  branch: Branch;
  favorites: string[];
};
const initial = (): Data => ({
  products: structuredClone(seedProducts),
  orders: [],
  cart: [],
  branch: "La Plata",
  favorites: [],
});
function restore(): Data {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      data &&
      Array.isArray(data.products) &&
      data.products.every(
        (p: Product) =>
          p.id &&
          p.stock?.["La Plata"] &&
          p.stock?.Ensenada &&
          Array.isArray(p.sizes),
      ) &&
      Array.isArray(data.orders) &&
      Array.isArray(data.cart) &&
      Array.isArray(data.favorites) &&
      ["La Plata", "Ensenada"].includes(data.branch)
    )
      return data;
  } catch {
    /* Use clean demo if storage is unavailable. */
  }
  return initial();
}
interface Context extends StoreContextType {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  placeOrder: (
    delivery: "pickup" | "shipping",
    customer: string,
  ) => { error?: string; order?: Order };
}
const StoreContext = createContext<Context | null>(null);
export const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
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
    setBranch: (branch) => {
      if (branch !== data.branch && data.cart.length)
        notify(
          "Cambiamos de sucursal. Tu bolsa se vació para consultar el stock correcto.",
        );
      setData((d) => ({
        ...d,
        branch,
        cart: branch === d.branch ? d.cart : [],
      }));
    },
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
    placeOrder: (delivery, customer) => {
      const d = live.current;
      const result = prepareOrder(
        d.products,
        d.cart,
        d.branch,
        delivery,
        customer,
        `M-${Date.now().toString(36).toUpperCase()}`,
        new Date().toISOString(),
      );
      if (result.error) return { error: result.error };
      const order = result.order as Order;
      const next = {
        ...d,
        products: result.products as Product[],
        orders: [order, ...d.orders],
        cart: [],
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
