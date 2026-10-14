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
  ImagePlus,
  LayoutDashboard,
  MapPin,
  Package,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { useStore } from "./Store";
import type { Branch, Category, Order, Product } from "./types";
import "./admin.css";

type Tab = "overview" | "inventory" | "orders";
const branches: Branch[] = ["La Plata", "Ensenada"];
const categories: Category[] = ["Hombre", "Mujer", "Accesorios"];
const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
const units = (product: Product, branch?: Branch) =>
  (branch ? [branch] : branches).reduce(
    (total, b) =>
      total +
      Object.values(product.stock[b] || {}).reduce(
        (sum, value) => sum + value,
        0,
      ),
    0,
  );
const orderStatuses: Order["status"][] = [
  "Pendiente",
  "Preparando",
  "Listo para retirar",
  "Completado",
];
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

export default function Admin({ onExit }: { onExit: () => void }) {
  const { products, setProducts, orders, setOrders, notify } = useStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<Branch | "Todas">("Todas");
  const [categoryFilter, setCategoryFilter] = useState<Category | "Todas">(
    "Todas",
  );
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [orderFilter, setOrderFilter] = useState("Todos");
  const [orderSearch, setOrderSearch] = useState("");
  const formTrigger = useRef<HTMLElement | null>(null);
  const activeProducts = products.filter((p) => p.active);
  const inventoryUnits = products.reduce((sum, p) => sum + units(p), 0);
  const lowStock = products.filter((p) => p.active && units(p) <= 5);
  const pendingOrders = orders.filter((o) => o.status !== "Completado");
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.type} ${p.color}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (categoryFilter === "Todas" || p.category === categoryFilter) &&
          (!lowOnly ||
            units(p, branchFilter === "Todas" ? undefined : branchFilter) <= 5),
      ),
    [products, search, categoryFilter, lowOnly, branchFilter],
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
    formTrigger.current = document.activeElement as HTMLElement;
    setEditing(product);
  }
  function closeEditor() {
    setEditing(null);
    requestAnimationFrame(() => formTrigger.current?.focus());
  }
  function saveProduct(product: Product) {
    const exists = products.some((p) => p.id === product.id);
    setProducts(
      exists
        ? products.map((p) => (p.id === product.id ? product : p))
        : [...products, product],
    );
    notify(
      exists
        ? "Producto actualizado en la tienda"
        : "Producto agregado a la tienda",
    );
    closeEditor();
  }
  function setOrderStatus(id: string, status: Order["status"]) {
    setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    notify("Estado del pedido actualizado");
  }
  function exportStock() {
    const rows = [
      [
        "Producto",
        "Categoría",
        "Color",
        "Sucursal",
        "Talle",
        "Stock",
        "Precio ARS",
        "Visible",
      ],
    ];
    filtered.forEach((p) =>
      (branchFilter === "Todas" ? branches : [branchFilter]).forEach((b) =>
        p.sizes.forEach((s) =>
          rows.push([
            p.name,
            p.category,
            p.color,
            b,
            s,
            String(p.stock[b]?.[s] || 0),
            String(p.price),
            p.active ? "Sí" : "No",
          ]),
        ),
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
    anchor.download = "mistral-inventario.csv";
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
          aria-label="Volver a Mistral tienda"
        >
          mistral<span>GESTIÓN DE TIENDA</span>
        </button>
        <div className="admin-location">
          <span className="admin-location-icon">
            <Store size={19} />
          </span>
          <div>
            <strong>Mistral local</strong>
            <small>La Plata & Ensenada</small>
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
            <span>Resumen</span>
          </button>
          <button
            className={tab === "inventory" ? "is-active" : ""}
            onClick={() => setTab("inventory")}
          >
            <Boxes size={19} />
            <span>Productos y stock</span>
          </button>
          <button
            className={tab === "orders" ? "is-active" : ""}
            onClick={() => setTab("orders")}
          >
            <ShoppingBag size={19} />
            <span>Pedidos</span>
            {pendingOrders.length > 0 && <b>{pendingOrders.length}</b>}
          </button>
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-demo-note">
            <CircleHelp size={19} />
            <strong>Un vistazo a tu próxima tienda</strong>
            <p>Explorá la gestión de productos, stock y pedidos.</p>
            <span>PROTOTIPO INTERACTIVO</span>
          </div>
          <button className="admin-back-store" onClick={onExit}>
            <ArrowLeft size={17} /> Volver a la tienda
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="admin-mobile-brand">mistral</span>
            <span className="admin-breadcrumb">
              Administración <span>/</span>{" "}
              {tab === "overview"
                ? "Resumen"
                : tab === "inventory"
                  ? "Productos y stock"
                  : "Pedidos"}
            </span>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-demo-badge">
              <span /> Modo demo
            </span>
            <button className="admin-store-link" onClick={onExit}>
              Ver tienda <ArrowUpRight size={15} />
            </button>
            <span className="admin-avatar" aria-label="Administración Mistral">
              M
            </span>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-local-banner">
            <CircleHelp size={16} />
            <p>
              Demostración sin autenticación. Los cambios se guardan solo en
              este navegador; no se procesan compras reales.
            </p>
          </div>
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">LA PLATA & ENSENADA</span>
              <h1>
                {tab === "overview"
                  ? "Tu negocio, en un solo lugar."
                  : tab === "inventory"
                    ? "Productos y stock"
                    : "Pedidos"}
              </h1>
              <p>
                {tab === "overview"
                  ? "Una mirada rápida a lo que pasa en tus sucursales."
                  : tab === "inventory"
                    ? "Administrá el catálogo y las unidades disponibles en cada sucursal."
                    : "Seguí cada compra y organizá la preparación de tus pedidos."}
              </p>
            </div>
            {tab !== "orders" && (
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
                  foot="Entre las dos sucursales"
                />
                <Metric
                  icon={<ShoppingBag size={20} />}
                  label="Pedidos activos"
                  value={String(pendingOrders.length)}
                  foot="Pedidos de demostración"
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
                              {order.branch}
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
                      <h2>Stock por sucursal</h2>
                      <p>Disponibilidad actual del inventario.</p>
                    </div>
                    <MapPin size={20} />
                  </div>
                  <div className="admin-branch-cards">
                    {branches.map((branch, i) => {
                      const count = products.reduce(
                        (sum, p) => sum + units(p, branch),
                        0,
                      );
                      return (
                        <div key={branch} className="admin-branch-stock">
                          <div>
                            <span
                              className={`admin-branch-symbol admin-branch-symbol-${i}`}
                            >
                              <Store size={20} />
                            </span>
                            <span>
                              <strong>{branch}</strong>
                              <small>Sucursal Mistral</small>
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
                          ? `${lowStock.length} productos con 5 unidades o menos entre ambas sucursales.`
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
                    Tu catálogo <span>{products.length}</span>
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
                  <MapPin size={16} />
                  <select
                    aria-label="Filtrar por sucursal"
                    value={branchFilter}
                    onChange={(e) =>
                      setBranchFilter(e.target.value as Branch | "Todas")
                    }
                  >
                    <option value="Todas">Todas las sucursales</option>
                    {branches.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
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
                      {(branchFilter === "Todas"
                        ? branches
                        : [branchFilter]
                      ).map((b) => (
                        <th key={b}>{b.toUpperCase()}</th>
                      ))}
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
                        {(branchFilter === "Todas"
                          ? branches
                          : [branchFilter]
                        ).map((b) => (
                          <td key={b}>
                            <span
                              className={`admin-stock-pill ${units(p, b) === 0 ? "admin-stock-empty" : units(p, b) <= 5 ? "admin-stock-low" : ""}`}
                            >
                              <span /> {units(p, b)} unidades
                            </span>
                          </td>
                        ))}
                        <td>
                          <button
                            className={`admin-publish-status ${p.active ? "is-published" : ""}`}
                            onClick={() => {
                              setProducts(
                                products.map((product) =>
                                  product.id === p.id
                                    ? { ...product, active: !product.active }
                                    : product,
                                ),
                              );
                              notify(
                                p.active
                                  ? "Producto ocultado de la tienda"
                                  : "Producto publicado",
                              );
                            }}
                            title={
                              p.active
                                ? "Ocultar de la tienda"
                                : "Publicar en la tienda"
                            }
                            aria-label={`${p.active ? "Ocultar" : "Publicar"} ${p.name}`}
                          >
                            <span />
                            {p.active ? "Publicado" : "Oculto"}
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
                        setBranchFilter("Todas");
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
                  {filtered.length} de {products.length} productos
                </span>
                <span>
                  <span className="admin-stock-key" /> Stock bajo: hasta 5
                  unidades
                </span>
              </div>
            </section>
          )}

          {tab === "orders" && (
            <section className="admin-card admin-inventory-card">
              <div className="admin-inventory-heading">
                <div>
                  <h2>
                    Pedidos de la tienda <span>{orders.length}</span>
                  </h2>
                  <p>Compras simuladas, guardadas en este navegador.</p>
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
                        <th>ESTADO</th>
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
                                  ? "Retiro en sucursal"
                                  : "Envío a domicilio"}
                              </strong>
                              <span>{o.branch}</span>
                            </div>
                          </td>
                          <td className="admin-price-cell">{money(o.total)}</td>
                          <td>
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
              mistral <span>·</span> La Plata & Ensenada
            </span>
            <span>Panel de administración · Prototipo</span>
          </footer>
        </main>
      </div>
      {editing !== null && (
        <ProductEditor
          product={editing === "new" ? undefined : editing}
          onSave={saveProduct}
          onClose={closeEditor}
          notify={notify}
        />
      )}
    </div>
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

const imagePattern =
  /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,|\/)/i;
function ProductEditor({
  product,
  onSave,
  onClose,
  notify,
}: {
  product?: Product;
  onSave: (product: Product) => void;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
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
          colorHex: "#173c35",
          sizes: ["S", "M", "L", "XL"],
          stock: { "La Plata": {}, Ensenada: {} },
          isNew: true,
          active: true,
          description: "",
        },
  );
  const [sizeText, setSizeText] = useState(draft.sizes.join(", "));
  const [galleryText, setGalleryText] = useState(
    (draft.images || []).join("\n"),
  );
  const [error, setError] = useState("");
  const gallery = galleryText
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
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
  async function uploadImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Elegí una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("La imagen debe pesar hasta 1 MB para guardarse en esta demo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set("image", String(reader.result));
      setError("");
      notify("Imagen lista para guardar");
    };
    reader.onerror = () =>
      setError("No pudimos leer la imagen. Probá con otro archivo.");
    reader.readAsDataURL(file);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.color.trim() || !draft.type.trim()) {
      setError("Completá el nombre, tipo de prenda y color.");
      return;
    }
    if (!Number.isFinite(draft.price) || draft.price <= 0) {
      setError("Ingresá un precio mayor a cero.");
      return;
    }
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
      branches.map((b) => [
        b,
        Object.fromEntries(
          sizes.map((s) => [
            s,
            Math.max(0, Math.floor(draft.stock[b][s] || 0)),
          ]),
        ),
      ]),
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
            <p>Un catálogo compartido. Stock por sucursal.</p>
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
            <label className="admin-field">
              Más fotos de la prenda (una URL por línea)
              <textarea
                rows={3}
                value={galleryText}
                onChange={(e) => setGalleryText(e.target.value)}
                placeholder={"https://ejemplo.com/espalda.jpg\nhttps://ejemplo.com/detalle.jpg"}
              />
            </label>
            <p>
              La primera foto es la principal. Las de acá se muestran como
              miniaturas en la ficha del producto.
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
                      {branches.map((b) => (
                        <th key={b}>{b}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size) => (
                      <tr key={size}>
                        <th scope="row">{size}</th>
                        {branches.map((b) => (
                          <td key={b}>
                            <input
                              type="number"
                              min="0"
                              max="99999"
                              step="1"
                              aria-label={`Stock talle ${size} en ${b}`}
                              value={draft.stock[b][size] ?? 0}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  stock: {
                                    ...prev.stock,
                                    [b]: {
                                      ...prev.stock[b],
                                      [size]: Number(e.target.value),
                                    },
                                  },
                                }))
                              }
                            />
                          </td>
                        ))}
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
