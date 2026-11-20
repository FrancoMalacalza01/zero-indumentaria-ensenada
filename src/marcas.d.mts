export const MARCAS: readonly string[];
export function slugDeMarca(marca: unknown): string;
export function categoriasPorMarca(
  productos: readonly { brand?: string; category?: string }[] | null | undefined,
): Record<string, { nombre: string; cantidad: number }[]>;
