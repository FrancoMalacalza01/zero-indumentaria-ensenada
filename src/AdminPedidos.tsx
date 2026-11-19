import { ArrowRight, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import type { Order } from "./types";
import { paymentLabel } from "./payment";
import { money, dateLabel, orderStatuses, pagoEtiquetas, Empty } from "./adminComunes";

/** La pestaña "Pedidos" del panel: la lista con búsqueda, filtro por estado, cambio de estado y cancelación. */
export function AdminPedidos({
  orders,
  visibleOrders,
  conectado,
  orderSearch,
  setOrderSearch,
  orderFilter,
  setOrderFilter,
  setOrderStatus,
  cancelar,
  onExit,
}: {
  orders: Order[];
  visibleOrders: Order[];
  conectado: boolean;
  orderSearch: string;
  setOrderSearch: (valor: string) => void;
  orderFilter: string;
  setOrderFilter: (valor: string) => void;
  setOrderStatus: (id: string, status: Order["status"]) => void;
  cancelar: (pedido: Order) => void;
  onExit: () => void;
}) {
  return (
      <section className="admin-card admin-inventory-card">
        <div className="admin-inventory-heading">
          <div>
            <h2>
              Pedidos de la tienda <span>{orders.length}</span>
            </h2>
            <p>
              {conectado
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
  );
}
