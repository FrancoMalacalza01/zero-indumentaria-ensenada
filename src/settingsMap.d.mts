import type { Settings } from "./types";
export function porDefecto(): Settings;
export function leerSettings(datos: unknown): Settings;
export function costoEnvio(
  settings: Settings,
  nombreZona: string | undefined,
  subtotal: number,
): number | null;
export function llegaAlEnvioGratis(settings: Settings, subtotal: number): boolean;
export function faltaParaEnvioGratis(settings: Settings, subtotal: number): number;
