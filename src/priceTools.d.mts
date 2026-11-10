import type { Product } from "./types";
import type { AjustesHombre, AjusteHombre } from "./menOverrides.mjs";

export type Operacion = "subir" | "bajar" | "oferta" | "sumar" | "restar" | "fijar";
export type Redondeo = "ninguno" | "100" | "500" | "1000" | "900";
export const OPERACIONES: ReadonlyArray<{ id: Operacion; etiqueta: string; unidad: "%" | "$" }>;
export const REDONDEOS: ReadonlyArray<{ id: Redondeo; etiqueta: string }>;
export const LIMITE_HISTORIAL: number;

export function redondear(valor: number, modo: string): number;
export function leerRegla(
  op: string,
  entrada: unknown,
): { ok: true; value: number } | { ok: false; error: string };
export function calcularPrecio(
  actual: number,
  op: string,
  valor: number,
  redondeo?: string,
): { ok: true; value: number } | { ok: false; error: string };
export function variacion(antes: number, despues: number): number;
export function descuento(anterior: number, precio: number): number;

export interface FilaVistaPrevia {
  key: string;
  antes: number;
  despues: number | null;
  /** Sólo con la operación "oferta": el precio original sobre el que se cuenta el descuento. */
  base?: number;
  estado: "cambia" | "igual" | "error";
  error?: string;
}
export function vistaPrevia(
  items: Array<{ key: string; precio: number; base?: number }>,
  op: string,
  valor: number,
  redondeo?: string,
): {
  filas: FilaVistaPrevia[];
  cambian: number;
  iguales: number;
  errores: number;
  promedioPct: number;
};
export function precioDeProducto(producto: Product, nuevo: number): Product;
export function ofertaDeProducto(
  producto: Product,
  precio: number,
  anterior: number | null | undefined,
): Product;

export interface CambioArticulo {
  fuente: "men" | "db";
  id: string;
  /** Hombre: precio propio, o `null` para volver al de la marca. Tienda: el precio. */
  precio?: number | null;
  /** Precio anterior (tachado). Un número es una oferta; `null` la termina. */
  antes?: number | null;
  /** Cuándo termina la oferta (ISO). Sin esta clave, la oferta nueva no vence sola. */
  hasta?: string | null;
  activo?: boolean;
  /** Sólo hombre: el precio de la marca, para no guardar una excepción igual. */
  precioMarca?: number;
}
export function aplicarCambios(
  ajustes: AjustesHombre,
  productos: Product[],
  cambios: CambioArticulo[],
): { ajustes: AjustesHombre; productos: Product[] };

export interface FotoProducto {
  price: number;
  oldPrice?: number;
  active: boolean;
}
export interface Foto {
  men: Record<string, AjusteHombre | null>;
  db: Record<string, FotoProducto>;
}
export function capturar(
  ajustes: AjustesHombre,
  productos: Product[],
  idsMen: string[],
  idsDb: string[],
): Foto;
export function aplicarFoto(
  ajustes: AjustesHombre,
  productos: Product[],
  foto: Foto,
): { ajustes: AjustesHombre; productos: Product[] };

export interface EntradaHistorial {
  etiqueta: string;
  antes: Foto;
  despues: Foto;
}
export interface Historial {
  pasado: EntradaHistorial[];
  futuro: EntradaHistorial[];
}
export function historialVacio(): Historial;
export function anotar(historial: Historial, entrada: EntradaHistorial): Historial;
export function deshacer(historial: Historial): {
  historial: Historial;
  entrada: EntradaHistorial | null;
};
export function rehacer(historial: Historial): {
  historial: Historial;
  entrada: EntradaHistorial | null;
};
export function filasACsv(filas: Array<Array<string | number | null | undefined>>): string;
