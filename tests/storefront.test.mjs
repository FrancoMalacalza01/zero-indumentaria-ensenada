import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS_EN_TIENDA, esProductoDeTienda } from "../src/storefront.mjs";

const producto = (category, active = true) => ({ id: "x", category, active });

test("la tienda sólo publica prendas de hombre", () => {
  assert.deepEqual([...CATEGORIAS_EN_TIENDA], ["Hombre"]);
  assert.equal(esProductoDeTienda(producto("Hombre")), true);
});

test("Accesorios no se muestra, aunque esté publicado", () => {
  assert.equal(esProductoDeTienda(producto("Accesorios")), false);
});

test("un producto de hombre sin publicar tampoco se muestra", () => {
  assert.equal(esProductoDeTienda(producto("Hombre", false)), false);
});

test("una categoría desconocida o un dato roto no se muestran ni rompen nada", () => {
  for (const malo of [
    producto("Niños"),
    producto(""),
    producto(undefined),
    { category: "Hombre" }, // sin `active`: no está publicado
    { active: true }, // sin categoría
    {},
    null,
    undefined,
    "Hombre",
    42,
  ])
    assert.equal(esProductoDeTienda(malo), false, JSON.stringify(malo));
});

test("la categoría tiene que coincidir exacta: no vale otra capitalización", () => {
  assert.equal(esProductoDeTienda(producto("hombre")), false);
  assert.equal(esProductoDeTienda(producto("HOMBRE")), false);
  assert.equal(esProductoDeTienda(producto(" Hombre")), false);
});

test("la lista de categorías publicadas no se puede cambiar desde afuera", () => {
  assert.throws(() => {
    "use strict";
    CATEGORIAS_EN_TIENDA.push("Accesorios");
  });
  assert.equal(esProductoDeTienda(producto("Accesorios")), false);
});
