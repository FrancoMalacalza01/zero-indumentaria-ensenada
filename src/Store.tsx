import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CartItem,
  Settings,
  Movement,
  Order,
  PaymentMethodId,
  Product,
  StockChange,
  StoreContextType,
} from "./types";
import { seedProducts } from "./data";
import { prepareOrder } from "./commerce.mjs";
import { flattenStock, needsStockMigration } from "./migrate.mjs";
import { fetchCatalog, fetchAjustes, fetchImportadosOcultos, crearPedido } from "./server";
import { leerAjustes, ajusteAFila } from "./menOverrides.mjs";
import type { AjustesHombre } from "./menOverrides.mjs";
import { fetchSettings, porDefecto } from "./settings";
import { costoEnvio } from "./settingsMap.mjs";
const KEY = "mistral-local-demo-v1";
/**
 * Los ajustes del catálogo de hombre se guardan aparte de la demo: no son parte
 * de ella (viven en el servidor) y "borrar los datos de la demo" no tiene que
 * llevárselos. Acá queda lo último que se supo, para que una tienda que no
 * llega al servidor no vuelva a mostrar lo que el local ya dio de baja.
 */
const KEY_AJUSTES = "zero-ajustes-hombre-v1";
function restaurarAjustes(): AjustesHombre {
  try {
    const filas = JSON.parse(localStorage.getItem(KEY_AJUSTES) || "null");
    return leerAjustes(filas);
  } catch {
    return {};
  }
}
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
    {
      // Una demo guardada cuando había dos locales trae el stock por
      // sucursal. Se convierte en vez de descartarla, así nadie pierde lo
      // que cargó. La bolsa sí se vacía: sus renglones apuntaban a una
      // sucursal que ya no existe.
      const vieja = needsStockMigration(data.products);
      return {
        ...data,
        products: data.products.map((p: Product) => ({
          ...p,
          stock: flattenStock(p.stock),
        })),
        cart: vieja ? [] : data.cart,
        // Los movimientos se incorporaron después: una demo guardada antes
        // no los tiene y no por eso hay que descartarla.
        movements: data.movements || [],
      };
    }
  } catch {
    /* Use clean demo if storage is unavailable. */
  }
  return initial();
}
/** Lo que quedó después de tocar el stock. */
export interface Asentado {
  movements: Movement[];
  products: Product[];
}
interface Context extends StoreContextType {
  /** De dónde salió el catálogo que se está mostrando. */
  catalogSource: "servidor" | "local";
  importadosOcultos: string[] | null;
  ajustesHombreCargados: boolean;
  /**
   * La configuración del local: whatsapp, dirección, formas de pago, zonas de
   * envío y devoluciones. Sale del servidor; mientras no llegue, la de
   * fábrica, para que la tienda nunca quede sin zonas ni sin dirección.
   */
  settings: Settings;
  /** Pisa la configuración en pantalla, después de guardarla en el servidor. */
  setSettings: (settings: Settings) => void;
  /**
   * Precios propios y bajas del catálogo de hombre. Sale del servidor; mientras
   * no llegue, lo último que se supo en este navegador.
   */
  menOverrides: AjustesHombre;
  /** Pisa los ajustes en pantalla, antes de guardarlos en el servidor. */
  setMenOverrides: (ajustes: AjustesHombre) => void;
  favorites: string[];
  movements: Movement[];
  toggleFavorite: (id: string) => void;
  /**
   * Pisa productos, pedidos e historial con lo que vino del servidor.
   *
   * Es un solo cambio a propósito: con tres por separado el panel quedaba un
   * instante con los productos nuevos y los pedidos viejos.
   */
  cargarDesdeServidor: (datos: {
    products: Product[];
    orders: Order[];
    movements: Movement[];
  }) => void;
  /**
   * Aplica cambios de stock y los deja asentados en el historial.
   *
   * Devuelve los movimientos que creó y los productos como quedaron, para
   * que el panel pueda publicar exactamente eso en el servidor en vez de
   * tener que adivinarlo de nuevo.
   */
  applyStock: (changes: StockChange[]) => Asentado;
  /** Solo asienta el historial, para cuando el stock ya quedó guardado. */
  recordMovements: (changes: StockChange[]) => Asentado;
  /**
   * Cierra la compra.
   *
   * Con servidor, la cuenta la hace la base en un solo paso: valida el stock,
   * lo descuenta y guarda el pedido con la fila trabada, así dos personas
   * comprando lo último no pueden comprarlo las dos. Sin servidor, la misma
   * transacción corre acá, en el navegador, que es lo que se puede hacer en
   * una demo.
   */
  placeOrder: (
    delivery: "pickup" | "shipping",
    customer: string,
    payment?: PaymentMethodId,
    zone?: string,
  ) => Promise<{ error?: string; order?: Order }>;
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
  const [catalogSource, setCatalogSource] = useState<"servidor" | "local">(
    "local",
  );
  const [settings, setSettings] = useState<Settings>(porDefecto);
  const [importadosOcultos, setImportadosOcultos] = useState<string[] | null>(null);
  const [menOverrides, setMenOverrides] = useState<AjustesHombre>(restaurarAjustes);
  const [ajustesHombreCargados, setAjustesHombreCargados] = useState(false);
  // Espejo del estado al día, para poder leerlo en el mismo tick en que se
  // escribe. Sin esto, dos cambios seguidos (guardar un producto y asentar su
  // movimiento, por ejemplo) se pisan: el segundo parte del estado viejo.
  const live = useRef(data);
  live.current = data;
  /**
   * Único camino para cambiar el estado. Calcula sobre el espejo, lo
   * actualiza y recién después avisa a React. Así el que llama puede seguir
   * trabajando con lo que quedó, sin esperar un render.
   */
  const actualizar = (cambio: (d: Data) => Data) => {
    const next = cambio(live.current);
    live.current = next;
    setData(next);
    return next;
  };
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = (text: string) => {
    clearTimeout(timer.current);
    setToast(text);
    timer.current = setTimeout(() => setToast(""), 4200);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  // El catálogo manda desde el servidor. Si no contesta, queda el que ya
  // estaba: más vale una tienda con precios de ayer que una vacía.
  // La configuración va aparte del catálogo: son dos pedidos distintos y uno
  // no tiene por qué esperar al otro.
  useEffect(() => {
    let vigente = true;
    fetchSettings().then((cfg) => {
      if (vigente && cfg) setSettings(cfg);
    });
    return () => {
      vigente = false;
    };
  }, []);
  useEffect(() => {
    let vigente = true;
    fetchImportadosOcultos().then((ids) => { if (vigente) setImportadosOcultos(ids); });
    return () => { vigente = false; };
  }, []);
  // Si el servidor no contesta (`null`), se queda lo último que se supo.
  useEffect(() => {
    let vigente = true;
    fetchAjustes().then((ajustes) => {
      if (vigente && ajustes) { setMenOverrides(ajustes); setAjustesHombreCargados(true); }
    });
    return () => {
      vigente = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY_AJUSTES,
        JSON.stringify(Object.entries(menOverrides).map(([id, a]) => ajusteAFila(id, a))),
      );
    } catch {
      /* Sin almacenamiento sigue andando: sólo no queda copia local. */
    }
  }, [menOverrides]);
  useEffect(() => {
    let vigente = true;
    fetchCatalog().then((productos) => {
      if (!vigente || !productos) return;
      actualizar((d) => ({ ...d, products: productos }));
      setCatalogSource("servidor");
    });
    return () => {
      vigente = false;
    };
  }, []);
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
    catalogSource,
    importadosOcultos,
    ajustesHombreCargados,
    settings,
    setSettings,
    menOverrides,
    setMenOverrides,
    notify,
    setProducts: (products) => actualizar((d) => ({ ...d, products })),
    setOrders: (orders) => actualizar((d) => ({ ...d, orders })),
    setCart: (cart) => actualizar((d) => ({ ...d, cart })),
    recordMovements: (changes) => {
      let movements: Movement[] = [];
      const next = actualizar((d) => {
        movements = buildMovements(d.products, changes);
        return { ...d, movements: [...movements, ...d.movements] };
      });
      return { movements, products: next.products };
    },
    applyStock: (changes) => {
      let movements: Movement[] = [];
      const next = actualizar((d) => {
        movements = buildMovements(d.products, changes);
        return {
          ...d,
          products: applyToProducts(d.products, changes),
          movements: [...movements, ...d.movements],
        };
      });
      return { movements, products: next.products };
    },
    cargarDesdeServidor: ({ products, orders, movements }) =>
      actualizar((d) => ({ ...d, products, orders, movements })),
    toggleFavorite: (id) =>
      actualizar((d) => ({
        ...d,
        favorites: d.favorites.includes(id)
          ? d.favorites.filter((x) => x !== id)
          : [...d.favorites, id],
      })),
    resetDemo: () => {
      actualizar(() => initial());
      notify("Demo restablecida.");
    },
    placeOrder: async (delivery, customer, payment, zone) => {
      // Si el catálogo vino del servidor, el pedido tiene que ir al servidor:
      // descontar stock acá nomás dejaría la base diciendo otra cosa.
      if (catalogSource === "servidor") {
        const { order, error } = await crearPedido(
          live.current.cart,
          customer,
          delivery,
          zone,
          payment,
        );
        if (error || !order) return { error: error || "No se pudo cerrar la compra." };
        actualizar((prev) => ({
          ...prev,
          orders: [order, ...prev.orders],
          cart: [],
        }));
        // El stock que vale es el del servidor, no el que teníamos nosotros.
        fetchCatalog().then((productos) => {
          if (productos) actualizar((prev) => ({ ...prev, products: productos }));
        });
        return { order };
      }
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
      const base = result.order as Order;
      // El envío se calcula con la misma cuenta que usa el servidor, para que
      // el total de la demo diga lo mismo que diría el total de verdad.
      const envio =
        delivery === "shipping"
          ? costoEnvio(settings, zone, base.total) || 0
          : 0;
      const order: Order = {
        ...base,
        subtotal: base.total,
        envio,
        total: base.total + envio,
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
      actualizar((prev) => ({
        ...prev,
        products: result.products as Product[],
        orders: [order, ...prev.orders],
        cart: [],
        movements: [...sales, ...prev.movements],
      }));
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
