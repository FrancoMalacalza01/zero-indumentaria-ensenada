export type Direccion = { calle: string; numero: string; piso: string; localidad: string; cp: string; referencia: string };
export function mailLimpio(valor: unknown): string;
export function limpiarDireccion(d: unknown): Direccion;
export function faltaEnElPedido(datos?: {
  factura?: boolean;
  email?: string;
  entrega?: string;
  direccion?: unknown;
}): string | null;
export function textoDireccion(direccion: unknown): string;
