export type FilaMedidas = { talle: string; medidas: string };
export type TablaDeTalles =
  | { tipo: "filas"; marca: string; nota: string; filas: FilaMedidas[] }
  | { tipo: "imagen"; marca: string; src: string; alt: string };
export function tablaDeTalles(
  prenda: { id?: string; brand?: string; category?: string; name?: string } | null | undefined,
  detalles: Record<string, { medidas?: { nota?: string; filas?: FilaMedidas[] } | null }> | null | undefined,
): TablaDeTalles | null;
