import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tablaDeTalles } from "../src/tablasTalle.mjs";

const medidas = {
  "m-1": { nota: "Prenda en plano", filas: [{ talle: "M", medidas: "Ancho de pecho 54 cm" }, { talle: "L", medidas: "Ancho de pecho 56 cm" }] },
  "m-2": { nota: "", filas: [] },
};

test("Mistral: la tabla sale de las medidas de su ficha", () => {
  const t = tablaDeTalles({ id: "m-1", brand: "Mistral", category: "Remeras", name: "Remera" }, medidas);
  assert.equal(t.tipo, "filas");
  assert.equal(t.filas.length, 2);
  assert.equal(t.nota, "Prenda en plano");
});

test("Mistral: sin medidas publicadas no hay tabla, ni se inventa una", () => {
  assert.equal(tablaDeTalles({ id: "m-2", brand: "Mistral", category: "Remeras" }, medidas), null);
  assert.equal(tablaDeTalles({ id: "m-9", brand: "Mistral", category: "Remeras" }, medidas), null);
  assert.equal(tablaDeTalles({ id: "m-1", brand: "Mistral" }, null), null);
  // Un id como "constructor" no puede traer nada del prototipo.
  assert.equal(tablaDeTalles({ id: "constructor", brand: "Mistral" }, medidas), null);
});

test("Brooksfield: una imagen por tipo de prenda, y los jeans la suya", () => {
  const img = (category, name = "Algo") => tablaDeTalles({ id: "b-1", brand: "Brooksfield", category, name }, medidas);
  assert.equal(img("Remeras").src, "/men-medidas/brooksfield-remeras.jpg");
  assert.equal(img("Camperas").src, "/men-medidas/brooksfield-camperas.jpg");
  assert.equal(img("Pantalones", "Jean Slim Azul").src, "/men-medidas/brooksfield-jeans.jpg");
  assert.equal(img("Pantalones", "Pantalón Chino"), null);
});

test("Brooksfield: accesorios y categorías sin tabla no muestran ninguna", () => {
  for (const c of ["Billeteras", "Cinturones", "Fragancias", "Medias", "Hombre"])
    assert.equal(tablaDeTalles({ id: "b-2", brand: "Brooksfield", category: c, name: "X" }, medidas), null);
});

test("las imágenes de Brooksfield existen en public", () => {
  for (const t of ["remeras", "polos", "camisas", "sweaters", "camperas", "jeans"])
    assert.ok(existsSync(new URL(`../public/men-medidas/brooksfield-${t}.jpg`, import.meta.url)), t);
});

test("otra marca, o datos rotos: sin tabla", () => {
  assert.equal(tablaDeTalles({ id: "x", brand: "Otra" }, medidas), null);
  assert.equal(tablaDeTalles(null, medidas), null);
  assert.equal(tablaDeTalles("hola", medidas), null);
});
