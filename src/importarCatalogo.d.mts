import type { Product } from "./types";
import type { AjusteHombre } from "./menOverrides.mjs";
export interface FichaImportada {
  id: string; name: string; brand: string; category: string; priceARS: number;
  cover?: string; images: string[]; colors: string[]; sizes: string[];
}
export function prepararFichaImportada(prenda: FichaImportada, ajuste?: Partial<AjusteHombre>): Product;
export function unirCatalogo<T extends FichaImportada>(importados: T[], productos: Product[], ajustes: Record<string, AjusteHombre>, ocultos: string[] | null): Array<FichaImportada & { precioZero?: boolean; precioAnterior?: number; shopId?: string }>;
export function ocultosParaMostrar(respuesta: unknown, guardados: unknown): string[];
export const TOPE_UNIDADES_POR_TALLE: number;
export function fichasParaHabilitar(datos: {
  catalogo: readonly unknown[];
  productos: readonly { sourceCatalogId?: string }[];
  ajustes?: Record<string, { price?: number | null; old?: number; active?: boolean }>;
  unidades: number;
}): {
  fichas: import("./types").Product[];
  yaHabilitadas: number;
  dadasDeBaja: number;
  sinTalles: number;
};
