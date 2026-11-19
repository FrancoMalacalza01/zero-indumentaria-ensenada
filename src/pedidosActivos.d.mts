export function esPedidoActivo(pedido: { status?: string } | null | undefined): boolean;
export function pedidosActivos<T extends { status?: string }>(pedidos: readonly T[] | null | undefined): T[];
export function importeDeVentas(pedidos: readonly { status?: string; total?: number }[] | null | undefined): number;
