export const ORDENES: readonly { readonly id: string; readonly etiqueta: string }[];
export function ordenarProductos<T extends { priceARS?: number }>(
  productos: readonly T[],
  orden: string,
): T[];
