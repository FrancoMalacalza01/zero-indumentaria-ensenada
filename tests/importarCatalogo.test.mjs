import test from "node:test";
import assert from "node:assert/strict";
import { prepararFichaImportada } from "../src/importarCatalogo.mjs";

const prenda = { id: "m-123", name: "Remera", brand: "Mistral", category: "Remeras", priceARS: 10000, cover: "/foto.webp", images: ["/foto.webp", "/foto-2.webp"], colors: ["Azul"], sizes: ["M", "L", "m"] };

test("conserva datos y fotos sin inventar existencias", () => {
  const ficha = prepararFichaImportada(prenda);
  assert.equal(ficha.id, "importado-m-123");
  assert.equal(ficha.brand, "Mistral");
  assert.deepEqual(ficha.images, prenda.images);
  assert.deepEqual(ficha.sizes, ["M", "L"]);
  assert.deepEqual(ficha.stock, { M: 0, L: 0 });
});

test("preserva precio propio, oferta y baja del local", () => {
  const ficha = prepararFichaImportada(prenda, { price: 8000, old: 10000, active: false });
  assert.equal(ficha.price, 8000);
  assert.equal(ficha.oldPrice, 10000);
  assert.equal(ficha.active, false);
});

test("sin talle conocido no inventa uno", () => {
  const ficha = prepararFichaImportada({ ...prenda, sizes: [] });
  assert.deepEqual(ficha.sizes, []);
  assert.deepEqual(ficha.stock, {});
});

test("sin identificador no genera una ficha que pueda duplicarse", () => {
  assert.throws(() => prepararFichaImportada({ ...prenda, id: "" }));
});

import { unirCatalogo, ocultosParaMostrar } from "../src/importarCatalogo.mjs";
test("la ficha administrada reemplaza a la importada y muestra sólo talles con stock", () => {
  const ficha = { ...prepararFichaImportada(prenda), name: "Nombre nuevo", brand: "Otra", price: 7000, stock: { M: 2, L: 0 } };
  const r = unirCatalogo([prenda], [ficha], {}, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "Nombre nuevo");
  assert.equal(r[0].priceARS, 7000);
  assert.deepEqual(r[0].sizes, ["M"]);
  assert.equal(r[0].shopId, ficha.id);
});

test("no muestra una ficha ocultada ni reaparece al faltar la consulta de bajas", () => {
  assert.deepEqual(unirCatalogo([prenda], [], {}, [prenda.id]), []);
  assert.deepEqual(unirCatalogo([prenda], [], {}, null), []);
  assert.deepEqual(unirCatalogo([prenda], [], { [prenda.id]: { active: false } }, []), []);
});

test("una ficha no administrada conserva los ajustes y la consulta por WhatsApp", () => {
  const [r] = unirCatalogo([prenda], [], { [prenda.id]: { active: true, price: 9000 } }, []);
  assert.equal(r.priceARS, 9000);
  assert.equal(r.shopId, undefined);
  assert.deepEqual(r.sizes, []);
});
test("un producto nuevo creado por el local también aparece en hombre", () => {
  const nuevo = { ...prepararFichaImportada(prenda), id: "local-1", sourceCatalogId: undefined, stock: { M: 1, L: 0 } };
  const r = unirCatalogo([], [nuevo], {}, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].shopId, "local-1");
  assert.deepEqual(r[0].sizes, ["M"]);
});

test("las fichas ocultas: manda el servidor; si no contesta, lo último que se supo; y si no hay nada, no se vacía la tienda", () => {
  assert.deepEqual(ocultosParaMostrar(["a"], ["b"]), ["a"]);
  assert.deepEqual(ocultosParaMostrar([], ["b"]), []); // el servidor dice que no hay ninguna oculta
  assert.deepEqual(ocultosParaMostrar(null, ["b"]), ["b"]);
  assert.deepEqual(ocultosParaMostrar(null, null), []);
  assert.deepEqual(ocultosParaMostrar(undefined, "basura"), []);
  assert.deepEqual(ocultosParaMostrar(["a", 5, null], null), ["a"]);
  // con la lista vacía, el catálogo se muestra entero: nunca queda en cero por una falla
  assert.equal(unirCatalogo([prenda], [], {}, ocultosParaMostrar(null, null)).length, 1);
});
