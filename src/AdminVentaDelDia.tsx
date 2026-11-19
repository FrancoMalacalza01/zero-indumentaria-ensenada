import { useState } from "react";
import { Minus, Package, Plus, Search } from "lucide-react";
import type { Product, StockChange } from "./types";
import { Empty } from "./adminComunes";

/**
 * Venta de mostrador. Tocás el talle y se suma al ticket; al confirmar, baja
 * del stock y queda asentado como Venta, con un número que agrupa todo lo que
 * se llevó la misma persona. No se toca plata: esto es para saber qué queda.
 */
export function SaleRegister({
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
