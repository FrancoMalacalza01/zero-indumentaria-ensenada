export const ENTORNO_SANDBOX: string;
export const ENTORNO_PRODUCCION: string;
export const MEDIOS: readonly { readonly id: number; readonly nombre: string }[];
export function medioValido(id: unknown): boolean;
export function urlPaywayValida(valor: unknown): string;
export function tarjetaValida(numero: unknown): boolean;
export function binDe(numero: unknown): string;
export function vencimiento(texto: unknown, ahora?: Date): { mes: string; anio: string } | null;
export function codigoValido(cvv: unknown): boolean;
export function dniValido(dni: unknown): boolean;
export function cuerpoDeToken(datos: {
  numero: string;
  vencimiento: { mes: string; anio: string };
  codigo: string;
  titular: string;
  dni: string;
}): Record<string, unknown>;
export function idTransaccion(pedidoId: unknown, ahora?: number): string;
export function centavos(totalEnPesos: unknown): number;
export function cuerpoDePago(datos: {
  idTransaccion: string;
  token: string;
  medio: number | string;
  bin: string;
  total: number;
  descripcion?: string;
}): Record<string, unknown>;
export function mensajeDeRechazo(id: unknown): string;
export function interpretarPago(
  httpStatus: number,
  cuerpo: unknown,
): { estado: "aprobado" | "rechazado" | "pendiente" | "error"; paymentId: string; codigo: number | null; mensaje: string };
export function idDePagoDe(pagoRef: unknown): string;
export function urlDeAnulacion(base: unknown, paymentId: unknown): string;
export function interpretarAnulacion(
  httpStatus: number,
  cuerpo: unknown,
): { estado: "anulado" | "rechazado" | "incierto" | "error"; mensaje: string };
