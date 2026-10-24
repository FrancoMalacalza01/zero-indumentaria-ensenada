export interface AjusteHombre {
  /** Precio de Zero en pesos enteros. `null` = el de la marca. */
  price: number | null;
  /** `false` = dada de baja. */
  active: boolean;
}
export type AjustesHombre = Record<string, AjusteHombre>;
export interface FilaAjuste {
  product_id: string;
  price: number | null;
  active: boolean;
}
export const PRECIO_MAXIMO: number;
export function leerAjustes(filas: unknown): AjustesHombre;
export function ajusteAFila(id: string, ajuste: AjusteHombre): FilaAjuste;
export function cambiarAjuste(
  ajustes: AjustesHombre,
  id: string,
  cambio: Partial<AjusteHombre>,
): AjustesHombre;
export function aplicarAjustes<T extends { id: string; priceARS: number }>(
  productos: T[],
  ajustes: AjustesHombre,
): Array<T & { precioZero: boolean }>;
export function resumenAjustes(
  productos: Array<{ id: string }>,
  ajustes: AjustesHombre,
): { total: number; baja: number; conPrecio: number; activas: number };
export function leerPrecio(
  entrada: unknown,
): { ok: true; value: number } | { ok: false; error: string };
export function avisoDeCambio(actual: number, nuevo: number): string | null;
