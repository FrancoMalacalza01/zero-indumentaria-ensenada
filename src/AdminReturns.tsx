import { useMemo, useState } from "react";
import { PackageOpen, RotateCcw, Search, Undo2 } from "lucide-react";
import type { Order, StockChange } from "./types";
import { money } from "./Store";

/**
 * Registrar una devolución.
 *
 * Lo importante es qué pasa con el stock, que es de lo que sirve este
 * módulo: una prenda que vuelve en buen estado <b>vuelve a la venta</b>, y
 * una que vuelve fallada <b>no</b>. Las dos se anotan, porque el historial
 * tiene que poder explicar la diferencia entre lo que hay en el perchero y
 * lo que figura en el sistema.
 *
 * Una prenda fallada deja dos movimientos: entra como "Devolución" y sale
 * como "Rotura". El stock no se mueve en limpio y el historial cuenta las
 * dos cosas que pasaron de verdad, en vez de una sola a medias.
 */
export default function AdminReturns({
  orders,
  onReturn,
  onOrderStatus,
}: {
  orders: Order[];
  /** Aplica los cambios de stock y los publica. */
  onReturn: (changes: StockChange[], orderId: string, resumen: string) => void;
  onOrderStatus: (id: string, status: Order["status"]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  // Por renglón del pedido: cuántas vuelven y si vuelven a la venta.
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [falladas, setFalladas] = useState<Record<string, boolean>>({});

  const candidatos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return orders
      .filter((o) => o.status !== "Devuelto")
      .filter(
        (o) =>
          !texto ||
          `${o.id} ${o.customer}`.toLowerCase().includes(texto),
      )
      .slice(0, 12);
  }, [orders, busqueda]);

  const pedido = orders.find((o) => o.id === abierto) || null;

  function limpiar() {
    setAbierto(null);
    setCantidades({});
    setFalladas({});
  }

  function clave(o: Order, i: number) {
    return `${o.id}|${i}`;
  }

  function registrar() {
    if (!pedido) return;
    const changes: StockChange[] = [];
    let unidades = 0;
    let rotas = 0;
    pedido.items.forEach((item, i) => {
      const cuantas = cantidades[clave(pedido, i)] || 0;
      if (cuantas <= 0) return;
      unidades += cuantas;
      // Primero vuelve, siempre: eso es lo que pasó.
      changes.push({
        productId: item.productId,
        size: item.size,
        delta: cuantas,
        reason: "Devolución",
        orderId: pedido.id,
      });
      if (falladas[clave(pedido, i)]) {
        rotas += cuantas;
        // Y si no se puede vender, sale de nuevo. Dos renglones en el
        // historial, uno por cada cosa que pasó.
        changes.push({
          productId: item.productId,
          size: item.size,
          delta: -cuantas,
          reason: "Rotura",
          orderId: pedido.id,
        });
      }
    });
    if (!changes.length) return;
    const vuelven = unidades - rotas;
    const resumen =
      rotas === 0
        ? `Devolución registrada: ${unidades} ${unidades === 1 ? "unidad vuelve" : "unidades vuelven"} a la venta`
        : vuelven === 0
          ? `Devolución registrada: ${unidades} sin volver a la venta`
          : `Devolución registrada: ${vuelven} a la venta, ${rotas} fuera`;
    onReturn(changes, pedido.id, resumen);
    // Si volvió todo el pedido, queda marcado como devuelto.
    const totalPedido = pedido.items.reduce((s, i) => s + i.quantity, 0);
    if (unidades >= totalPedido) onOrderStatus(pedido.id, "Devuelto");
    limpiar();
  }

  const totalElegido = pedido
    ? pedido.items.reduce(
        (s, _item, i) => s + (cantidades[clave(pedido, i)] || 0),
        0,
      )
    : 0;

  return (
    <section className="admin-card admin-devoluciones">
      <div className="admin-inventory-heading">
        <div>
          <h2>Registrar una devolución</h2>
          <p>
            Buscá el pedido, marcá qué vuelve y el stock se acomoda solo. Lo
            que vuelve fallado no se suma a la venta.
          </p>
        </div>
      </div>

      {!pedido ? (
        <>
          <div className="admin-filters">
            <label className="admin-search">
              <Search size={18} />
              <input
                aria-label="Buscar pedido"
                placeholder="Número de pedido o nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          </div>
          {candidatos.length === 0 ? (
            <div className="admin-empty">
              <PackageOpen size={28} />
              <h3>No hay pedidos para devolver</h3>
              <p>
                Las devoluciones se registran sobre un pedido. Cuando entre el
                primero, va a aparecer acá.
              </p>
            </div>
          ) : (
            <ul className="admin-stock-list">
              {candidatos.map((o) => (
                <li key={o.id}>
                  <div className="admin-stock-product">
                    <div>
                      <b>
                        {o.id} · {o.customer || "Sin nombre"}
                      </b>
                      <span>
                        {o.items.reduce((s, i) => s + i.quantity, 0)} unidades ·{" "}
                        {money(o.total)} · {o.status}
                      </span>
                    </div>
                  </div>
                  <button
                    className="admin-edit-button"
                    onClick={() => setAbierto(o.id)}
                  >
                    Devolver <Undo2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="admin-devolucion-cabecera">
            <div>
              <b>
                {pedido.id} · {pedido.customer || "Sin nombre"}
              </b>
              <span>
                {money(pedido.total)}
                {pedido.envio ? ` (incluye ${money(pedido.envio)} de envío)` : ""}
              </span>
            </div>
            <button className="admin-text-button" onClick={limpiar}>
              Elegir otro pedido
            </button>
          </div>
          <ul className="admin-devolucion-lineas">
            {pedido.items.map((item, i) => {
              const k = clave(pedido, i);
              const cuantas = cantidades[k] || 0;
              return (
                <li key={k}>
                  <div>
                    <b>{item.name}</b>
                    <span>
                      Talle {item.size} · se llevó {item.quantity} ·{" "}
                      {money(item.price)}
                    </span>
                  </div>
                  <label className="admin-devolucion-cantidad">
                    Vuelven
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={cuantas}
                      onChange={(e) =>
                        setCantidades((c) => ({
                          ...c,
                          [k]: Math.min(
                            item.quantity,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="admin-devolucion-fallada">
                    <input
                      type="checkbox"
                      checked={Boolean(falladas[k])}
                      disabled={cuantas === 0}
                      onChange={(e) =>
                        setFalladas((f) => ({ ...f, [k]: e.target.checked }))
                      }
                    />
                    <span>No se puede volver a vender</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="admin-devolucion-pie">
            <span>
              {totalElegido === 0
                ? "Marcá cuántas unidades vuelven."
                : `${totalElegido} ${totalElegido === 1 ? "unidad" : "unidades"} a devolver.`}
            </span>
            <button
              className="admin-button admin-button-primary"
              disabled={totalElegido === 0}
              onClick={registrar}
            >
              <RotateCcw size={15} /> Registrar devolución
            </button>
          </div>
        </>
      )}
    </section>
  );
}
