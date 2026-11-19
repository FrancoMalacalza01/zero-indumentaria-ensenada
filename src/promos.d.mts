export interface PromoCuotas { cantidad: number; monto: number }
export interface PromoContado { porcentaje: number; monto: number; medios: string }
export function promosDePrecio(
  pago: { cuotasSinInteres?: number; credito?: boolean; descuentoContado?: number; efectivo?: boolean; banco?: { alias?: string; cbu?: string } } | undefined,
  precio: number,
): { cuotas: PromoCuotas | null; contado: PromoContado | null };
export function textoEnvioGratis(envio: { envioGratisDesde?: number } | undefined, formato: (n: number) => string): string | null;
