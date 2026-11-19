import { useState } from "react";
import { Check, ClipboardList, Minus, Package, Plus, Search } from "lucide-react";
import type { MovementReason, Product, StockChange } from "./types";
import { addReasons, removeReasons, units, Empty } from "./adminComunes";

/** Carga de stock pensada para el mostrador: buscás la prenda,
 *  escribís cuánto entró o salió y confirmás todo junto. */
export function StockLoader({
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
