import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { tablaDeTalles } from "./tablasTalle.mjs";
import { detallesDePrenda } from "./detallesPrenda.mjs";

/** Lo mínimo que hace falta de una prenda para mostrar lo que cuenta su marca. */
export type PrendaDeMarca = { id: string; brand: string; category: string; name: string; colors: string[] };

export type FichasDeMarca = Record<string, { composicion?: string | null; descripcion?: string[]; caracteristicas?: string[]; cuidados?: string[]; medidas?: { nota?: string; filas?: { talle: string; medidas: string }[] } | null }>;
let fichasEnMemoria: FichasDeMarca | null = null;
/**
 * Lo que cada marca cuenta de sus prendas (material, características, medidas).
 * Pesa más de un mega: se baja recién cuando alguien abre una prenda, no con la página.
 */
export function useFichasDeMarca(activo = true) {
  const [fichas, setFichas] = useState<FichasDeMarca | null>(fichasEnMemoria);
  useEffect(() => {
    if (!activo || fichasEnMemoria) return;
    let vigente = true;
    import("./men-detalles.json").then((m) => {
      fichasEnMemoria = (m.default || m) as unknown as FichasDeMarca;
      if (vigente) setFichas(fichasEnMemoria);
    }).catch(() => { /* sin la ficha, la galería sigue andando: sólo no muestra detalles */ });
    return () => { vigente = false; };
  }, [activo]);
  return fichas;
}

/** Material, color y características de la prenda, como los cuenta su marca. */
export function DetallesDePrenda({ product, fichas }: { product: PrendaDeMarca; fichas: FichasDeMarca | null }) {
  const d = detallesDePrenda(product, fichas);
  if (!d) return null;
  return (
    <section className="men-detalles" aria-label="Detalles de la prenda">
      <h3>Detalles de la prenda</h3>
      <dl>
        {d.composicion && <><dt>Material</dt><dd>{d.composicion}</dd></>}
        {d.colores.length > 0 && <><dt>{d.colores.length > 1 ? "Colores" : "Color"}</dt><dd>{d.colores.join(", ")}</dd></>}
      </dl>
      {d.descripcion.length > 0 && <div className="men-descripcion">{d.descripcion.map((p) => <p key={p}>{p}</p>)}</div>}
      {d.caracteristicas.length > 0 && <ul>{d.caracteristicas.map((c) => <li key={c}>{c}</li>)}</ul>}
      {d.cuidados.length > 0 && <details><summary>Cuidados</summary><ul>{d.cuidados.map((c) => <li key={c}>{c}</li>)}</ul></details>}
      <small>Información de {product.brand}.</small>
    </section>
  );
}

/** La tabla de talles que publica la marca para esta prenda, si la publicó. */
export function TablaDeTalles({ product, fichas }: { product: PrendaDeMarca; fichas: FichasDeMarca | null }) {
  const tabla = tablaDeTalles(product, fichas);
  if (!tabla) return null;
  return (
    <details className="men-talles">
      <summary><Ruler size={16} /> Tabla de talles</summary>
      {tabla.tipo === "filas" ? (
        <>
          <p>Medidas en cm{tabla.nota ? ` (${tabla.nota.toLowerCase()})` : ""}. Pueden variar mínimamente según la producción.</p>
          <table>
            <tbody>
              {tabla.filas.map((f) => <tr key={f.talle}><th scope="row">{f.talle}</th><td>{f.medidas}</td></tr>)}
            </tbody>
          </table>
        </>
      ) : (
        <a href={tabla.src} target="_blank" rel="noreferrer noopener" title="Abrir la tabla en grande">
          <img src={tabla.src} alt={tabla.alt} loading="lazy" />
        </a>
      )}
      <small>Tabla de {tabla.marca}.</small>
    </details>
  );
}
