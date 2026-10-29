import type { Settings } from "./types";
export function porDefecto(): Settings;
export function leerSettings(datos: unknown): Settings;
export const PLAZO_CORREO_CLASICO: string;
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
export function faltaParaVender(settings: Settings): FaltanteLegal[];
