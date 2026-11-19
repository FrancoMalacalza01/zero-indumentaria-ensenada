// Lo que comparten las piezas de la pestaña Precios: tipos, constantes y ayudas.
import catalog from "./men-catalog.json";
import type { AjustesHombre } from "./menOverrides.mjs";
import { descuento, variacion } from "./priceTools.mjs";
import type { CambioArticulo } from "./priceTools.mjs";
import type { Product } from "./types";

export type Fuente = "db" | "men";
export type Mover = -1 | 0 | 1;

export type Articulo = {
  key: string;
  fuente: Fuente;
  id: string;
  nombre: string;
  marca: string;
  seccion: string;
  detalle: string;
  imagen: string;
  precio: number;
  /** Sólo hombre: lo que publica la marca. */
  precioMarca: number | null;
  /**
   * El precio anterior, el que se muestra tachado. Si existe, el artículo está
   * en oferta. Es el precio de partida del descuento.
   */
  antes?: number;
  /** Cuándo termina la oferta (ISO), si tiene fecha de fin. */
  hasta?: string;
  /** Hombre con precio propio puesto por el local. */
  propio: boolean;
  activo: boolean;
};

export type PrendaHombre = {
  id: string;
  brand: string;
  category: string;
  name: string;
  reference?: string;
  priceARS: number;
  images: string[];
  cover?: string;
};

export const prendasHombre = catalog.products as PrendaHombre[];
export const POR_PAGINA = 50;
export const AVISO_RESALTADO = 1600;

export type EstadoFiltro = "todos" | "venta" | "fuera" | "propio" | "oferta" | "tocados";
export type Orden = { por: "nombre" | "marca" | "precio"; dir: 1 | -1 } | null;

export function articulosDe(productos: Product[], ajustes: AjustesHombre): Articulo[] {
  const tienda = productos.map<Articulo>((p) => ({
    key: `db:${p.id}`,
    fuente: "db",
    id: p.id,
    nombre: p.name,
    marca: p.brand || "Zero",
    seccion: p.type,
    detalle: `${p.category} · ${p.color}`,
    imagen: p.image,
    precio: p.price,
    precioMarca: null,
    antes: p.oldPrice && p.oldPrice > p.price ? p.oldPrice : undefined,
    hasta: p.oldPrice && p.oldPrice > p.price ? p.offerUntil : undefined,
    propio: false,
    activo: p.active,
  }));
  const importados = new Set(productos.map((p) => p.sourceCatalogId).filter(Boolean));
  const hombre = prendasHombre.filter((m) => !importados.has(m.id)).map<Articulo>((m) => {
    const a = ajustes[m.id];
    return {
      key: `men:${m.id}`,
      fuente: "men",
      id: m.id,
      nombre: m.name,
      marca: m.brand,
      seccion: m.category,
      detalle: m.reference || "",
      imagen: m.cover || m.images[0],
      precio: a?.price ?? m.priceARS,
      precioMarca: m.priceARS,
      antes: a?.price != null && a.old && a.old > a.price ? a.old : undefined,
      hasta: a?.price != null && a.old && a.old > a.price ? a.hasta ?? undefined : undefined,
      propio: a?.price != null,
      activo: a?.active !== false,
    };
  });
  return [...tienda, ...hombre];
}

/** Un cambio de precio para una celda: lo que lleva depende de qué artículo es. */
export function cambioDePrecio(a: Articulo, precio: number | null): CambioArticulo {
  return a.fuente === "men"
    ? { fuente: "men", id: a.id, precio, precioMarca: a.precioMarca ?? undefined }
    : { fuente: "db", id: a.id, precio: precio ?? a.precio };
}

/** Cuánto cambió un precio, como una etiqueta: ▲ 10% / ▼ 8%. */
export function Variacion({ antes, despues }: { antes: number; despues: number }) {
  const v = variacion(antes, despues);
  if (!v) return null;
  return (
    <span className={`admin-precios-var ${v > 0 ? "is-up" : "is-down"}`}>
      {v > 0 ? "▲" : "▼"} {Math.abs(v)}%
    </span>
  );
}
