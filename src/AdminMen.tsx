import { useMemo, useState } from "react";
import { Check, Pencil, Search, SlidersHorizontal, X } from "lucide-react";
import catalog from "./men-catalog.json";
import { money } from "./Store";
import {
  avisoDeCambio,
  cambiarAjuste,
  leerPrecio,
  resumenAjustes,
} from "./menOverrides.mjs";
import type { AjustesHombre } from "./menOverrides.mjs";

/**
 * Catálogo de hombre: precio propio y bajas.
 *
 * El catálogo viene de fábrica con el precio que publica cada marca. Acá el
 * local le pone el suyo a lo que quiera y da de baja lo que no tiene. Lo que
 * no se toca sigue como vino, así que con 900 prendas no hay que cargar nada
 * para que la tienda ande.
 *
 * Dar de baja no borra: la prenda deja de verse en la tienda y se puede
 * reponer cuando vuelva, con el precio que tenía puesto.
 */
type Prenda = {
  id: string;
  brand: string;
  category: string;
  name: string;
  reference?: string;
  priceARS: number;
  images: string[];
  cover?: string;
};

const prendas = catalog.products as Prenda[];
const marcas = [...new Set(prendas.map((p) => p.brand))].sort();
const categorias = [...new Set(prendas.map((p) => p.category))].sort();
const POR_PAGINA = 50;

type EstadoFiltro = "todas" | "activas" | "baja" | "precio";

