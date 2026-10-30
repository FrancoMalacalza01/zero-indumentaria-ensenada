import test from "node:test";
import assert from "node:assert/strict";
import { pedirTodasLasFilas } from "../src/paginar.mjs";
test("lee todas las páginas, incluso cuando una página está llena", async () => {
  const rutas = [];
  const filas = await pedirTodasLasFilas(async (ruta) => {
    rutas.push(ruta);
    return rutas.length === 1 ? [1, 2] : rutas.length === 2 ? [3] : [];
  }, "stock?order=id", 2);
  assert.deepEqual(filas, [1, 2, 3]);
  assert.deepEqual(rutas, ["stock?order=id&limit=2&offset=0", "stock?order=id&limit=2&offset=2"]);
});
test("rechaza una respuesta inesperada", async () => {
  await assert.rejects(pedirTodasLasFilas(async () => null, "products"));
});
