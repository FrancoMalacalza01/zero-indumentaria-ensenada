import { useState } from "react";
import { History, SlidersHorizontal } from "lucide-react";
import type { Movement, MovementReason } from "./types";
import { addReasons, removeReasons, dateLabel, Empty } from "./adminComunes";

/** Historial completo: de dónde salió y a dónde fue cada unidad. */
export function MovementsView({ movements }: { movements: Movement[] }) {
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
