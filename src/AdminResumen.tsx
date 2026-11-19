import type { Movement, Order, Product } from "./types";
import type { Tab } from "./adminComunes";
import { ArrowRight, Boxes, ClipboardList, History, MapPin, Package, ShoppingBag, Store, TrendingUp, TriangleAlert } from "lucide-react";
import { importeDeVentas } from "./pedidosActivos.mjs";
import { money, units, Metric, StatusBadge, Empty, categories } from "./adminComunes";

/**
 * La pestaña "Resumen" del panel: las métricas, los últimos pedidos, el stock por categoría y las alertas
 * de stock bajo. Es sólo la vista: el estado y las acciones siguen en `Admin`.
 */
export function AdminResumen({
  products,
  orders,
  movements,
  activeProducts,
  inventoryUnits,
  lowStock,
  pendingOrders,
  recentOrders,
  conectado,
  openEditor,
  setLowOnly,
  setTab,
  onExit,
}: {
  products: Product[];
  orders: Order[];
  movements: Movement[];
  activeProducts: Product[];
  inventoryUnits: number;
  lowStock: Product[];
  pendingOrders: Order[];
  recentOrders: Order[];
  conectado: boolean;
  openEditor: (product: Product | "new") => void;
  setLowOnly: (valor: boolean) => void;
  setTab: (tab: Tab) => void;
  onExit: () => void;
}) {
  return (
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
            foot={conectado ? "Pendientes, en preparación o para retirar" : "Pedidos de demostración"}
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
            foot={conectado ? "Sin contar cancelados ni devueltos" : "Importe total de pedidos demo"}
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
  );
}
