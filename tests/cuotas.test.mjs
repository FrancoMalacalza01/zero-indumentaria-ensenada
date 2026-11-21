import test from "node:test";
import assert from "node:assert/strict";
import { topeDeCuotas } from "../supabase/functions/_shared/cuotas.mjs";

test("el tope de cuotas de Mercado Pago es el mayor de las sin interés y las máximas del local", () => {
  assert.equal(topeDeCuotas({ cuotasSinInteres: 3, cuotasMaximas: 0 }), 3);
  assert.equal(topeDeCuotas({ cuotasSinInteres: 3, cuotasMaximas: 6 }), 6);
  assert.equal(topeDeCuotas({ cuotasSinInteres: 0, cuotasMaximas: 12 }), 12);
});

test("sin cuotas cargadas, o con valores que no sirven, no se pone tope (nunca se rompe el cobro)", () => {
  assert.equal(topeDeCuotas({ cuotasSinInteres: 0, cuotasMaximas: 0 }), null);
  assert.equal(topeDeCuotas({}), null);
  assert.equal(topeDeCuotas(null), null);
  assert.equal(topeDeCuotas({ cuotasSinInteres: "mucho" }), null);
  assert.equal(topeDeCuotas({ cuotasSinInteres: -2 }), null);
  assert.equal(topeDeCuotas({ cuotasMaximas: 99 }), null);
  assert.equal(topeDeCuotas({ cuotasSinInteres: "3" }), 3);
});
