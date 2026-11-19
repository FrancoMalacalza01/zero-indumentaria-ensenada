import { Pencil, Tag } from "lucide-react";
import { money } from "./Store";
import { descuento } from "./priceTools.mjs";
import { diaDe } from "./ofertas.mjs";
import { cambioDePrecio, Variacion } from "./preciosComunes";
import { EditorPrecio } from "./EditorPrecio";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { CambioArticulo } from "./priceTools.mjs";
import type { Articulo, Mover } from "./preciosComunes";

/**
 * La tabla de la pestaña Precios: una fila por artículo, con casilla para elegir, el precio que se edita con un
 * clic, la oferta y el estado de venta. Es sólo la vista: el estado, el historial y los cambios siguen en
 * `AdminPrecios`.
 */
export function PreciosTabla({
  pagina,
  elegidas,
  setElegidas,
  todasLaPagina,
  editando,
  setEditando,
  resaltados,
  alternar,
  alternarVenta,
  guardarPrecio,
  ofertaRapida,
  terminarOfertas,
  ejecutar,
  ordenarPor,
  flecha,
  ariaOrden,
}: {
  pagina: Articulo[];
  elegidas: Set<string>;
  setElegidas: Dispatch<SetStateAction<Set<string>>>;
  todasLaPagina: boolean;
  editando: string | null;
  setEditando: (clave: string | null) => void;
  resaltados: Set<string>;
  alternar: (clave: string) => void;
  alternarVenta: (articulo: Articulo) => void;
  guardarPrecio: (articulo: Articulo, valor: number, mover: Mover) => boolean;
  ofertaRapida: (articulo: Articulo) => void;
  terminarOfertas: (objetivo: Articulo[]) => void;
  ejecutar: (cambios: CambioArticulo[], etiqueta: string, aviso: string) => void;
  ordenarPor: (por: "nombre" | "marca" | "precio") => void;
  flecha: (por: string) => ReactNode;
  ariaOrden: (por: string) => "none" | "ascending" | "descending";
}) {
  return (
  <div className="admin-table-wrap" role="region" aria-label="Precios de todos los artículos" tabIndex={0}>
    <table className="admin-table">
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              aria-label="Elegir los artículos que se ven en esta lista"
              checked={todasLaPagina}
              onChange={() => {
                const siguiente = new Set(elegidas);
                for (const a of pagina)
                  if (todasLaPagina) siguiente.delete(a.key);
                  else siguiente.add(a.key);
                setElegidas(siguiente);
              }}
            />
          </th>
          <th aria-sort={ariaOrden("nombre")}>
            <button className="admin-precios-orden" onClick={() => ordenarPor("nombre")}>
              ARTÍCULO {flecha("nombre")}
            </button>
          </th>
          <th aria-sort={ariaOrden("marca")}>
            <button className="admin-precios-orden" onClick={() => ordenarPor("marca")}>
              MARCA {flecha("marca")}
            </button>
          </th>
          <th aria-sort={ariaOrden("precio")}>
            <button className="admin-precios-orden" onClick={() => ordenarPor("precio")}>
              PRECIO {flecha("precio")}
            </button>
          </th>
          <th>ESTADO</th>
        </tr>
      </thead>
      <tbody>
        {pagina.map((a) => (
          <tr
            key={a.key}
            className={[
              a.activo ? "" : "admin-precios-fuera",
              resaltados.has(a.key) ? "admin-precios-flash" : "",
            ].join(" ")}
          >
            <td>
              <input
                type="checkbox"
                aria-label={`Elegir ${a.nombre}`}
                checked={elegidas.has(a.key)}
                onChange={() => alternar(a.key)}
              />
            </td>
            <td>
              <div className="admin-product-cell">
                <img
                  src={a.imagen}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/product-fallback.svg";
                  }}
                />
                <div>
                  <strong>{a.nombre}</strong>
                  <span>
                    {/* La marca tiene su columna; en el celular se ve acá. */}
                    <span className="admin-precios-marca-movil">{a.marca} · </span>
                    {a.seccion}
                    {a.detalle ? ` · ${a.detalle}` : ""}
                  </span>
                </div>
              </div>
            </td>
            <td className="admin-precios-marca">{a.marca}</td>
            <td>
              {editando === a.key ? (
                <EditorPrecio
                  art={a}
                  onGuardar={(valor, mover) => guardarPrecio(a, valor, mover)}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <div className="admin-precios-celda">
                  <button
                    className={`admin-precios-valor ${a.fuente === "men" && !a.propio ? "is-marca" : ""}`}
                    onClick={() => setEditando(a.key)}
                    aria-label={`Cambiar el precio de ${a.nombre}, ahora ${money(a.precio)}`}
                    title="Clic para cambiar el precio"
                  >
                    {a.antes ? <s>{money(a.antes)}</s> : null}
                    <strong>{money(a.precio)}</strong>
                    <Pencil size={12} aria-hidden />
                  </button>
                  {a.antes ? (
                    <span className="admin-precios-sub">
                      <span className="admin-precios-oferta">
                        <Tag size={11} aria-hidden /> Oferta −{descuento(a.antes, a.precio)}%
                        {a.hasta ? ` · hasta el ${diaDe(a.hasta).split("-").reverse().join("/")}` : ""}
                      </span>{" "}
                      <button
                        className="admin-precios-quitar"
                        onClick={() => terminarOfertas([a])}
                        aria-label={`Terminar la oferta de ${a.nombre}`}
                      >
                        terminar
                      </button>
                    </span>
                  ) : (
                    <button
                      className="admin-precios-ofertar"
                      onClick={() => ofertaRapida(a)}
                      aria-label={`Poner en oferta ${a.nombre}`}
                    >
                      <Tag size={11} aria-hidden /> poner en oferta
                    </button>
                  )}
                  {a.propio && a.precioMarca !== null && (
                    <span className="admin-precios-sub">
                      Marca {money(a.precioMarca)}{" "}
                      <Variacion antes={a.precioMarca} despues={a.precio} />{" "}
                      <button
                        className="admin-precios-quitar"
                        onClick={() =>
                          ejecutar(
                            [cambioDePrecio(a, null)],
                            `Precio de la marca: ${a.nombre}`,
                            `${a.nombre}: vuelve al precio de la marca`,
                          )
                        }
                        aria-label={`Volver al precio de la marca para ${a.nombre}`}
                      >
                        volver
                      </button>
                    </span>
                  )}
                  {a.fuente === "men" && !a.propio && (
                    <span className="admin-precios-sub">Precio de la marca</span>
                  )}
                </div>
              )}
            </td>
            <td>
              <button
                className={`admin-publish-status ${a.activo ? "is-published" : ""}`}
                onClick={() => alternarVenta(a)}
                title={a.activo ? "Sacar de la venta: no se ve en la tienda" : "Poner a la venta"}
                aria-label={`${a.activo ? "Sacar de la venta" : "Poner a la venta"} ${a.nombre}`}
              >
                <span />
                {a.activo ? "A la venta" : "Fuera de venta"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
}
