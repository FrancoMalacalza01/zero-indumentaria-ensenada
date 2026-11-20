import type { Settings } from "./types";
export function porDefecto(): Settings;
export function leerSettings(datos: unknown): Settings;
export const PLAZO_CORREO_CLASICO: string;
export function textoQuienPagaEnvio(settings: unknown): string;
export function rangosDeCodigosPostales(texto: unknown): [number, number][];
export function codigoPostalDe(entrada: unknown): number | null;
export function hayCodigosPostales(zonas: readonly { cp?: string }[]): boolean;
export function zonaPorCodigoPostal<T extends { cp?: string }>(zonas: readonly T[], entrada: unknown): T | null;
export function textoNotaDeCambios(settings: unknown): string;
export function textoPlazoEnvio(
  zona: { tipo?: string; plazo?: string } | undefined,
): string | null;
export function costoEnvio(
  settings: Settings,
  nombreZona: string | undefined,
  subtotal: number,
): number | null;
export function llegaAlEnvioGratis(settings: Settings, subtotal: number): boolean;
export function faltaParaEnvioGratis(settings: Settings, subtotal: number): number;
export function cuitFormateado(cuit: unknown): string;
export interface FaltanteLegal {
  id: string;
  impide: boolean;
  que: string;
  porque: string;
}
export function textoDePausa(settings: Settings | null | undefined): string | null;
export function faltaParaVender(settings: Settings): FaltanteLegal[];
