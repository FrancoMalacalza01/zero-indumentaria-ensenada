import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CloudUpload,
  History,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Search,
  Receipt,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Tag,
  TrendingUp,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { useStore } from "./Store";
import type {
  Category,
  Movement,
  MovementReason,
  Order,
  Product,
  StockChange,
} from "./types";
import { paymentLabel } from "./payment";
import {
  adminLocked,
  checkAdminPassword,
  passwordCambiada,
  resetAdminPassword,
  setAdminPassword,
} from "./adminAccess";
import { useServerPanel } from "./useServerPanel";
import { prepararImagen as prepareImage } from "./imagen";
import AdminConfig from "./AdminConfig";
import AdminReturns from "./AdminReturns";
import AdminReports from "./AdminReports";
import AdminPrecios from "./AdminPrecios";
import catalogoImportado from "./men-catalog.json";
import { prepararFichaImportada } from "./importarCatalogo.mjs";
import { avisoDeCambio, leerPrecio } from "./menOverrides.mjs";
import { guardarSettings } from "./settings";
import type { Session } from "./auth";
import "./admin.css";

type Tab =
  | "overview"
  | "sale"
  | "inventory"
  | "precios"
  | "stock"
  | "movements"
  | "orders"
  | "returns"
  | "reports"
  | "config";
const pageTitles: Record<Tab, { crumb: string; title: string; lead: string }> =
  {
    overview: {
      crumb: "Resumen",
      title: "Tu negocio, en un solo lugar.",
      lead: "Una mirada rápida a lo que pasa en el local.",
    },
    sale: {
      crumb: "Venta del día",
      title: "¿Qué se lleva?",
      lead: "Anotá lo que sale por el mostrador y el stock queda al día.",
    },
    inventory: {
      crumb: "Productos y stock",
      title: "Productos y stock",
      lead: "Administrá el catálogo y las unidades disponibles.",
    },
    precios: {
      crumb: "Precios",
      title: "Precios de todos los artículos",
      lead: "Cambiá un precio con un clic, o muchos de una vez con una regla.",
    },
    stock: {
      crumb: "Cargar stock",
      title: "Cargar stock",
      lead: "Anotá lo que entra o sale y el sistema actualiza la tienda al instante.",
    },
    movements: {
      crumb: "Movimientos",
      title: "Movimientos de stock",
      lead: "Cada venta, ingreso y ajuste, con fecha y motivo.",
    },
    orders: {
      crumb: "Pedidos",
      title: "Pedidos",
      lead: "Seguí cada compra y organizá la preparación de tus pedidos.",
    },
    reports: {
      crumb: "Reportes",
      title: "Los números del local",
      lead: "Qué se vende, qué no se mueve y qué conviene reponer.",
    },
    returns: {
      crumb: "Devoluciones",
      title: "Devoluciones",
      lead: "Lo que vuelve, vuelve al stock. Lo que vuelve fallado, no.",
    },
    config: {
      crumb: "Configuración",
      title: "Configuración del local",
      lead: "Contacto, formas de pago, envíos y devoluciones.",
    },
  };
const addReasons: MovementReason[] = ["Ingreso", "Devolución"];
const removeReasons: MovementReason[] = ["Rotura", "Ajuste"];
const categories: Category[] = ["Hombre", "Accesorios"];
const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
const units = (product: Product) =>
  Object.values(product.stock || {}).reduce((sum, value) => sum + value, 0);
const orderStatuses: Order["status"][] = [
  "Pendiente",
  "Preparando",
  "Listo para retirar",
  "Completado",
];
/**
 * "Cancelado" y "Devuelto" no están en esa lista a propósito: los dos mueven
 * stock, así que no pueden ser un valor más de un desplegable. Se ponen desde
 * el botón de cancelar o desde la pestaña de devoluciones, que son los que
 * además devuelven las unidades.
 */
const pagoEtiquetas: Record<string, { texto: string; clase: string }> = {
  sin_pago: { texto: "Sin pagar", clase: "pago-sin" },
  pendiente: { texto: "Pago en curso", clase: "pago-curso" },
  aprobado: { texto: "Pagado", clase: "pago-ok" },
  rechazado: { texto: "Pago rechazado", clase: "pago-mal" },
  devuelto: { texto: "Pago devuelto", clase: "pago-mal" },
};
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