/** Precio de Zero de una prenda: ver, cambiar o volver al de la marca. */
function PrecioZero({
  prenda,
  precio,
  onGuardar,
}: {
  prenda: Prenda;
  precio: number | null;
  onGuardar: (precio: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const vigente = precio ?? prenda.priceARS;

  function abrir() {
    setTexto(String(vigente));
    setError("");
    setEditando(true);
  }
  function guardar() {
    const r = leerPrecio(texto);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.value === vigente) {
      setEditando(false);
      return;
    }
    // Un cambio enorme casi siempre es un cero de más o de menos: se pregunta.
    const aviso = avisoDeCambio(vigente, r.value);
    if (aviso && !confirm(aviso)) return;
    setEditando(false);
    // Si queda igual al de la marca no hace falta guardar una excepción.
    onGuardar(r.value === prenda.priceARS ? null : r.value);
  }

  if (!editando)
    return (
      <div className="admin-men-price">
        <strong className={precio === null ? "is-brand" : ""}>
          {money(vigente)}
        </strong>
        <button
          className="admin-edit-button"
          onClick={abrir}
          aria-label={`Cambiar el precio de ${prenda.name}`}
        >
          <Pencil size={13} /> {precio === null ? "Poner precio" : "Cambiar"}
        </button>
        {precio !== null && (
          <button
            className="admin-edit-button"
            onClick={() => onGuardar(null)}
            title="Volver al precio de la marca"
            aria-label={`Volver al precio de la marca para ${prenda.name}`}
          >
            <X size={13} /> Quitar
          </button>
        )}
      </div>
    );

  return (
    <div className="admin-men-price is-editing">
      <div className="admin-men-price-row">
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`Precio de ${prenda.name}`}
          aria-invalid={Boolean(error)}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") setEditando(false);
          }}
        />
        <button
          className="admin-men-icon is-ok"
          onClick={guardar}
          aria-label="Guardar precio"
        >
          <Check size={15} />
        </button>
        <button
          className="admin-men-icon"
          onClick={() => setEditando(false)}
          aria-label="Cancelar"
        >
          <X size={15} />
        </button>
      </div>
      {error && (
        <span className="admin-men-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default function AdminMen({
  ajustes,
  conectado,
  onCambiar,
  notify,
}: {
  ajustes: AjustesHombre;
  /** Con servidor se publica; sin él queda sólo en este navegador. */
  conectado: boolean;
  /** Aplica el cambio: `ids` son las prendas tocadas, `siguiente` el estado entero. */
  onCambiar: (ids: string[], siguiente: AjustesHombre) => void;
  notify: (texto: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [marca, setMarca] = useState("Todas");
  const [categoria, setCategoria] = useState("Todas");
  const [estado, setEstado] = useState<EstadoFiltro>("todas");
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());

  const resumen = useMemo(() => resumenAjustes(prendas, ajustes), [ajustes]);
  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLocaleLowerCase("es-AR");
    return prendas.filter((p) => {
      const a = ajustes[p.id];
      if (marca !== "Todas" && p.brand !== marca) return false;
      if (categoria !== "Todas" && p.category !== categoria) return false;
      if (estado === "activas" && a?.active === false) return false;
      if (estado === "baja" && a?.active !== false) return false;
      if (estado === "precio" && !a?.price) return false;
      return (
        !t ||
        `${p.name} ${p.reference || ""} ${p.category} ${p.brand}`
          .toLocaleLowerCase("es-AR")
          .includes(t)
      );
    });
  }, [busqueda, marca, categoria, estado, ajustes]);

  const pagina = filtradas.slice(0, visibles);
  const todasLaPagina =
    pagina.length > 0 && pagina.every((p) => elegidas.has(p.id));
  const sinTocar = () => setVisibles(POR_PAGINA);

  function aplicar(ids: string[], cambio: { price?: number | null; active?: boolean }, aviso: string) {
    let siguiente = ajustes;
    for (const id of ids) siguiente = cambiarAjuste(siguiente, id, cambio);
    onCambiar(ids, siguiente);
    notify(conectado ? aviso : `${aviso} (sólo en este navegador: modo demo)`);
  }

  function masivo(activar: boolean) {
    const ids = [...elegidas];
    if (!ids.length) return;
    const n = ids.length;
    const cosa = `${n} ${n === 1 ? "prenda" : "prendas"}`;
    if (
      !activar &&
      !confirm(
        `¿Dar de baja ${cosa}?\n\nDejan de verse en la tienda. No se borran: se pueden reponer cuando quieras.`,
      )
    )
      return;
    aplicar(ids, { active: activar }, activar ? `${cosa} repuestas` : `${cosa} dadas de baja`);
    setElegidas(new Set());
  }

  function alternar(id: string) {
    const siguiente = new Set(elegidas);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setElegidas(siguiente);
  }

  return (
    <section className="admin-card admin-inventory-card">
      <div className="admin-inventory-heading">
        <div>
          <h2>
            Catálogo de hombre <span>{resumen.total}</span>
          </h2>
          <p>
            Ponele tu precio a lo que quieras y dá de baja lo que no tenés. Lo
            que no toques se muestra con el precio de la marca.
          </p>
          <p className="admin-men-summary">
            <b>{resumen.activas}</b> a la venta · <b>{resumen.baja}</b> dadas de
            baja · <b>{resumen.conPrecio}</b> con precio propio
          </p>
        </div>
      </div>
      <div className="admin-filters">
        <label className="admin-search">
          <Search size={18} />
          <input
            aria-label="Buscar prendas de hombre"
            placeholder="Buscar por nombre, código o sección…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              sinTocar();
            }}
          />
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por marca"
            value={marca}
            onChange={(e) => {
              setMarca(e.target.value);
              sinTocar();
            }}
          >
            <option>Todas</option>
            {marcas.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por sección"
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              sinTocar();
            }}
          >
            <option value="Todas">Todas las secciones</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoFiltro);
              sinTocar();
            }}
          >
            <option value="todas">Todos los estados</option>
            <option value="activas">A la venta</option>
            <option value="baja">Dadas de baja</option>
            <option value="precio">Con precio propio</option>
          </select>
        </label>
      </div>

      {elegidas.size > 0 && (
        <div className="admin-men-bulk" role="region" aria-label="Acciones sobre la selección">
          <strong>
            {elegidas.size} {elegidas.size === 1 ? "seleccionada" : "seleccionadas"}
          </strong>
          <button className="admin-button admin-button-outline" onClick={() => masivo(false)}>
            Dar de baja
          </button>
          <button className="admin-button admin-button-outline" onClick={() => masivo(true)}>
            Reponer
          </button>
          <button className="admin-text-button" onClick={() => setElegidas(new Set())}>
            Limpiar selección
          </button>
        </div>
      )}

      <div className="admin-table-wrap" role="region" aria-label="Catálogo de hombre" tabIndex={0}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Elegir las prendas que se ven en esta lista"
                  checked={todasLaPagina}
                  onChange={() => {
                    const siguiente = new Set(elegidas);
                    for (const p of pagina)
                      if (todasLaPagina) siguiente.delete(p.id);
                      else siguiente.add(p.id);
                    setElegidas(siguiente);
                  }}
                />
              </th>
              <th>PRENDA</th>
              <th>PRECIO MARCA</th>
              <th>PRECIO ZERO</th>
              <th>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {pagina.map((p) => {
              const a = ajustes[p.id];
              const baja = a?.active === false;
              return (
                <tr key={p.id} className={baja ? "admin-men-baja" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Elegir ${p.name}`}
                      checked={elegidas.has(p.id)}
                      onChange={() => alternar(p.id)}
                    />
                  </td>
                  <td>
                    <div className="admin-product-cell">
                      <img
                        src={p.cover || p.images[0]}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/images/product-fallback.svg";
                        }}
                      />
                      <div>
                        <strong>{p.name}</strong>
                        <span>
                          {p.brand} · {p.category}
                        </span>
                        {p.reference && <small>{p.reference}</small>}
                      </div>
                    </div>
                  </td>
                  <td className="admin-price-cell">{money(p.priceARS)}</td>
                  <td>
                    <PrecioZero
                      key={`${p.id}-${a?.price ?? "marca"}`}
                      prenda={p}
                      precio={a?.price ?? null}
                      onGuardar={(precio) =>
                        aplicar(
                          [p.id],
                          { price: precio },
                          precio === null
                            ? `${p.name}: vuelve al precio de la marca`
                            : `${p.name}: precio de Zero ${money(precio)}`,
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className={`admin-publish-status ${baja ? "" : "is-published"}`}
                      onClick={() =>
                        aplicar(
                          [p.id],
                          { active: baja },
                          baja ? `${p.name}: repuesta` : `${p.name}: dada de baja`,
                        )
                      }
                      title={baja ? "Reponer en la tienda" : "Dar de baja: no se ve más en la tienda"}
                      aria-label={`${baja ? "Reponer" : "Dar de baja"} ${p.name}`}
                    >
                      <span />
                      {baja ? "De baja" : "A la venta"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtradas.length === 0 && (
        <p className="admin-men-empty">
          No hay prendas con esos filtros.{" "}
          <button
            className="admin-text-button"
            onClick={() => {
              setBusqueda("");
              setMarca("Todas");
              setCategoria("Todas");
              setEstado("todas");
            }}
          >
            Limpiar filtros
          </button>
        </p>
      )}

      <div className="admin-table-footer">
        <span>
          {pagina.length} de {filtradas.length} prendas
          {filtradas.length > pagina.length && (
            <>
              {" · "}
              <button className="admin-text-button" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
                Mostrar más
              </button>
              {" · "}
              <button
                className="admin-text-button"
                onClick={() => setElegidas(new Set(filtradas.map((p) => p.id)))}
              >
                Elegir las {filtradas.length}
              </button>
            </>
          )}
        </span>
      </div>
    </section>
  );
}
