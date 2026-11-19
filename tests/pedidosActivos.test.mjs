import test from "node:test";
import assert from "node:assert/strict";
import { esPedidoActivo, importeDeVentas, pedidosActivos } from "../src/pedidosActivos.mjs";

test("están activos los pedidos que todavía hay que preparar o entregar", () => {
  for (const status of ["Pendiente", "Preparando", "Listo para retirar"]) assert.equal(esPedidoActivo({ status }), true, status);
});

test("completados, cancelados y devueltos ya no cuentan", () => {
  for (const status of ["Completado", "Cancelado", "Devuelto"]) assert.equal(esPedidoActivo({ status }), false, status);
});

test("basura no cuenta ni rompe", () => {
  assert.equal(esPedidoActivo(null), false);
  assert.equal(esPedidoActivo({}), false);
  assert.deepEqual(pedidosActivos(undefined), []);
});

test("se queda sólo con los activos", () => {
  const lista = [{ id: 1, status: "Pendiente" }, { id: 2, status: "Cancelado" }, { id: 3, status: "Preparando" }, { id: 4, status: "Completado" }];
  assert.deepEqual(pedidosActivos(lista).map((p) => p.id), [1, 3]);
});

test("las ventas no cuentan los pedidos cancelados ni devueltos", () => {
  const lista = [
    { status: "Completado", total: 1000 },
    { status: "Pendiente", total: 500 },
    { status: "Cancelado", total: 9999 },
    { status: "Devuelto", total: 7777 },
  ];
  assert.equal(importeDeVentas(lista), 1500);
  assert.equal(importeDeVentas([]), 0);
  assert.equal(importeDeVentas(undefined), 0);
  assert.equal(importeDeVentas([{ status: "Completado", total: "x" }]), 0);
});
