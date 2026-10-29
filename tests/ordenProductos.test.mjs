import test from "node:test";
import assert from "node:assert/strict";
import { ORDENES, ordenarProductos } from "../src/ordenProductos.mjs";

const lista = [
  { id: "a", priceARS: 30000 },
  { id: "b", priceARS: 10000 },
  { id: "c", priceARS: 20000 },
  { id: "d", priceARS: 10000 },
];
const ids = (l) => l.map((p) => p.id).join("");

test("destacados deja el orden del catálogo, y una opción desconocida también", () => {
  assert.equal(ids(ordenarProductos(lista, "destacados")), "abcd");
  assert.equal(ids(ordenarProductos(lista, "cualquiera")), "abcd");
});

test("menor a mayor y mayor a menor; con precios iguales se conserva el orden", () => {
  assert.equal(ids(ordenarProductos(lista, "precio-menor")), "bdca");
  assert.equal(ids(ordenarProductos(lista, "precio-mayor")), "acbd");
});

test("no modifica la lista original", () => {
  const antes = ids(lista);
  ordenarProductos(lista, "precio-menor");
  assert.equal(ids(lista), antes);
});

test("una prenda sin precio válido va al final en cualquier sentido", () => {
  const raras = [
    { id: "x" },
    { id: "a", priceARS: 5 },
    { id: "y", priceARS: 0 },
    { id: "b", priceARS: 9 },
    { id: "z", priceARS: NaN },
  ];
  assert.equal(ids(ordenarProductos(raras, "precio-menor")), "abxyz");
  assert.equal(ids(ordenarProductos(raras, "precio-mayor")), "baxyz");
});

test("una lista que no es lista da vacío, y las opciones tienen id único", () => {
  assert.deepEqual(ordenarProductos(null, "precio-menor"), []);
  assert.equal(new Set(ORDENES.map((o) => o.id)).size, ORDENES.length);
});
