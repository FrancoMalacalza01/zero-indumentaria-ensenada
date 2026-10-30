export function pedirTodasLasFilas<T>(pedir: (ruta: string) => Promise<T[]>, ruta: string, limite?: number): Promise<T[]>;
