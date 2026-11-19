import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { Category, Product } from "./types";
import { AdminHabilitar } from "./AdminHabilitar";
import { money, units, categories, Empty } from "./adminComunes";
import { POR_PAGINA, recortar } from "./mostrarMas.mjs";
import type { useServerPanel } from "./useServerPanel";
import type { useStore } from "./Store";

type Panel = ReturnType<typeof useServerPanel>;
type Tienda = ReturnType<typeof useStore>;

/**
 * La pestaña "Productos y stock": el catálogo completo (productos propios y fichas importadas sin habilitar)
 * con búsqueda, filtros, exportar a CSV, publicar u ocultar, y la herramienta de habilitar la compra en bloque.
 * Es sólo la vista: el estado y el editor de producto siguen en `Admin`.
 */
export function AdminProductos({
  products,
  inventario,
  filtered,
  idsGuardados,
  menOverrides,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  lowOnly,
  setLowOnly,
  setProducts,
  panel,
  notify,
  openEditor,
  exportStock,
}: {
  products: Product[];
  inventario: Product[];
  filtered: Product[];
  idsGuardados: Set<string>;
  menOverrides: Tienda["menOverrides"];
  search: string;
  setSearch: (valor: string) => void;
  categoryFilter: Category | "Todas";
  setCategoryFilter: (valor: Category | "Todas") => void;
  lowOnly: boolean;
  setLowOnly: (valor: boolean) => void;
  setProducts: Tienda["setProducts"];
  panel: Panel;
  notify: Tienda["notify"];
  openEditor: (product: Product | "new") => void;
  exportStock: () => void;
}) {
  // De a 50: dibujar las ~970 prendas juntas trababa la pestaña en el celular. Al cambiar un filtro se vuelve al principio.
  const [visibles, setVisibles] = useState(POR_PAGINA);
  useEffect(() => setVisibles(POR_PAGINA), [search, categoryFilter, lowOnly]);
  const { items: pagina, quedan } = recortar(filtered, visibles);
  return (
      <>
      <AdminHabilitar products={products} ajustes={menOverrides} panel={panel} notify={notify} />
      <section className="admin-card admin-inventory-card">
        <div className="admin-inventory-heading">
          <div>
            <h2>
              Tu catálogo <span>{inventario.length}</span>
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
          <table className="admin-table admin-inventario">
            <thead>
              <tr>
                <th>PRODUCTO</th>
                <th>PRECIO</th>
                <th>STOCK</th>
                <th>ESTADO</th>
                <th>
                  <span className="admin-sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagina.map((p) => (
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
                  <td>
                    <span
                      className={`admin-stock-pill ${units(p) === 0 ? "admin-stock-empty" : units(p) <= 5 ? "admin-stock-low" : ""}`}
                    >
                      <span /> {!idsGuardados.has(p.id) ? "Sin cargar" : `${units(p)} unidades`}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`admin-publish-status ${p.active ? "is-published" : ""}`}
                      disabled={!idsGuardados.has(p.id)}
                      onClick={() => {
                        const siguientes = products.map((product) =>
                          product.id === p.id
                            ? { ...product, active: !product.active }
                            : product,
                        );
                        setProducts(siguientes);
                        const cambiado = siguientes.find(
                          (x) => x.id === p.id,
                        );
                        if (cambiado)
                          panel.publicar(
                            cambiado,
                            siguientes.indexOf(cambiado),
                          );
                        notify(
                          p.active
                            ? "Producto ocultado de la tienda"
                            : "Producto publicado",
                        );
                      }}
                      title={!idsGuardados.has(p.id) ? "Editá la ficha para administrarla" : p.active ? "Ocultar de la tienda" : "Publicar en la tienda"}
                      aria-label={`${!idsGuardados.has(p.id) ? "Editar para administrar" : p.active ? "Ocultar" : "Publicar"} ${p.name}`}
                    >
                      <span />
                      {!idsGuardados.has(p.id) ? "Editar para administrar" : p.active ? "Publicado" : "Oculto"}
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
            {pagina.length} de {filtered.length} productos
            {filtered.length !== inventario.length && ` (hay ${inventario.length} en total)`}
            {quedan > 0 && (
              <>
                {" · "}
                <button
                  className="admin-text-button"
                  onClick={() => setVisibles((v) => v + POR_PAGINA)}
                >
                  Mostrar {Math.min(POR_PAGINA, quedan)} más
                </button>
              </>
            )}
          </span>
          <span>
            <span className="admin-stock-key" /> Stock bajo: hasta 5
            unidades
          </span>
        </div>
      </section>
      </>
  );
}
