export const CATEGORIAS_EN_TIENDA: readonly ["Hombre"];
export function esProductoDeTienda(
  producto: { active?: boolean; category?: string } | null | undefined,
): boolean;
