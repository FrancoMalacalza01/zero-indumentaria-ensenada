import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Boxes, ChevronDown, CircleHelp, ClipboardList, CloudUpload, History, KeyRound, LayoutDashboard, LogOut, MapPin, Package, PackagePlus, Plus, Search, Receipt, Settings, ShoppingBag, SlidersHorizontal, Store, Tag, TrendingUp, TriangleAlert, Undo2 } from "lucide-react";
import { useStore } from "./Store";
import type { Category, MovementReason, Order, Product, StockChange } from "./types";
import { paymentLabel } from "./payment";
import { adminLocked } from "./adminAccess";
import { useServerPanel } from "./useServerPanel";
import AdminConfig from "./AdminConfig";
import AdminReturns from "./AdminReturns";
import AdminReports from "./AdminReports";
import AdminPrecios from "./AdminPrecios";
import catalogoImportado from "./men-catalog.json";
import { prepararFichaImportada } from "./importarCatalogo.mjs";
import { AdminHabilitar } from "./AdminHabilitar";
import { importeDeVentas, pedidosActivos } from "./pedidosActivos.mjs";
import { guardarSettings } from "./settings";
import type { Session } from "./auth";
import { categories, money, units, dateLabel, orderStatuses, pagoEtiquetas, Metric, StatusBadge, Empty } from "./adminComunes";
import { SaleRegister } from "./AdminVentaDelDia";
import { StockLoader } from "./AdminCargarStock";
import { MovementsView } from "./AdminMovimientos";
import { PasswordDialog } from "./AdminClave";
import { ProductEditor } from "./AdminProductEditor";
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
  const pendingOrders = pedidosActivos(orders);
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
  async function cancelar(order: Order) {
    const unidades = order.items.reduce((s, i) => s + i.quantity, 0);
    // Un pedido pagado por Payway se cancela DEVOLVIENDO la plata: cancelar sólo el pedido
    // dejaría el stock repuesto y el pago de la tarjeta en pie.
    const pagoPayway =
      panel.conectado && order.paymentStatus === "aprobado" && /^payway:\d+$/.test(order.pagoRef || "");
    if (
      !confirm(
        pagoPayway
          ? `¿Cancelar el pedido ${order.id}?\n\nEstá pagado con tarjeta por Payway: primero se anula el pago (la plata vuelve a la tarjeta del cliente) y después vuelven ${unidades} ${unidades === 1 ? "unidad" : "unidades"} al stock. Esto no se puede deshacer.`
          : `¿Cancelar el pedido ${order.id}?\n\nVuelven ${unidades} ${unidades === 1 ? "unidad" : "unidades"} al stock. Esto no se puede deshacer.`,
      )
    )
      return;
    if (pagoPayway) {
      const r = await panel.anularPagoPayway(order.id);
      if (r.estado === "rechazado") {
        // Payway dijo que no (por ejemplo, el lote ya se cerró): el dueño decide si cancela
        // igual y devuelve la plata a mano desde el backoffice de Payway.
        if (
          !confirm(
            `${r.mensaje}\n\n¿Cancelás el pedido igual y devolvés la plata a mano desde el backoffice de Payway?`,
          )
        )
          return;
      } else if (r.estado !== "anulado") {
        // Incierto o error: no se cancela nada hasta saber qué pasó con la plata.
        alert(`${r.mensaje}\n\nEl pedido NO se canceló.`);
        return;
      }
    }
    if (panel.conectado) {
      panel.cancelar(order.id);
      // En pantalla se adelanta; la recarga que viene después confirma.
      setOrders(
        orders.map((o) =>
          o.id === order.id
            ? { ...o, status: "Cancelado", paymentStatus: pagoPayway ? "devuelto" : "rechazado" }
            : o,
        ),
      );
      notify(
        pagoPayway
          ? "Pago anulado en Payway, pedido cancelado y stock devuelto"
          : "Pedido cancelado y stock devuelto",
      );
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
                  foot={panel.conectado ? "Pendientes, en preparación o para retirar" : "Pedidos de demostración"}
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
                  value={money(importeDeVentas(orders))}
                  foot={panel.conectado ? "Sin contar cancelados ni devueltos" : "Importe total de pedidos demo"}
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
            <>
            <AdminHabilitar products={products} ajustes={menOverrides} panel={panel} notify={notify} />
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
                <table className="admin-table admin-inventario">
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
            </>
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
