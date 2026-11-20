import test from "node:test";
import assert from "node:assert/strict";
import { codigoDePagoValido, montoCoincide } from "../supabase/functions/_shared/codigoDePago.mjs";

const A = "a".repeat(64);
const B = "b".repeat(64);

test("el código de pago del pedido abre; otro no", () => {
  assert.equal(codigoDePagoValido(A, A), true);
  assert.equal(codigoDePagoValido(A, B), false);
  assert.equal(codigoDePagoValido(A, A.slice(0, 63) + "b"), false);
});

test("sin código, o con uno mal formado, no abre: pedido sin código, vacío, mayúsculas, largo o tipo equivocado", () => {
  assert.equal(codigoDePagoValido(null, A), false);
  assert.equal(codigoDePagoValido(A, undefined), false);
  assert.equal(codigoDePagoValido(A, ""), false);
  assert.equal(codigoDePagoValido(A, A.toUpperCase()), false);
  assert.equal(codigoDePagoValido(A, A + "a"), false);
  assert.equal(codigoDePagoValido(A, 123), false);
  // Dos vacíos o dos mal formados iguales tampoco abren.
  assert.equal(codigoDePagoValido("", ""), false);
  assert.equal(codigoDePagoValido("x", "x"), false);
});

test("el monto de Mercado Pago tiene que ser el del pedido, al centavo", () => {
  assert.equal(montoCoincide(35900, 35900), true);
  assert.equal(montoCoincide("35900.00", 35900), true);
  assert.equal(montoCoincide(35899.99, 35900), false);
  assert.equal(montoCoincide(0, 0), false);
  assert.equal(montoCoincide(undefined, 35900), false);
  assert.equal(montoCoincide(35900, "mucho"), false);
});
