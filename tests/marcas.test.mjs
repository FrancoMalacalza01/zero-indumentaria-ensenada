import test from "node:test";
import assert from "node:assert/strict";
import { MARCAS, categoriasPorMarca, slugDeMarca } from "../src/marcas.mjs";

const productos = [
  { brand: "Mistral", category: "Remeras" },
  { brand: "Mistral", category: "Remeras" },
  { brand: "Mistral", category: "Buzos" },
  { brand: "Brooksfield", category: "Camisas" },
  { brand: "Brooksfield", category: "Billeteras" },
  { brand: "Brooksfield", category: "Billeteras" },
  { brand: "Brooksfield", category: "Billeteras" },
];

test("las categorías se separan por marca, de la más numerosa a la menos", () => {
  const c = categoriasPorMarca(productos);
  assert.deepEqual(Object.keys(c), ["Mistral", "Brooksfield"]);
  assert.deepEqual(c.Mistral, [{ nombre: "Remeras", cantidad: 2 }, { nombre: "Buzos", cantidad: 1 }]);
  assert.deepEqual(c.Brooksfield, [{ nombre: "Billeteras", cantidad: 3 }, { nombre: "Camisas", cantidad: 1 }]);
});

test("una categoría de una marca no aparece en la otra", () => {
  const c = categoriasPorMarca(productos);
  assert.equal(c.Mistral.some((x) => x.nombre === "Billeteras"), false);
  assert.equal(c.Brooksfield.some((x) => x.nombre === "Remeras"), false);
});

test("las marcas conocidas siempre están, aunque no tengan prendas; las otras van después; lo roto se ignora", () => {
  const c = categoriasPorMarca([{ brand: "Otra", category: "X" }, null, { brand: "", category: "Y" }, { brand: "Mistral" }, "basura"]);
  assert.deepEqual(Object.keys(c), ["Mistral", "Brooksfield", "Otra"]);
  assert.deepEqual(c.Mistral, []);
  assert.deepEqual(categoriasPorMarca(null).Mistral, []);
});

test("el archivo del logo sale del nombre de la marca, sin tildes ni símbolos", () => {
  assert.deepEqual(MARCAS.map(slugDeMarca), ["mistral", "brooksfield"]);
  assert.equal(slugDeMarca("Brooksfield "), "brooksfield");
  assert.equal(slugDeMarca("Óscar & Co."), "oscar-co");
  assert.equal(slugDeMarca(undefined), "");
});
