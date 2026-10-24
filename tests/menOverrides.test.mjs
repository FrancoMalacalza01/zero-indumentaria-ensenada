import test from "node:test";
import assert from "node:assert/strict";
import {
  leerAjustes,
  ajusteAFila,
  cambiarAjuste,
  aplicarAjustes,
  resumenAjustes,
  leerPrecio,
  avisoDeCambio,
  PRECIO_MAXIMO,
} from "../src/menOverrides.mjs";

const catalogo = [
  { id: "a", name: "Remera", priceARS: 30000 },
  { id: "b", name: "Buzo", priceARS: 60000 },
  { id: "c", name: "Campera", priceARS: 90000 },
];

test("sin excepciones, el catálogo se muestra tal como viene", () => {
  const lista = aplicarAjustes(catalogo, {});
  assert.deepEqual(
    lista.map((p) => [p.id, p.priceARS, p.precioZero]),
    [["a", 30000, false], ["b", 60000, false], ["c", 90000, false]],
  );
});

test("una prenda dada de baja desaparece de la tienda", () => {
  const lista = aplicarAjustes(catalogo, { b: { price: null, active: false } });
  assert.deepEqual(lista.map((p) => p.id), ["a", "c"]);
});

test("el precio de Zero pisa al de la marca y se marca como propio", () => {
  const [a, b] = aplicarAjustes(catalogo, { a: { price: 27500, active: true } });
  assert.equal(a.priceARS, 27500);
  assert.equal(a.precioZero, true);
  assert.equal(b.priceARS, 60000);
  assert.equal(b.precioZero, false);
});

test("una baja conserva el precio puesto, para que al reponerla no se pierda", () => {
  let aj = cambiarAjuste({}, "a", { price: 27500 });
  aj = cambiarAjuste(aj, "a", { active: false });
  assert.deepEqual(aj.a, { price: 27500, active: false });
  aj = cambiarAjuste(aj, "a", { active: true });
  assert.deepEqual(aj.a, { price: 27500, active: true });
});

test("si la prenda vuelve a como venía de fábrica, su excepción se borra", () => {
  let aj = cambiarAjuste({}, "a", { price: 27500 });
  aj = cambiarAjuste(aj, "a", { price: null });
  assert.deepEqual(aj, {});
  aj = cambiarAjuste({}, "b", { active: false });
  aj = cambiarAjuste(aj, "b", { active: true });
  assert.deepEqual(aj, {});
});

test("cambiar una prenda no toca a las demás ni muta lo anterior", () => {
  const antes = { a: { price: 1000, active: true } };
  const despues = cambiarAjuste(antes, "b", { active: false });
  assert.deepEqual(antes, { a: { price: 1000, active: true } });
  assert.deepEqual(despues.a, { price: 1000, active: true });
  assert.deepEqual(despues.b, { price: null, active: false });
});

test("un precio inválido en un cambio se descarta en vez de guardarse", () => {
  for (const malo of [0, -5, 12.5, NaN, "caro", PRECIO_MAXIMO + 1]) {
    assert.deepEqual(cambiarAjuste({}, "a", { price: malo }), {});
  }
});

test("las filas del servidor se leen, y las rotas se ignoran sin romper nada", () => {
  const aj = leerAjustes([
    { product_id: "a", price: 27500, active: true },
    { product_id: "b", price: null, active: false },
    { product_id: "c", price: null, active: true }, // igual que de fábrica
    { product_id: "d", price: -3, active: false }, // precio roto, baja válida
    { product_id: "", price: 10, active: true },
    null,
    { price: 10 },
  ]);
  assert.deepEqual(Object.keys(aj).sort(), ["a", "b", "d"]);
  assert.deepEqual(aj.d, { price: null, active: false });
  assert.deepEqual(leerAjustes(null), {});
  assert.deepEqual(leerAjustes("basura"), {});
});

test("la fila que va al servidor sale con tipos limpios", () => {
  assert.deepEqual(ajusteAFila("a", { price: 27500, active: true }), {
    product_id: "a",
    price: 27500,
    active: true,
  });
  assert.deepEqual(ajusteAFila("b", { price: 12.5, active: false }), {
    product_id: "b",
    price: null,
    active: false,
  });
});

test("el resumen cuenta bajas y precios propios", () => {
  const r = resumenAjustes(catalogo, {
    a: { price: 1000, active: true },
    b: { price: null, active: false },
    zzz: { price: 5, active: false }, // de una prenda que ya no existe
  });
  assert.deepEqual(r, { total: 3, baja: 1, conPrecio: 1, activas: 2 });
});

test("el precio se lee como lo escribe la gente", () => {
  for (const [texto, esperado] of [
    ["32900", 32900],
    ["32.900", 32900],
    ["$ 32.900", 32900],
    ["1.234.567", 1234567],
    ["  45000  ", 45000],
    [45000, 45000],
  ])
    assert.deepEqual(leerPrecio(texto), { ok: true, value: esperado }, String(texto));
});

test("el precio no se adivina: centavos, ceros y basura se rechazan con motivo", () => {
  for (const malo of ["", "   ", "0", "-100", "32900,50", "32.5", "12,3", "abc", "10 mil", 12.5, NaN]) {
    const r = leerPrecio(malo);
    assert.equal(r.ok, false, `debía rechazar ${JSON.stringify(malo)}`);
    assert.ok(r.error.length > 10);
  }
  assert.equal(leerPrecio(PRECIO_MAXIMO + 1).ok, false);
  assert.equal(leerPrecio(String(PRECIO_MAXIMO)).ok, true);
});

test("avisa cuando el cambio parece un error de tipeo, no cuando es normal", () => {
  assert.equal(avisoDeCambio(32900, 29900), null); // un descuento
  assert.equal(avisoDeCambio(32900, 32900), null);
  assert.equal(avisoDeCambio(32900, 65800), null); // justo el doble
  assert.match(avisoDeCambio(32900, 3290), /\$32\.900 a \$3\.290 \(-90%\)/);
  assert.match(avisoDeCambio(32900, 329000), /\+900%/);
});
