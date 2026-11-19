import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { money } from "./Store";
import { leerPrecio } from "./menOverrides.mjs";
import { Variacion } from "./preciosComunes";
import type { Mover, Articulo } from "./preciosComunes";

/** El precio mientras se escribe. Enter guarda y baja, Esc cancela. */
export function EditorPrecio({
  art,
  onGuardar,
  onCancelar,
}: {
  art: Articulo;
  /** Devuelve false si el cambio no se hizo (por ejemplo, si no se confirmó). */
  onGuardar: (valor: number, mover: Mover) => boolean;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(String(art.precio));
  const [error, setError] = useState("");
  // Una vez que se guardó o se canceló, el blur que viene después (porque la
  // fila se cierra) no tiene que volver a guardar.
  const terminado = useRef(false);
  const lectura = leerPrecio(texto);

  function guardar(mover: Mover) {
    if (terminado.current) return;
    const r = leerPrecio(texto);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    terminado.current = true;
    if (!onGuardar(r.value, mover)) terminado.current = false;
  }
  function cancelar() {
    if (terminado.current) return;
    terminado.current = true;
    onCancelar();
  }

  return (
    <div className="admin-precios-celda is-editando">
      <div className="admin-precios-edicion">
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`Precio de ${art.nombre}`}
          aria-invalid={Boolean(error)}
          value={texto}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setTexto(e.target.value);
            setError("");
          }}
          onBlur={() => {
            // Hacer clic afuera guarda lo escrito si es un precio válido y
            // distinto; si no, vuelve atrás sin ruido.
            if (terminado.current) return;
            if (lectura.ok && lectura.value !== art.precio) guardar(0);
            else cancelar();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar(e.shiftKey ? -1 : 1);
            } else if (e.key === "Tab") {
              e.preventDefault();
              guardar(e.shiftKey ? -1 : 1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              guardar(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              guardar(-1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelar();
            }
          }}
        />
        <button
          className="admin-precios-icono is-ok"
          // Sin esto, el clic le saca el foco al campo y el blur guarda antes.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => guardar(0)}
          aria-label="Guardar precio"
        >
          <Check size={15} />
        </button>
        <button
          className="admin-precios-icono"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelar}
          aria-label="Cancelar"
        >
          <X size={15} />
        </button>
      </div>
      {error ? (
        <span className="admin-precios-error" role="alert">
          {error}
        </span>
      ) : lectura.ok && lectura.value !== art.precio ? (
        <span className="admin-precios-vivo">
          <Variacion antes={art.precio} despues={lectura.value} /> sobre{" "}
          {money(art.precio)}
        </span>
      ) : (
        <span className="admin-precios-ayuda">Enter guarda y baja · Esc cancela</span>
      )}
    </div>
  );
}