export default function Admin({
  onExit,
  onPreview,
  session,
  onLogout,
}: {
  /** Salir del panel y volver a la tienda. */
  onExit: () => void;
  /** Mirar la tienda sin salir del panel: se abre en otra pestaña. */
  onPreview: () => void;
  /**
   * La sesión del servidor. Con sesión el panel publica; sin ella trabaja en
   * modo demo, en este navegador y nada más.
   */
  session: Session | null;
  /** Cerrar sesión y volver al login. */
  onLogout: () => void;
}) {
  const {
    products,
    setProducts,
    orders,
    setOrders,
    notify,
    movements,
    applyStock,
    recordMovements,
    catalogSource,
    settings,
    setSettings,
    menOverrides,
    ajustesHombreCargados,
    setMenOverrides,
  } = useStore();
  // Todo lo que el panel manda al servidor sale por acá. Sin sesión, estas
  // funciones no hacen nada y el panel se comporta como la demo de antes.
  const panel = useServerPanel(session, onLogout);
  const [tab, setTab] = useState<Tab>("overview");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "Todas">(
    "Todas",
  );
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [orderFilter, setOrderFilter] = useState("Todos");
  const [orderSearch, setOrderSearch] = useState("");
  const formTrigger = useRef<HTMLElement | null>(null);
  const stockAlAbrir = useRef<Record<string, number>>({});
  const activeProducts = products.filter((p) => p.active);
  const inventoryUnits = products.reduce((sum, p) => sum + units(p), 0);
  const lowStock = products.filter((p) => p.active && units(p) <= 5);
  const pendingOrders = orders.filter((o) => o.status !== "Completado");
  const idsGuardados = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const inventario = useMemo(() => {
    const existentes = new Set(products.map((p) => p.sourceCatalogId).filter(Boolean));
    const importados = catalogoImportado.products
      .filter((p) => !existentes.has(p.id))
      .map((p) => prepararFichaImportada(p, menOverrides[p.id]));
    return [...products, ...importados];
  }, [products, menOverrides]);
  const filtered = useMemo(
    () =>
      inventario.filter(
        (p) =>
          `${p.name} ${p.brand || ""} ${p.type} ${p.color}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (categoryFilter === "Todas" || p.category === categoryFilter) &&
          (!lowOnly || units(p) <= 5),
      ),
    [inventario, search, categoryFilter, lowOnly],
  );
  const recentOrders = orders
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const visibleOrders = recentOrders.filter(
    (o) =>
      (orderFilter === "Todos" || o.status === orderFilter) &&
      `${o.id} ${o.customer}`.toLowerCase().includes(orderSearch.toLowerCase()),
  );

  function openEditor(product: Product | "new") {
    if (product !== "new" && product.sourceCatalogId && !products.some((p) => p.id === product.id) && panel.conectado && !ajustesHombreCargados) {
      notify("No se pudieron cargar los precios del catálogo. Recargá antes de editar esta prenda.");
      return;
    }
    formTrigger.current = document.activeElement as HTMLElement;
    stockAlAbrir.current = product === "new" ? {} : { ...product.stock };
    setEditing(product);
  }
  function closeEditor() {
    setEditing(null);
    requestAnimationFrame(() => formTrigger.current?.focus());
  }
  /**
   * Da de baja un producto del todo: sale de la tienda y del panel, con su
   * stock. Para sacarlo de la vista sin perderlo está "Ocultar".
   *
   * Lo que queda: el historial de movimientos (guarda el nombre adentro, justo
   * para esto) y los pedidos ya hechos. Antes de borrar, el stock que había se
   * anota como ajuste, para que el historial explique adónde fue.
   */
  function darDeBaja(product: Product) {
    const unidades = units(product);
    const detalle = unidades
      ? `Se pierden ${unidades} ${unidades === 1 ? "unidad" : "unidades"} de stock.`
      : "No tiene stock cargado.";
    if (
      !confirm(
        `¿Dar de baja "${product.name}"?\n\n${detalle} Sale de la tienda y del panel. El historial y los pedidos ya hechos se conservan. Esto no se puede deshacer.\n\nSi sólo querés que no se vea por ahora, usá Ocultar.`,
      )
    )
      return;
    const changes: StockChange[] = Object.entries(product.stock || {})
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => ({
        productId: product.id,
        size,
        delta: -qty,
        reason: "Ajuste" as MovementReason,
      }));
    // Primero el historial, que busca el nombre del producto en la lista.
    const asentado = changes.length ? recordMovements(changes) : null;
    setProducts(products.filter((p) => p.id !== product.id));
    if (asentado?.movements.length) panel.publicarMovimientos(asentado.movements);
    panel.despublicarBorrando(product.id);
    notify(`"${product.name}" dado de baja`);
    closeEditor();
  }
  function saveProduct(product: Product) {
    const previous = products.find((p) => p.id === product.id);
    const exists = !!previous;
    setProducts(
      exists
        ? products.map((p) => (p.id === product.id ? product : p))
        : [...products, product],
    );
    // Editar las cantidades a mano también deja rastro: así el historial
    // explica cualquier diferencia entre lo que hay y lo que figura.
    const changes: StockChange[] = [];
    const changedSizes = new Set([
      ...Object.keys(previous?.stock || {}),
      ...Object.keys(product.stock || {}),
    ]);
    changedSizes.forEach((size) => {
      const delta = (product.stock[size] || 0) - (previous?.stock[size] || 0);
      if (delta)
        changes.push({
          productId: product.id,
          size,
          delta,
          reason: exists ? "Ajuste" : "Ingreso",
        });
    });
    const asentado = changes.length ? recordMovements(changes) : null;
    // El producto se publica siempre; los movimientos solo si hubo. Y en ese
    // orden: el stock del servidor cuelga del producto.
    const lista = asentado?.products || products;
    const posicion = Math.max(
      0,
      lista.findIndex((p) => p.id === product.id),
    );
    panel.publicar(product, posicion, stockAlAbrir.current);
    if (asentado?.movements.length) panel.publicarMovimientos(asentado.movements);
    notify(
      panel.conectado
        ? exists
          ? "Producto actualizado y publicado"
          : "Producto agregado y publicado"
        : exists
          ? "Producto actualizado en la tienda"
          : "Producto agregado a la tienda",
    );
    closeEditor();
  }
  /**
   * Cancela un pedido y le devuelve el stock.
   *
   * Con servidor lo hace la base en un solo paso. Sin servidor (modo demo) se
   * hace acá, que es lo que se puede: se repone el stock, queda el movimiento
   * y el pedido pasa a Cancelado.
   */
  function cancelar(order: Order) {
    const unidades = order.items.reduce((s, i) => s + i.quantity, 0);
    if (
      !confirm(
        `¿Cancelar el pedido ${order.id}?\n\nVuelven ${unidades} ${unidades === 1 ? "unidad" : "unidades"} al stock. Esto no se puede deshacer.`,
      )
    )
      return;
    if (panel.conectado) {
      panel.cancelar(order.id);
      // En pantalla se adelanta; la recarga que viene después confirma.
      setOrders(
        orders.map((o) =>
          o.id === order.id
            ? { ...o, status: "Cancelado", paymentStatus: "rechazado" }
            : o,
        ),
      );
      notify("Pedido cancelado y stock devuelto");
      return;
    }
    applyStock(
      order.items.map((i) => ({
        productId: i.productId,
        size: i.size,
        delta: i.quantity,
        reason: "Devolución" as const,
        orderId: order.id,
      })),
    );
    setOrders(
      orders.map((o) =>
        o.id === order.id ? { ...o, status: "Cancelado" } : o,
      ),
    );
    notify("Pedido cancelado y stock devuelto");
  }
  function setOrderStatus(id: string, status: Order["status"]) {
    const siguientes = orders.map((o) => (o.id === id ? { ...o, status } : o));
    setOrders(siguientes);
    const cambiado = siguientes.find((o) => o.id === id);
    if (cambiado) panel.publicarPedido(cambiado);
    notify("Estado del pedido actualizado");
  }
  function exportStock() {
    const rows = [
      [
        "Producto",
        "Categoría",
        "Color",
        "Talle",
        "Stock",
        "Precio ARS",
        "Visible",
      ],
    ];
    filtered.forEach((p) =>
      p.sizes.forEach((s) =>
        rows.push([
          p.name,
          p.category,
          p.color,
          s,
          String(p.stock[s] || 0),
          String(p.price),
          p.active ? "Sí" : "No",
        ]),
      ),
    );
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (cell) =>
                `"${(/^[=+\-@]/.test(cell) ? "'" : "") + cell.replace(/"/g, '""')}"`,
            )
            .join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zero-inventario.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Inventario exportado");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button
          className="admin-brand"
          onClick={onExit}
          aria-label="Volver a Zero Indumentaria"
        >
          zero<span>INDUMENTARIA · GESTIÓN</span>
        </button>
        <div className="admin-location">
          <span className="admin-location-icon">
            <Store size={19} />
          </span>
          <div>
            <strong>Zero Indumentaria</strong>
            <small>Ensenada</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="admin-nav-label">TU NEGOCIO</span>
        <nav className="admin-nav" aria-label="Administración">
          <button
            className={tab === "overview" ? "is-active" : ""}
            onClick={() => setTab("overview")}
          >
            <LayoutDashboard size={19} />
            <span className="admin-nav-full">Resumen</span>
            <span className="admin-nav-short">Resumen</span>
          </button>
          <button
            className={tab === "sale" ? "is-active" : ""}
            onClick={() => setTab("sale")}
          >
            <Receipt size={19} />
            <span className="admin-nav-full">Venta del día</span>
            <span className="admin-nav-short">Venta</span>
          </button>
          <button
            className={tab === "inventory" ? "is-active" : ""}
            onClick={() => setTab("inventory")}
          >
            <Boxes size={19} />
            <span className="admin-nav-full">Productos y stock</span>
            <span className="admin-nav-short">Productos</span>
          </button>
          <button
            className={tab === "precios" ? "is-active" : ""}
            onClick={() => setTab("precios")}
          >
            <Tag size={19} />
            <span className="admin-nav-full">Precios</span>
            <span className="admin-nav-short">Precios</span>
          </button>
          <button
            className={tab === "stock" ? "is-active" : ""}
            onClick={() => setTab("stock")}
          >
            <PackagePlus size={19} />
            <span className="admin-nav-full">Cargar stock</span>
            <span className="admin-nav-short">Cargar</span>
          </button>
          <button
            className={tab === "movements" ? "is-active" : ""}
            onClick={() => setTab("movements")}
          >
            <History size={19} />
            <span className="admin-nav-full">Movimientos</span>
            <span className="admin-nav-short">Historial</span>
          </button>
          <button
            className={tab === "orders" ? "is-active" : ""}
            onClick={() => setTab("orders")}
          >
            <ShoppingBag size={19} />
            <span className="admin-nav-full">Pedidos</span>
            <span className="admin-nav-short">Pedidos</span>
            {pendingOrders.length > 0 && <b>{pendingOrders.length}</b>}
          </button>
          <button
            className={tab === "reports" ? "is-active" : ""}
            onClick={() => setTab("reports")}
          >
            <TrendingUp size={19} />
            <span className="admin-nav-full">Reportes</span>
            <span className="admin-nav-short">Números</span>
          </button>
          <button
            className={tab === "returns" ? "is-active" : ""}
            onClick={() => setTab("returns")}
          >
            <Undo2 size={19} />
            <span className="admin-nav-full">Devoluciones</span>
            <span className="admin-nav-short">Devolver</span>
          </button>
          <button
            className={tab === "config" ? "is-active" : ""}
            onClick={() => setTab("config")}
          >
            <Settings size={19} />
            <span className="admin-nav-full">Configuración</span>
            <span className="admin-nav-short">Config</span>
          </button>
        </nav>
        <div className="admin-sidebar-bottom">
          {panel.conectado ? (
            <div className="admin-demo-note is-live">
              <CloudUpload size={19} />
              <strong>Tu tienda, en vivo</strong>
              <p>
                Los productos, el stock y los pedidos salen del servidor y
                vuelven a él.
              </p>
              <span>{session?.email}</span>
            </div>
          ) : (
            <div className="admin-demo-note">
              <CircleHelp size={19} />
              <strong>Un vistazo a tu próxima tienda</strong>
              <p>Explorá la gestión de productos, stock y pedidos.</p>
              <span>PROTOTIPO INTERACTIVO</span>
            </div>
          )}
          <button className="admin-back-store" onClick={onExit}>
            <ArrowLeft size={17} /> Volver a la tienda
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="admin-mobile-brand">zero</span>
            <span className="admin-breadcrumb">
              Administración <span>/</span>{" "}
{pageTitles[tab].crumb}
            </span>
          </div>
          <div className="admin-topbar-right">
            <span
              className={`admin-demo-badge ${panel.conectado ? "is-live" : ""}`}
            >
              <span /> {panel.conectado ? "Conectado" : "Modo demo"}
            </span>
            <button
              className="admin-store-link"
              onClick={onPreview}
              title="Abre la tienda en otra pestaña"
            >
              Ver tienda <ArrowUpRight size={15} />
            </button>
            {adminLocked && !panel.conectado && (
              <button
                className="admin-avatar"
                onClick={() => setPasswordOpen(true)}
                title="Cambiar la contraseña del modo demo"
                aria-label="Cambiar la contraseña del modo demo"
              >
                <KeyRound size={15} />
              </button>
            )}
            <button
              className="admin-avatar"
              onClick={onLogout}
              title={panel.conectado ? "Cerrar sesión" : "Salir del modo demo"}
              aria-label={
                panel.conectado ? "Cerrar sesión" : "Salir del modo demo"
              }
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
        <main className="admin-main">
          {panel.conectado ? (
            panel.estado === "error" ? (
              <div className="admin-local-banner admin-banner-error" role="alert">
                <TriangleAlert size={16} />
                <p>
                  <b>Esto no quedó guardado en el servidor.</b> {panel.error}
                </p>
                <button className="admin-text-button" onClick={panel.recargar}>
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="admin-local-banner admin-banner-ok">
                <CloudUpload size={16} />
                <p>
                  {panel.estado === "guardando"
                    ? "Guardando en el servidor…"
                    : panel.estado === "cargando"
                      ? "Trayendo los datos del servidor…"
                      : "Conectado. Lo que cargues acá se publica en la tienda."}
                </p>
              </div>
            )
          ) : (
            <div className="admin-local-banner">
              <CircleHelp size={16} />
              <p>
                {catalogSource === "servidor" ? (
                  <>
                    <b>Modo demo.</b> El catálogo que ve el cliente viene del
                    servidor, pero lo que edites acá se guarda solo en este
                    navegador y no se publica. Para publicar hay que entrar con
                    usuario.
                  </>
                ) : (
                  <>
                    <b>Modo demo.</b> Los cambios se guardan solo en este
                    navegador, no se publican y no se procesan compras reales.
                  </>
                )}
              </p>
            </div>
          )}
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">ENSENADA</span>
              <h1>
{pageTitles[tab].title}
              </h1>
              <p>
{pageTitles[tab].lead}
              </p>
            </div>
            {(tab === "overview" || tab === "inventory") && (
              <button
                className="admin-button admin-button-primary"
                onClick={() => openEditor("new")}
              >
                <Plus size={18} /> Nuevo producto
              </button>
            )}
          </div>

          {tab === "overview" && (
            <>
              <section
                className="admin-metrics"
                aria-label="Resumen de actividad"
              >
                <Metric
                  icon={<Package size={20} />}
                  label="Productos publicados"
                  value={String(activeProducts.length)}
                  foot={`${products.length} productos en tu catálogo`}
                />
                <Metric
                  icon={<Boxes size={20} />}
                  label="Unidades en stock"
                  value={inventoryUnits.toLocaleString("es-AR")}
                  foot="En el local"
                />
                <Metric
                  icon={<ShoppingBag size={20} />}
                  label="Pedidos activos"
                  value={String(pendingOrders.length)}
                  foot="Pedidos de demostración"
                />
                <Metric
                  icon={<History size={20} />}
                  label="Unidades vendidas"
                  value={String(
                    movements
                      .filter((m) => m.reason === "Venta")
                      .reduce((sum, m) => sum - m.delta, 0),
                  )}
                  foot="Descontadas del stock automáticamente"
                />
                <Metric
                  icon={<TrendingUp size={20} />}
                  label="Ventas registradas"
                  value={money(orders.reduce((sum, o) => sum + o.total, 0))}
                  foot="Importe total de pedidos demo"
                />
              </section>
              <div className="admin-overview-grid">
                <section className="admin-card admin-orders-card">
                  <div className="admin-card-heading">
                    <div>
                      <h2>Últimos pedidos</h2>
                      <p>El movimiento más reciente de tu tienda.</p>
                    </div>
                    <button
                      className="admin-text-button"
                      onClick={() => setTab("orders")}
                    >
                      Ver todos <ArrowRight size={16} />
                    </button>
                  </div>
                  {orders.length ? (
                    <div className="admin-recent-orders">
                      {recentOrders.slice(0, 5).map((order) => (
                        <button
                          key={order.id}
                          className="admin-recent-order"
                          onClick={() => setTab("orders")}
                        >
                          <span className="admin-order-icon">
                            <ShoppingBag size={19} />
                          </span>
                          <span className="admin-order-info">
                            <strong>{order.customer}</strong>
                            <small>
                              #{order.id.slice(-8).toUpperCase()} ·{" "}
                              {order.delivery === "shipping"
                                ? order.zone || "Envío"
                                : "Retiro"}
                            </small>
                          </span>
                          <span className="admin-order-summary">
                            <strong>{money(order.total)}</strong>
                            <StatusBadge status={order.status} />
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<ClipboardList size={29} />}
                      title="Acá van a aparecer tus pedidos"
                      text="Completá una compra de prueba en la tienda para ver cómo funciona."
                      action={
                        <button className="admin-text-button" onClick={onExit}>
                          Ir a la tienda <ArrowRight size={16} />
                        </button>
                      }
                    />
                  )}
                </section>
                <section className="admin-card">
                  <div className="admin-card-heading">
                    <div>
                      <h2>Stock por categoría</h2>
                      <p>Disponibilidad actual del inventario.</p>
                    </div>
                    <MapPin size={20} />
                  </div>
                  <div className="admin-branch-cards">
                    {categories.map((category, i) => {
                      const count = products
                        .filter((p) => p.category === category)
                        .reduce((sum, p) => sum + units(p), 0);
                      return (
                        <div key={category} className="admin-branch-stock">
                          <div>
                            <span
                              className={`admin-branch-symbol admin-branch-symbol-${i}`}
                            >
                              <Store size={20} />
                            </span>
                            <span>
                              <strong>{category}</strong>
                              <small>Unidades en el local</small>
                            </span>
                            <b>
                              {count}
                              <small>unidades</small>
                            </b>
                          </div>
                          <div className="admin-stock-track">
                            <span
                              style={{
                                width: `${inventoryUnits ? (count / inventoryUnits) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="admin-branch-footer"
                    onClick={() => setTab("inventory")}
                  >
                    Administrar inventario <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <section className="admin-card admin-alert-card">
                <div className="admin-card-heading">
                  <div className="admin-alert-heading">
                    <span>
                      <TriangleAlert size={20} />
                    </span>
                    <div>
                      <h2>Atención al stock</h2>
                      <p>
                        {lowStock.length
                          ? `${lowStock.length} productos con 5 unidades o menos.`
                          : "Todos los productos publicados tienen más de 5 unidades disponibles."}
                      </p>
                    </div>
                  </div>
                  <button
                    className="admin-text-button"
                    onClick={() => {
                      setLowOnly(true);
                      setTab("inventory");
                    }}
                  >
                    Revisar stock <ArrowRight size={16} />
                  </button>
                </div>
                {lowStock.length > 0 && (
                  <div className="admin-low-list">
                    {lowStock.slice(0, 4).map((p) => (
                      <button key={p.id} onClick={() => openEditor(p)}>
                        <img src={p.image} alt="" />
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.color}</small>
                        </span>
                        <b className={units(p) === 0 ? "admin-zero" : ""}>
                          {units(p)} u.
                        </b>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {tab === "inventory" && (
            <section className="admin-card admin-inventory-card">
              <div className="admin-inventory-heading">
                <div>
                  <h2>
                    Tu catálogo <span>{inventario.length}</span>
                  </h2>
                  <p>Los cambios se reflejan en la tienda al instante.</p>
                </div>
                <button
                  className="admin-button admin-button-outline"
                  onClick={exportStock}
                >
                  <ArrowDownToLine size={17} /> Exportar CSV
                </button>
              </div>
              <div className="admin-filters">
                <label className="admin-search">
                  <Search size={18} />
                  <input
                    aria-label="Buscar productos"
                    placeholder="Buscar por nombre, tipo o color…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="admin-filter-select">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Filtrar categoría"
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as Category | "Todas")
                    }
                  >
                    <option value="Todas">Todas las categorías</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={`admin-low-toggle ${lowOnly ? "is-active" : ""}`}
                  onClick={() => setLowOnly(!lowOnly)}
                  aria-pressed={lowOnly}
                >
                  <TriangleAlert size={15} /> Stock bajo
                </button>
              </div>
              <div
                className="admin-table-wrap"
                role="region"
                aria-label="Inventario de productos"
                tabIndex={0}
              >
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>PRODUCTO</th>
                      <th>PRECIO</th>
                      <th>STOCK</th>
                      <th>ESTADO</th>
                      <th>
                        <span className="admin-sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="admin-product-cell">
                            <img src={p.image} alt="" />
                            <div>
                              <strong>{p.name}</strong>
                              <span>
                                {p.category} · {p.color}
                              </span>
                              <small>{p.sizes.join(" / ")}</small>
                            </div>
                          </div>
                        </td>
                        <td className="admin-price-cell">{money(p.price)}</td>
                        <td>
                          <span
                            className={`admin-stock-pill ${units(p) === 0 ? "admin-stock-empty" : units(p) <= 5 ? "admin-stock-low" : ""}`}
                          >
                            <span /> {!idsGuardados.has(p.id) ? "Sin cargar" : `${units(p)} unidades`}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`admin-publish-status ${p.active ? "is-published" : ""}`}
                            disabled={!idsGuardados.has(p.id)}
                            onClick={() => {
                              const siguientes = products.map((product) =>
                                product.id === p.id
                                  ? { ...product, active: !product.active }
                                  : product,
                              );
                              setProducts(siguientes);
                              const cambiado = siguientes.find(
                                (x) => x.id === p.id,
                              );
                              if (cambiado)
                                panel.publicar(
                                  cambiado,
                                  siguientes.indexOf(cambiado),
                                );
                              notify(
                                p.active
                                  ? "Producto ocultado de la tienda"
                                  : "Producto publicado",
                              );
                            }}
                            title={!idsGuardados.has(p.id) ? "Editá la ficha para administrarla" : p.active ? "Ocultar de la tienda" : "Publicar en la tienda"}
                            aria-label={`${!idsGuardados.has(p.id) ? "Editar para administrar" : p.active ? "Ocultar" : "Publicar"} ${p.name}`}
                          >
                            <span />
                            {!idsGuardados.has(p.id) ? "Editar para administrar" : p.active ? "Publicado" : "Oculto"}
                          </button>
                        </td>
                        <td>
                          <button
                            className="admin-edit-button"
                            onClick={() => openEditor(p)}
                          >
                            Editar <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <Empty
                  icon={<Search size={28} />}
                  title="No encontramos productos"
                  text="Probá otra búsqueda o ajustá los filtros."
                  action={
                    <button
                      className="admin-text-button"
                      onClick={() => {
                        setSearch("");
                        setCategoryFilter("Todas");
                        setLowOnly(false);
                      }}
                    >
                      Limpiar filtros
                    </button>
                  }
                />
              )}
              <div className="admin-table-footer">
                <span>
                  {filtered.length} de {inventario.length} productos
                </span>
                <span>
                  <span className="admin-stock-key" /> Stock bajo: hasta 5
                  unidades
                </span>
              </div>
            </section>
          )}

          {tab === "sale" && (
            <SaleRegister
              products={activeProducts}
              onSell={(changes, label) => {
                const { products: siguientes, movements } = applyStock(changes);
                panel.publicarStock(siguientes, movements);
                notify(label);
              }}
            />
          )}

          {tab === "stock" && (
            <StockLoader
              products={activeProducts}
              onApply={(changes, label) => {
                const { products: siguientes, movements } = applyStock(changes);
                panel.publicarStock(siguientes, movements);
                notify(label);
              }}
            />
          )}
          {tab === "movements" && <MovementsView movements={movements} />}

          {tab === "precios" && (
            <AdminPrecios
              productos={products}
              ajustes={menOverrides}
              conectado={panel.conectado}
              notify={notify}
              onAplicar={(siguiente, tocados) => {
                // En pantalla primero; el servidor confirma (o avisa) después.
                if (tocados.men.length) {
                  setMenOverrides(siguiente.ajustes);
                  panel.publicarAjustes(tocados.men, siguiente.ajustes);
                }
                if (tocados.db.length) {
                  setProducts(siguiente.productos);
                  // Sólo los que cambiaron: mandar todos es la forma más fácil
                  // de pisar lo que hizo otra persona al mismo tiempo.
                  for (const id of tocados.db) {
                    const producto = siguiente.productos.find((p) => p.id === id);
                    if (producto)
                      panel.publicar(producto, siguiente.productos.indexOf(producto));
                  }
                }
              }}
            />
          )}

          {tab === "reports" && (
            <AdminReports
              products={products}
              movements={movements}
              orders={orders}
            />
          )}

          {tab === "returns" && (
            <AdminReturns
              orders={orders}
              onReturn={(changes, _orderId, resumen) => {
                const { products: siguientes, movements: movs } =
                  applyStock(changes);
                panel.publicarStock(siguientes, movs);
                notify(resumen);
              }}
              onOrderStatus={setOrderStatus}
            />
          )}

          {tab === "config" && (
            <AdminConfig
              settings={settings}
              conectado={panel.conectado}
              notify={notify}
              onSave={async (nuevos) => {
                if (!session) throw new Error("Hay que entrar con usuario.");
                await guardarSettings(session, nuevos);
                // Se pisa en pantalla recién cuando el servidor lo aceptó.
                setSettings(nuevos);
              }}
            />
          )}

          {tab === "orders" && (
            <section className="admin-card admin-inventory-card">
              <div className="admin-inventory-heading">
                <div>
                  <h2>
                    Pedidos de la tienda <span>{orders.length}</span>
                  </h2>
                  <p>
                    {panel.conectado
                      ? "Pedidos guardados en el servidor."
                      : "Compras simuladas, guardadas en este navegador."}
                  </p>
                </div>
              </div>
              <div className="admin-filters">
                <label className="admin-search">
                  <Search size={18} />
                  <input
                    aria-label="Buscar pedidos"
                    placeholder="Buscar cliente o número de pedido…"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                </label>
                <label className="admin-filter-select">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Filtrar estado de pedido"
                    value={orderFilter}
                    onChange={(e) => setOrderFilter(e.target.value)}
                  >
                    <option value="Todos">Todos los estados</option>
                    {orderStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              {visibleOrders.length ? (
                <div
                  className="admin-table-wrap"
                  role="region"
                  aria-label="Pedidos"
                  tabIndex={0}
                >
                  <table className="admin-table admin-orders-table">
                    <thead>
                      <tr>
                        <th>PEDIDO / CLIENTE</th>
                        <th>PRODUCTOS</th>
                        <th>ENTREGA</th>
                        <th>TOTAL</th>
                        <th>COBRO</th>
                        <th>ESTADO</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <div className="admin-order-id">
                              <strong>#{o.id.slice(-8).toUpperCase()}</strong>
                              <span>{o.customer}</span>
                              <small>{dateLabel(o.date)}</small>
                            </div>
                          </td>
                          <td>
                            <div className="admin-order-items">
                              {o.items.map((item, index) => (
                                <span
                                  key={`${item.productId}-${item.size}-${index}`}
                                >
                                  {item.quantity} × {item.name}
                                  <small>Talle {item.size}</small>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="admin-order-id">
                              <strong>
                                {o.delivery === "pickup"
                                  ? "Retiro en el local"
                                  : "Envío a domicilio"}
                              </strong>
                              <span>
                                {o.delivery === "shipping"
                                  ? o.zone || "A convenir"
                                  : "En el local"}
                              </span>
                              {o.payment && (
                                <small>{paymentLabel(o.payment)}</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="admin-order-id">
                              <strong>{money(o.total)}</strong>
                              {o.envio ? (
                                <small>{money(o.envio)} de envío</small>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`admin-pago ${
                                pagoEtiquetas[o.paymentStatus || "sin_pago"]
                                  ?.clase || "pago-sin"
                              }`}
                            >
                              <span />
                              {pagoEtiquetas[o.paymentStatus || "sin_pago"]
                                ?.texto || "Sin pagar"}
                            </span>
                            {o.mailEnviadoAt && (
                              <small className="admin-pago-nota">
                                Mail enviado
                              </small>
                            )}
                          </td>
                          <td>
                            {["Cancelado", "Devuelto"].includes(o.status) ? (
                              <span className="admin-pago pago-mal">
                                <span />
                                {o.status}
                              </span>
                            ) : (
                              <select
                                className="admin-status-select"
                                aria-label={`Estado del pedido ${o.id}`}
                                value={o.status}
                                onChange={(e) =>
                                  setOrderStatus(
                                    o.id,
                                    e.target.value as Order["status"],
                                  )
                                }
                              >
                                {orderStatuses.map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            {!["Cancelado", "Devuelto"].includes(o.status) && (
                              <button
                                className="admin-text-button"
                                onClick={() => cancelar(o)}
                                title="Cancelar y devolver el stock"
                              >
                                Cancelar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  icon={<ShoppingBag size={30} />}
                  title={
                    orders.length
                      ? "No hay pedidos con estos filtros"
                      : "Todo listo para tu primera venta"
                  }
                  text={
                    orders.length
                      ? "Ajustá la búsqueda para ver otros pedidos."
                      : "Hacé una compra de prueba desde la tienda. El pedido aparecerá acá."
                  }
                  action={
                    !orders.length ? (
                      <button
                        className="admin-button admin-button-primary"
                        onClick={onExit}
                      >
                        Explorar la tienda <ArrowRight size={16} />
                      </button>
                    ) : undefined
                  }
                />
              )}
            </section>
          )}
          <footer className="admin-footer">
            <span>
              zero <span>·</span> Ensenada
            </span>
            <span>Panel de administración · Prototipo</span>
          </footer>
        </main>
      </div>
      {editing !== null && (
        <ProductEditor
          product={editing === "new" ? undefined : editing}
          onSave={saveProduct}
          onDelete={editing !== "new" && !editing.sourceCatalogId ? darDeBaja : undefined}
          onClose={closeEditor}
          notify={notify}
        />
      )}
      {passwordOpen && (
        <PasswordDialog
          onClose={() => setPasswordOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

/**
 * Venta de mostrador. Tocás el talle y se suma al ticket; al confirmar, baja
 * del stock y queda asentado como Venta, con un número que agrupa todo lo que
 * se llevó la misma persona. No se toca plata: esto es para saber qué queda.
 */
function SaleRegister({
  products,
  onSell,
}: {
  products: Product[];
  onSell: (changes: StockChange[], label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [ticket, setTicket] = useState<Record<string, number>>({});
  const matches = products.filter((p) =>
    `${p.name} ${p.type} ${p.color}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const lineas = Object.entries(ticket)
    .filter(([, n]) => n > 0)
    .map(([key, cantidad]) => {
      const [productId, size] = key.split("|");
      const product = products.find((p) => p.id === productId);
      return { key, productId, size, cantidad, product };
    });
  const unidades = lineas.reduce((sum, l) => sum + l.cantidad, 0);
  /** Lo que queda en la percha después de apartar lo del ticket. */
  const restante = (p: Product, size: string) =>
    (p.stock[size] || 0) - (ticket[`${p.id}|${size}`] || 0);
  function sumar(p: Product, size: string) {
    if (restante(p, size) <= 0) return;
    const key = `${p.id}|${size}`;
    setTicket((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  }
  function restar(key: string) {
    setTicket((prev) => {
      const n = (prev[key] || 0) - 1;
      const next = { ...prev };
      if (n <= 0) delete next[key];
      else next[key] = n;
      return next;
    });
  }
  function confirmar() {
    if (!lineas.length) return;
    const venta = `V-${Date.now().toString(36).toUpperCase()}`;
    onSell(
      lineas.map((l) => ({
        productId: l.productId,
        size: l.size,
        delta: -l.cantidad,
        reason: "Venta" as const,
        orderId: venta,
      })),
      `Venta registrada · ${unidades} ${unidades === 1 ? "unidad" : "unidades"}`,
    );
    setTicket({});
    setQuery("");
  }
  return (
    <section className="admin-card admin-stock">
      <div className="admin-inventory-heading">
        <div>
          <h2>Buscá la prenda y tocá el talle</h2>
          <p>
            Cada toque suma una unidad al ticket. Al confirmar baja del stock y
            queda asentado en Movimientos con su número de venta.
          </p>
        </div>
      </div>
      <div className="admin-sale">
        <div>
          <label className="admin-search admin-stock-search">
            <Search size={18} />
            <input
              aria-label="Buscar la prenda"
              placeholder="Buscá la prenda por nombre, tipo o color…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {matches.length === 0 ? (
            <Empty
              icon={<Package size={26} />}
              title="No encontramos esa prenda"
              text="Probá con otro nombre o revisá que esté publicada."
            />
          ) : (
            <ul className="admin-stock-list">
              {matches.slice(0, 12).map((p) => (
                <li key={p.id}>
                  <div className="admin-stock-product">
                    <img src={p.image} alt="" />
                    <div>
                      <b>{p.name}</b>
                      <span>
                        {p.type} · {p.color}
                      </span>
                    </div>
                  </div>
                  <div className="admin-sale-sizes">
                    {p.sizes.map((size) => {
                      const queda = restante(p, size);
                      return (
                        <button
                          key={size}
                          type="button"
                          className="admin-sale-size"
                          disabled={queda <= 0}
                          onClick={() => sumar(p, size)}
                          aria-label={`Sumar ${p.name} talle ${size}. Quedan ${queda}`}
                        >
                          <b>{size}</b>
                          <span>{queda > 0 ? `quedan ${queda}` : "sin stock"}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="admin-ticket">
          <h3>
            Se lleva <span>{unidades}</span>
          </h3>
          {lineas.length === 0 ? (
            <p className="admin-ticket-vacio">
              Todavía no sumaste nada. Buscá la prenda y tocá el talle.
            </p>
          ) : (
            <ul>
              {lineas.map((l) => (
                <li key={l.key}>
                  <div>
                    <b>{l.product?.name || "Prenda eliminada"}</b>
                    <span>Talle {l.size}</span>
                  </div>
                  <div className="admin-ticket-cantidad">
                    <button
                      type="button"
                      onClick={() => restar(l.key)}
                      aria-label={`Sacar una unidad de talle ${l.size}`}
                    >
                      <Minus size={14} />
                    </button>
                    <strong>{l.cantidad}</strong>
                    <button
                      type="button"
                      disabled={!l.product || restante(l.product, l.size) <= 0}
                      onClick={() => l.product && sumar(l.product, l.size)}
                      aria-label={`Sumar una unidad de talle ${l.size}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            className="admin-button admin-button-primary"
            disabled={!lineas.length}
            onClick={confirmar}
          >
            Registrar venta
          </button>
          {lineas.length > 0 && (
            <button className="admin-text-button" onClick={() => setTicket({})}>
              Vaciar
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
/** Carga de stock pensada para el mostrador: buscás la prenda,
 *  escribís cuánto entró o salió y confirmás todo junto. */
function StockLoader({
  products,
  onApply,
}: {
  products: Product[];
  onApply: (changes: StockChange[], label: string) => void;
}) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [reason, setReason] = useState<MovementReason>("Ingreso");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const reasons = direction === "add" ? addReasons : removeReasons;
  const matches = products.filter((p) =>
    `${p.name} ${p.type} ${p.color}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const changes: StockChange[] = [];
  Object.entries(draft).forEach(([key, value]) => {
    const amount = Math.floor(Number(value));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const [productId, size] = key.split("|");
    changes.push({
      productId,
      size,
      delta: direction === "add" ? amount : -amount,
      reason,
    });
  });
  const units = changes.reduce((sum, c) => sum + Math.abs(c.delta), 0);
  function setDirectionAndReason(next: "add" | "remove") {
    setDirection(next);
    setReason(next === "add" ? addReasons[0] : removeReasons[0]);
  }
  function confirm() {
    if (!changes.length) return;
    onApply(
      changes,
      `${direction === "add" ? "Sumaste" : "Descontaste"} ${units} ${
        units === 1 ? "unidad" : "unidades"
      }`,
    );
    setDraft({});
  }
  return (
    <section className="admin-card admin-stock">
      <div className="admin-inventory-heading">
        <div>
          <h2>¿Qué movimiento querés registrar?</h2>
          <p>
            Lo que cargues acá cambia el stock de la tienda y queda asentado en
            Movimientos.
          </p>
        </div>
      </div>
      <div className="admin-stock-setup">
        <div className="admin-stock-group" role="group" aria-label="Tipo">
          <button
            className={direction === "add" ? "is-active" : ""}
            aria-pressed={direction === "add"}
            onClick={() => setDirectionAndReason("add")}
          >
            <Plus size={15} /> Sumar unidades
          </button>
          <button
            className={direction === "remove" ? "is-active" : ""}
            aria-pressed={direction === "remove"}
            onClick={() => setDirectionAndReason("remove")}
          >
            <Minus size={15} /> Descontar unidades
          </button>
        </div>
        <label className="admin-filter-select">
          <ClipboardList size={16} />
          <select
            aria-label="Motivo del movimiento"
            value={reason}
            onChange={(e) => setReason(e.target.value as MovementReason)}
          >
            {reasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="admin-search admin-stock-search">
        <Search size={18} />
        <input
          aria-label="Buscar la prenda"
          placeholder="Buscá la prenda por nombre, tipo o color…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {matches.length === 0 ? (
        <Empty
          icon={<Package size={26} />}
          title="No encontramos esa prenda"
          text="Probá con otro nombre o revisá que esté publicada."
        />
      ) : (
        <ul className="admin-stock-list">
          {matches.slice(0, 12).map((p) => (
            <li key={p.id}>
              <div className="admin-stock-product">
                <img src={p.image} alt="" />
                <div>
                  <b>{p.name}</b>
                  <span>
                    {p.type} · {p.color}
                  </span>
                </div>
              </div>
              <div className="admin-stock-sizes">
                {p.sizes.map((size) => {
                  const key = `${p.id}|${size}`;
                  const current = p.stock[size] || 0;
                  const typed = Math.floor(Number(draft[key]));
                  const valid = Number.isFinite(typed) && typed > 0;
                  const next = valid
                    ? Math.max(
                        0,
                        direction === "add" ? current + typed : current - typed,
                      )
                    : current;
                  return (
                    <label key={size} className="admin-stock-size">
                      <span className="admin-stock-size-name">{size}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`${direction === "add" ? "Sumar a" : "Descontar de"} ${p.name}, talle ${size}`}
                        value={draft[key] || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.value })
                        }
                      />
                      <span
                        className={`admin-stock-preview ${valid ? "is-changed" : ""}`}
                      >
                        {valid ? `${current} → ${next}` : `hay ${current}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-stock-bar">
        <p>
          {changes.length
            ? `${units} ${units === 1 ? "unidad" : "unidades"} en ${changes.length} ${
                changes.length === 1 ? "talle" : "talles"
              } · ${reason}`
            : "Escribí las cantidades y confirmá cuando esté listo."}
        </p>
        <div>
          <button
            className="admin-button admin-button-outline"
            onClick={() => setDraft({})}
            disabled={!changes.length}
          >
            Limpiar
          </button>
          <button
            className="admin-button admin-button-primary"
            onClick={confirm}
            disabled={!changes.length}
          >
            <Check size={17} /> Registrar movimiento
          </button>
        </div>
      </div>
    </section>
  );
}
/** Historial completo: de dónde salió y a dónde fue cada unidad. */
function MovementsView({ movements }: { movements: Movement[] }) {
  const [reasonFilter, setReasonFilter] = useState<MovementReason | "Todos">(
    "Todos",
  );
  const visible = movements.filter(
    (m) => reasonFilter === "Todos" || m.reason === reasonFilter,
  );
  return (
    <section className="admin-card">
      <div className="admin-inventory-heading">
        <div>
          <h2>
            Historial <span>{movements.length}</span>
          </h2>
          <p>
            Las ventas se asientan solas; los ingresos y ajustes, cuando los
            cargás.
          </p>
        </div>
      </div>
      <div className="admin-filters">
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por motivo"
            value={reasonFilter}
            onChange={(e) =>
              setReasonFilter(e.target.value as MovementReason | "Todos")
            }
          >
            <option value="Todos">Todos los motivos</option>
            {["Venta", ...addReasons, ...removeReasons].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <Empty
          icon={<History size={26} />}
          title="Todavía no hay movimientos"
          text="Registrá un ingreso o hacé una venta de prueba y van a aparecer acá."
        />
      ) : (
        <div
          className="admin-table-wrap"
          role="region"
          aria-label="Movimientos de stock"
          tabIndex={0}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>PRODUCTO</th>
                <th>TALLE</th>
                <th>MOTIVO</th>
                <th>CANTIDAD</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 200).map((m) => (
                <tr key={m.id}>
                  <td>{dateLabel(m.date)}</td>
                  <td>
                    <b>{m.productName}</b>
                    {m.orderId && (
                      <span className="admin-movement-order">{m.orderId}</span>
                    )}
                  </td>
                  <td>{m.size}</td>
                  <td>{m.reason}</td>
                  <td
                    className={`admin-movement-delta ${m.delta > 0 ? "is-in" : "is-out"}`}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Metric({
  icon,
  label,
  value,
  foot,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  foot: string;
}) {
  return (
    <div className="admin-metric">
      <div>
        <span>{label}</span>
        <span className="admin-metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}
function StatusBadge({ status }: { status: Order["status"] }) {
  return (
    <span
      className={`admin-status-badge ${status === "Completado" ? "is-completed" : status === "Pendiente" ? "is-pending" : ""}`}
    >
      <span />
      {status}
    </span>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/**
 * Cambiar la contraseña del panel. Queda guardada en este navegador y pisa a
 * la que viene en el sitio. Se guarda el hash, nunca la contraseña.
 */
function PasswordDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const propia = passwordCambiada();
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (nueva.length < 8) {
      setError("La contraseña nueva tiene que tener 8 caracteres o más.");
      return;
    }
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!(await checkAdminPassword(actual))) {
        setError("La contraseña actual no es esa.");
        setBusy(false);
        return;
      }
      await setAdminPassword(nueva);
      notify("Contraseña cambiada en este navegador");
      onClose();
    } catch {
      setError("No se pudo cambiar la contraseña en este navegador.");
      setBusy(false);
    }
  }
  function volverAFabrica() {
    resetAdminPassword();
    notify("Volviste a la contraseña de fábrica");
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="admin-dialog admin-dialog-narrow"
      aria-labelledby="admin-password-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="admin-product-form" onSubmit={submit}>
        <div className="admin-dialog-heading">
          <div>
            <span className="admin-eyebrow">ACCESO AL PANEL</span>
            <h2 id="admin-password-title">Cambiar la contraseña</h2>
            <p>
              Vale en este navegador. En otra computadora o celular sigue la
              de siempre, y borrar los datos del sitio la devuelve a esa.
            </p>
          </div>
          <button
            type="button"
            className="admin-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="admin-dialog-body">
          <label className="admin-field admin-field-full">
            Contraseña actual
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
          <label className="admin-field admin-field-full">
            Contraseña nueva
            <input
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <small>
              Ocho caracteres o más. Cuanto más larga, mejor: es lo único que
              tapa el panel.
            </small>
          </label>
          <label className="admin-field admin-field-full">
            Repetila
            <input
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </label>
          {error && (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          )}
          {propia && (
            <button
              type="button"
              className="admin-text-button"
              onClick={volverAFabrica}
            >
              Volver a la contraseña de fábrica
            </button>
          )}
        </div>
        <div className="admin-dialog-footer">
          <button
            type="button"
            className="admin-button admin-button-outline"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={busy}
          >
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
const imagePattern =
  /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,|\/)/i;
/** Lado máximo al que se achican las fotos subidas, en píxeles. */
function ProductEditor({
  product,
  onSave,
  onDelete,
  onClose,
  notify,
}: {
  product?: Product;
  onSave: (product: Product) => void;
  /** Dar de baja el producto del todo. Sólo existe al editar uno que ya está. */
  onDelete?: (product: Product) => void;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Product>(
    product
      ? structuredClone(product)
      : {
          id: `local-${crypto.randomUUID()}`,
          name: "",
          category: "Hombre",
          type: "Remeras",
          price: 0,
          image: "",
          color: "",
          colorHex: "#132457",
          sizes: ["S", "M", "L", "XL"],
          stock: {},
          isNew: true,
          active: true,
          description: "",
        },
  );
  const [sizeText, setSizeText] = useState(draft.sizes.join(", "));
  const [gallery, setGallery] = useState<string[]>(draft.images || []);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [error, setError] = useState("");
  const sizes = [
    ...new Set(
      sizeText
        .split(",")
        .map((size) => size.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }
  /**
   * Deja la foto lista para guardar. La achica antes: una foto de celular
   * pesa varios MB y acá todo se guarda en el navegador, que da poco lugar.
   * Si el navegador no sabe achicar, se guarda tal cual y manda el límite.
   */
  async function uploadImage(file?: File) {
    if (!file) return;
    try {
      set("image", await prepareImage(file));
      setError("");
      notify("Imagen lista para guardar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer la imagen.");
    }
  }
  /** Varias fotos de una, para mostrar la prenda desde distintos ángulos. */
  async function uploadGallery(files?: FileList | null) {
    if (!files?.length) return;
    const listos: string[] = [];
    for (const file of Array.from(files)) {
      try {
        listos.push(await prepareImage(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos leer la imagen.");
      }
    }
    if (!listos.length) return;
    setGallery((prev) => [...prev, ...listos]);
    setError("");
    notify(
      listos.length === 1 ? "Foto agregada" : `${listos.length} fotos agregadas`,
    );
  }
  function addGalleryUrl() {
    const url = galleryUrl.trim();
    if (!url) return;
    if (!imagePattern.test(url)) {
      setError("El enlace tiene que empezar con https://");
      return;
    }
    setGallery((prev) => [...prev, url]);
    setGalleryUrl("");
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.color.trim() || !draft.type.trim()) {
      setError("Completá el nombre, tipo de prenda y color.");
      return;
    }
    // El precio se guarda en pesos enteros: con centavos o con basura no se
    // adivina, se avisa.
    const precio = leerPrecio(draft.price);
    if (!precio.ok) {
      setError(precio.error);
      return;
    }
    // El precio anterior es el que se muestra tachado: si no es mayor que el
    // actual, la tienda mostraría un "descuento" que sube el precio.
    if (draft.oldPrice !== undefined) {
      const anterior = leerPrecio(draft.oldPrice);
      if (!anterior.ok) {
        setError(`Precio anterior: ${anterior.error}`);
        return;
      }
      if (anterior.value <= precio.value) {
        setError(
          "El precio anterior tiene que ser mayor al actual: es el que se muestra tachado. Si no hay descuento, dejalo vacío.",
        );
        return;
      }
    }
    // Un cambio enorme casi siempre es un cero de más o de menos.
    const aviso = product ? avisoDeCambio(product.price, precio.value) : null;
    if (aviso && !confirm(aviso)) return;
    if (!sizes.length) {
      setError("Agregá al menos un talle; podés usar ÚNICO.");
      return;
    }
    if (
      !draft.image.trim() ||
      !imagePattern.test(draft.image)
    ) {
      setError("Agregá una imagen o una URL válida que comience con https://.");
      return;
    }
    if (gallery.some((url) => !imagePattern.test(url))) {
      setError(
        "Revisá las fotos extra: cada línea tiene que ser una URL que empiece con https://",
      );
      return;
    }
    const stock = Object.fromEntries(
      sizes.map((s) => [s, Math.max(0, Math.floor(draft.stock[s] || 0))]),
    ) as Product["stock"];
    onSave({
      ...draft,
      name: draft.name.trim(),
      type: draft.type.trim(),
      color: draft.color.trim(),
      image: draft.image.trim(),
      sizes,
      stock,
      images: gallery.length ? gallery : undefined,
    });
  }
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="admin-product-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="admin-product-form" onSubmit={submit}>
        <div className="admin-dialog-heading">
          <div>
            <span className="admin-eyebrow">CATÁLOGO DE PRODUCTOS</span>
            <h2 id="admin-product-title">
              {product ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p>Un catálogo compartido. Stock por talle.</p>
          </div>
          <button
            type="button"
            className="admin-close"
            aria-label="Cerrar editor"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="admin-dialog-body">
          <div className="admin-form-grid">
            <label className="admin-field admin-field-full">
              Nombre del producto
              <input
                autoFocus
                required
                maxLength={90}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ej. Remera Classic Logo"
              />
            </label>
            <label className="admin-field">
              Marca
              <input value={draft.brand || ""} onChange={(e) => set("brand", e.target.value)} placeholder="Ej. Mistral" />
            </label>
            <label className="admin-field">
              Categoría
              <select
                value={draft.category}
                onChange={(e) => set("category", e.target.value as Category)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              Tipo de producto
              <input
                required
                value={draft.type}
                onChange={(e) => set("type", e.target.value)}
                placeholder="Remeras, buzos, camperas…"
              />
            </label>
            <label className="admin-field">
              Precio (ARS)
              <input
                type="number"
                min="1"
                step="1"
                required
                value={draft.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="45000"
              />
            </label>
            <label className="admin-field">
              Precio anterior (opcional)
              <input
                type="number"
                min="1"
                step="1"
                value={draft.oldPrice || ""}
                onChange={(e) =>
                  set(
                    "oldPrice",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="Precio sin descuento"
              />
            </label>
            <label className="admin-field">
              Nombre del color
              <input
                required
                value={draft.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="Ej. Verde bosque"
              />
            </label>
            <label className="admin-field">
              Muestra de color
              <div className="admin-color-input">
                <input
                  type="color"
                  aria-label="Elegir color"
                  value={draft.colorHex}
                  onChange={(e) => set("colorHex", e.target.value)}
                />
                <span>{draft.colorHex.toUpperCase()}</span>
              </div>
            </label>
            <label className="admin-field admin-field-full">
              Descripción
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Materiales, calce y detalles de la prenda."
              />
            </label>
          </div>
          <div className="admin-form-section">
            <h3>Imagen del producto</h3>
            <div className="admin-image-upload">
              {draft.image ? (
                <img
                  src={draft.image}
                  alt="Vista previa del producto"
                  onError={(e) => {
                    e.currentTarget.style.opacity = ".25";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                />
              ) : (
                <span className="admin-image-placeholder">
                  <ImagePlus size={28} />
                </span>
              )}
              <div>
                <button
                  className="admin-button admin-button-outline"
                  type="button"
                  onClick={() => imageInput.current?.click()}
                >
                  <ImagePlus size={16} /> Subir imagen
                </button>
                <p>JPG, PNG o WebP. Hasta 1 MB.</p>
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="admin-sr-only"
                  aria-label="Subir imagen del producto"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                />
              </div>
            </div>
            <label className="admin-field">
              O pegá el enlace de una imagen
              <input
                value={draft.image.startsWith("data:") ? "" : draft.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder={
                  draft.image.startsWith("data:")
                    ? "Imagen subida. Pegá una URL para reemplazarla."
                    : "https://ejemplo.com/producto.jpg"
                }
              />
            </label>
            <div className="admin-field admin-gallery">
              <span className="admin-gallery-label">
                Más fotos de la prenda
              </span>
              {gallery.length > 0 && (
                <ul className="admin-gallery-list">
                  {gallery.map((src, i) => (
                    <li key={`${src.slice(0, 40)}-${i}`}>
                      <img src={src} alt={`Foto ${i + 2} de la prenda`} />
                      <button
                        type="button"
                        aria-label={`Quitar la foto ${i + 2}`}
                        onClick={() =>
                          setGallery((prev) =>
                            prev.filter((_, pos) => pos !== i),
                          )
                        }
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="admin-button admin-button-outline"
                type="button"
                onClick={() => galleryInput.current?.click()}
              >
                <ImagePlus size={16} /> Subir fotos
              </button>
              <input
                ref={galleryInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="admin-sr-only"
                aria-label="Subir más fotos de la prenda"
                onChange={(e) => {
                  uploadGallery(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="admin-gallery-url">
                <input
                  value={galleryUrl}
                  onChange={(e) => setGalleryUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryUrl();
                    }
                  }}
                  placeholder="O pegá el enlace de otra foto"
                  aria-label="Enlace de otra foto"
                />
                <button
                  className="admin-button admin-button-outline"
                  type="button"
                  onClick={addGalleryUrl}
                >
                  Agregar
                </button>
              </div>
            </div>
            <p>
              La primera foto es la principal. Las de acá se muestran como
              miniaturas en la ficha, para ver la prenda de adelante, de atrás
              y de cerca. Se achican solas al subirlas.
            </p>
          </div>
          <div className="admin-form-section">
            <h3>Talles y stock</h3>
            <p>
              La tienda usa estas cantidades para mostrar la disponibilidad.
            </p>
            <label className="admin-field">
              Talles disponibles{" "}
              <input
                value={sizeText}
                onChange={(e) => setSizeText(e.target.value)}
                placeholder="S, M, L, XL"
              />
              <small>Separalos con comas. Para accesorios, usá ÚNICO.</small>
            </label>
            {sizes.length > 0 && (
              <div className="admin-size-table-wrap">
                <table className="admin-size-table">
                  <thead>
                    <tr>
                      <th>TALLE</th>
                      <th>UNIDADES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size) => (
                      <tr key={size}>
                        <th scope="row">{size}</th>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="99999"
                            step="1"
                            aria-label={`Stock talle ${size}`}
                            value={draft.stock[size] ?? 0}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                stock: {
                                  ...prev.stock,
                                  [size]: Number(e.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="admin-form-switches">
            <label>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              <span>
                <strong>Publicar en la tienda</strong>
                <small>El producto estará visible para los clientes.</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.isNew}
                onChange={(e) => set("isNew", e.target.checked)}
              />
              <span>
                <strong>Marcar como novedad</strong>
                <small>Mostrar la etiqueta «Nuevo» en el catálogo.</small>
              </span>
            </label>
          </div>
          {error && (
            <p className="admin-form-error" role="alert">
              <TriangleAlert size={16} />
              {error}
            </p>
          )}
        </div>
        <div className="admin-dialog-footer">
          {product && onDelete && (
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={() => onDelete(product)}
            >
              Dar de baja
            </button>
          )}
          <button
            type="button"
            className="admin-button admin-button-outline"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="admin-button admin-button-primary">
            <Check size={17} />
            {product ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
