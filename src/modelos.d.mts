export function claveDeModelo(nombre: unknown): string;
export function delMismoModelo<T extends { key: string; nombre: string }>(
  articulo: { key: string; nombre: string } | undefined,
  todos: readonly T[],
): T[];
