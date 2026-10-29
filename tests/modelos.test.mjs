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
