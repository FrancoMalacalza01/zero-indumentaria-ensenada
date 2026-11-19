import test from "node:test";
import assert from "node:assert/strict";
import { POR_PAGINA, recortar } from "../src/mostrarMas.mjs";

const lista = Array.from({ length: 120 }, (_, i) => i);

test("se muestran los primeros 50 y se avisa cuántos faltan", () => {
  const r = recortar(lista);
  assert.equal(POR_PAGINA, 50);
  assert.equal(r.items.length, 50);
  assert.equal(r.items[0], 0);
  assert.equal(r.quedan, 70);
});

test("'Mostrar más' suma de a 50 hasta mostrar todo", () => {
  assert.equal(recortar(lista, 100).quedan, 20);
  const todo = recortar(lista, 150);
  assert.equal(todo.items.length, 120);
  assert.equal(todo.quedan, 0);
});

test("una lista corta se muestra entera y sin 'mostrar más'", () => {
  const r = recortar([1, 2, 3]);
  assert.deepEqual(r.items, [1, 2, 3]);
  assert.equal(r.quedan, 0);
});

test("basura no rompe: sin lista o con una cantidad rara", () => {
  assert.deepEqual(recortar(undefined), { items: [], quedan: 0 });
  assert.equal(recortar(lista, NaN).items.length, 50);
  assert.equal(recortar(lista, -5).items.length, 0);
  assert.equal(recortar(lista, 12.9).items.length, 12);
});
