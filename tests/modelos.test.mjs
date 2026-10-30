import test from "node:test";
import assert from "node:assert/strict";
import { claveDeModelo, delMismoModelo } from "../src/modelos.mjs";

test("la clave ignora el código del final, las mayúsculas y los espacios", () => {
  assert.equal(claveDeModelo("Remera Blank MC - 10206-5"), "remera blank mc");
  assert.equal(claveDeModelo("Remera Blank MC"), "remera blank mc");
  assert.equal(claveDeModelo("  Polo  Pique Rayada MC - 20080-20 "), "polo pique rayada mc");
});

test("un guion dentro del nombre no se confunde con el código", () => {
  assert.equal(claveDeModelo("Camisa Lino - Slim fit - 5501"), "camisa lino - slim fit");
});

test("no es texto: clave vacía", () => {
  assert.equal(claveDeModelo(undefined), "");
  assert.equal(claveDeModelo(null), "");
});

test("trae las versiones del mismo modelo de las dos fuentes, sin el propio", () => {
  const todos = [
    { key: "db:1", nombre: "Remera Blank MC" },
    { key: "men:a", nombre: "Remera Blank MC - 10206-5" },
    { key: "men:b", nombre: "Remera Blank MC - 10206-7" },
    { key: "men:c", nombre: "Remera Stripes MC - 10193-4" },
  ];
  assert.deepEqual(delMismoModelo(todos[0], todos).map((x) => x.key), ["men:a", "men:b"]);
  assert.deepEqual(delMismoModelo(todos[1], todos).map((x) => x.key), ["db:1", "men:b"]);
  assert.deepEqual(delMismoModelo({ key: "x", nombre: "" }, todos), []);
});

import { vistaPorModelo, ofertasDelModelo } from "../src/modelos.mjs";
import { aplicarCambios } from "../src/priceTools.mjs";

const versiones = [
  { key: "db:1", nombre: "Remera Blank MC", precio: 10000 },
  { key: "men:a", nombre: "Remera Blank MC - 10206-5", precio: 12000 },
  { key: "men:b", nombre: "Remera Blank MC - 10206-7", precio: 8000 },
  { key: "men:c", nombre: "Otro modelo - 10", precio: 5000 },
];

test("la vista incluye todas las versiones y aplica una sola referencia por modelo", () => {
  const v = vistaPorModelo([versiones[0], versiones[1]], versiones, "subir", 10, "ninguno", true);
  assert.deepEqual(v.filas.map(f => [f.key, f.antes, f.despues]), [["db:1", 10000, 11000], ["men:a", 12000, 11000], ["men:b", 8000, 11000]]);
  assert.equal(v.cambian, 3);
});

test("con propagación apagada se calculan sólo los seleccionados", () => {
  const v = vistaPorModelo([versiones[0], versiones[1]], versiones, "subir", 10, "ninguno", false);
  assert.deepEqual(v.filas.map(f => f.despues), [11000, 13200]);
});

test("un resultado inválido no se propaga y se informa", () => {
  const v = vistaPorModelo([versiones[0]], versiones, "restar", 20000, "ninguno", true);
  assert.equal(v.errores, 1);
  assert.equal(v.cambian, 0);
  assert.equal(v.filas.length, 1);
});

test("terminar oferta incluye versiones en oferta una sola vez y conserva sus precios anteriores", () => {
  const articulos = versiones.map((a, i) => ({ ...a, ...(i < 3 ? { antes: 10000 + i * 1000 } : {}) }));
  assert.deepEqual(ofertasDelModelo([articulos[0], articulos[1]], articulos, true).map(a => a.antes), [10000, 11000, 12000]);
  assert.deepEqual(ofertasDelModelo([articulos[0]], articulos, false).map(a => a.key), ["db:1"]);
});

test("una oferta conserva el tachado aunque el precio coincida con el de la marca", () => {
  const resultado = aplicarCambios({}, [], [{ fuente: "men", id: "a", precio: 8000, precioMarca: 8000, antes: 10000 }]);
  assert.deepEqual(resultado.ajustes.a, { price: 8000, active: true, old: 10000 });
});
