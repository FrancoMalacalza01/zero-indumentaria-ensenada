import test from "node:test";
import assert from "node:assert/strict";
import { promosDePrecio, textoEnvioGratis } from "../src/promos.mjs";

const pago = { credito: true, cuotasSinInteres: 3, descuentoContado: 15, efectivo: true, banco: { alias: "zero.mp", cbu: "" } };

test("cuotas sin interés: el precio dividido en partes, con centavos", () => {
  const p = promosDePrecio(pago, 62900);
  assert.deepEqual(p.cuotas, { cantidad: 3, monto: 20966.67 });
});

test("descuento por pagar con transferencia o efectivo", () => {
  const p = promosDePrecio(pago, 62900);
  assert.deepEqual(p.contado, { porcentaje: 15, monto: 53465, medios: "Transferencia o efectivo" });
});

test("sin nada configurado no hay promos: no se inventan", () => {
  const vacio = { credito: true, cuotasSinInteres: 0, descuentoContado: 0, efectivo: true, banco: { alias: "", cbu: "" } };
  assert.deepEqual(promosDePrecio(vacio, 10000), { cuotas: null, contado: null });
  assert.deepEqual(promosDePrecio(undefined, 10000), { cuotas: null, contado: null });
});

test("las cuotas necesitan tarjeta de crédito, y una sola cuota no es promo", () => {
  assert.equal(promosDePrecio({ ...pago, credito: false }, 10000).cuotas, null);
  assert.equal(promosDePrecio({ ...pago, cuotasSinInteres: 1 }, 10000).cuotas, null);
});

test("el descuento necesita algún medio de pago que lo admita", () => {
  const sinMedios = { ...pago, efectivo: false, banco: { alias: "", cbu: "" } };
  assert.equal(promosDePrecio(sinMedios, 10000).contado, null);
  assert.equal(promosDePrecio({ ...pago, banco: { alias: "", cbu: "" } }, 10000).contado.medios, "efectivo");
});

test("precios inválidos no dan promos", () => {
  for (const x of [0, -5, NaN, undefined]) assert.deepEqual(promosDePrecio(pago, x), { cuotas: null, contado: null });
});

test("el envío gratis sale de la configuración", () => {
  const f = (n) => `$${n}`;
  assert.equal(textoEnvioGratis({ envioGratisDesde: 100000 }, f), "Envío gratis en compras de $100000 o más");
  assert.equal(textoEnvioGratis({ envioGratisDesde: 0 }, f), null);
  assert.equal(textoEnvioGratis(undefined, f), null);
});
