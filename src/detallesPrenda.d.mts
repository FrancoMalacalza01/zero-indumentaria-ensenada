export type DetallesDePrenda = {
  composicion: string;
  colores: string[];
  caracteristicas: string[];
  cuidados: string[];
};
export function detallesDePrenda(
  prenda: { id?: string; colors?: string[] } | null | undefined,
  detalles: Record<string, { composicion?: string | null; caracteristicas?: string[]; cuidados?: string[] }> | null | undefined,
): DetallesDePrenda | null;
