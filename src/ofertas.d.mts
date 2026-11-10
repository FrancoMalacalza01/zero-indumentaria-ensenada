export function hastaValido(valor: unknown): string | null;
export function finDelDia(dia: unknown): string | null;
export function diaDe(hasta: unknown): string;
export function vencida(hasta: unknown, ahora?: number): boolean;
export function precioVigente(
  oferta: { price: number; old?: number | null; hasta?: string | null },
  ahora?: number,
): { price: number; old: number | null; hasta: string | null };
