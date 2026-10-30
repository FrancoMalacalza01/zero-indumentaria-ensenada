export function claveDeModelo(nombre: unknown): string;
export function delMismoModelo<T extends { key: string; nombre: string }>(
  articulo: { key: string; nombre: string } | undefined,
  todos: readonly T[],
): T[];

import type { FilaVistaPrevia } from "./priceTools.mjs";
type ArticuloPrecio = { key: string; nombre: string; precio: number; antes?: number };
export function vistaPorModelo(seleccion: ArticuloPrecio[], todos: ArticuloPrecio[], op: string, valor: number, redondeo: string, propagar: boolean): { filas: FilaVistaPrevia[]; cambian: number; iguales: number; errores: number; promedioPct: number };
export function ofertasDelModelo<T extends ArticuloPrecio>(seleccion: T[], todos: T[], propagar: boolean): T[];
