import test from "node:test";
import assert from "node:assert/strict";
import { hastaValido, finDelDia, diaDe, vencida, precioVigente } from "../src/ofertas.mjs";

const AHORA = Date.parse("2026-11-20T12:00:00Z");

test("finDelDia: el último segundo de ese día en Argentina", () => {
  assert.equal(finDelDia("2026-11-30"), "2026-12-01T02:59:59.000Z");
  assert.equal(diaDe("2026-12-01T02:59:59.000Z"), "2026-11-30");
});

test("finDelDia: rechaza lo que no es un día real", () => {
  for (const x of ["2026-02-31", "30/11/2026", "", null, undefined, 5, "2026-13-01"]) assert.equal(finDelDia(x), null);
});

test("hastaValido: texto de fecha -> ISO; basura -> null", () => {
  assert.equal(hastaValido("2026-11-30T23:59:59-03:00"), "2026-12-01T02:59:59.000Z");
  for (const x of ["", "mañana", null, undefined, 12]) assert.equal(hastaValido(x), null);
});

test("vencida: sólo si hay fecha legible y ya pasó (el instante exacto ya vence, como en la base)", () => {
  assert.equal(vencida("2026-11-19T00:00:00Z", AHORA), true);
  assert.equal(vencida("2026-11-20T12:00:00Z", AHORA), true);
  assert.equal(vencida("2026-11-21T00:00:00Z", AHORA), false);
  assert.equal(vencida(null, AHORA), false);
  assert.equal(vencida("basura", AHORA), false);
});

test("precioVigente: oferta que sigue corriendo", () => {
  assert.deepEqual(precioVigente({ price: 80, old: 100, hasta: "2026-11-30T00:00:00Z" }, AHORA),
    { price: 80, old: 100, hasta: "2026-11-30T00:00:00.000Z" });
});

test("precioVigente: oferta vencida vuelve al precio de antes, sin tachado ni fecha", () => {
  assert.deepEqual(precioVigente({ price: 80, old: 100, hasta: "2026-11-10T00:00:00Z" }, AHORA),
    { price: 100, old: null, hasta: null });
});

test("precioVigente: sin fecha la oferta no vence", () => {
  assert.deepEqual(precioVigente({ price: 80, old: 100 }, AHORA), { price: 80, old: 100, hasta: null });
});

test("precioVigente: una fecha ilegible no vence ni rompe", () => {
  assert.deepEqual(precioVigente({ price: 80, old: 100, hasta: "xx" }, AHORA), { price: 80, old: 100, hasta: null });
});

test("precioVigente: sin precio anterior mayor no hay oferta, aunque haya fecha vencida", () => {
  assert.deepEqual(precioVigente({ price: 80, old: null, hasta: "2026-11-10T00:00:00Z" }, AHORA), { price: 80, old: null, hasta: null });
  assert.deepEqual(precioVigente({ price: 80, old: 80, hasta: "2026-11-10T00:00:00Z" }, AHORA), { price: 80, old: null, hasta: null });
  assert.deepEqual(precioVigente({ price: 80, old: 50 }, AHORA), { price: 80, old: null, hasta: null });
});

// --- Cómo viaja el vencimiento por la tienda, el servidor y los precios en masa ---
import { rowsToProducts } from "../src/catalogMap.mjs";
import { productToRow } from "../src/serverSync.mjs";
import { leerAjustes, ajusteAFila, cambiarAjuste } from "../src/menOverrides.mjs";
import { aplicarCambios, capturar, aplicarFoto } from "../src/priceTools.mjs";

const fila = (extra) => ({ id: "p", name: "Remera", category: "Hombre", type: "Remera", price: 80, old_price: 100, image: "/a.webp", color: "Azul", color_hex: "#000", sizes: ["M"], ...extra });

test("la tienda: oferta vigente conserva el vencimiento; vencida cobra y muestra el precio de antes", () => {
  const vigente = rowsToProducts([fila({ offer_until: "2026-11-30T02:59:59Z" })], [], AHORA)[0];
  assert.equal(vigente.price, 80);
  assert.equal(vigente.oldPrice, 100);
  assert.equal(vigente.offerUntil, "2026-11-30T02:59:59.000Z");
  const vencidaP = rowsToProducts([fila({ offer_until: "2026-11-10T02:59:59Z" })], [], AHORA)[0];
  assert.equal(vencidaP.price, 100);
  assert.equal("oldPrice" in vencidaP, false);
  assert.equal("offerUntil" in vencidaP, false);
});

test("la tienda: una oferta sin fecha no vence nunca", () => {
  const p = rowsToProducts([fila({})], [], AHORA)[0];
  assert.equal(p.price, 80);
  assert.equal(p.oldPrice, 100);
  assert.equal("offerUntil" in p, false);
});

test("al guardar: el vencimiento viaja con la oferta y se borra sin ella", () => {
  const base = { id: "p", name: "R", category: "Hombre", type: "R", price: 80, image: "", color: "", sizes: [], stock: {} };
  assert.equal(productToRow({ ...base, oldPrice: 100, offerUntil: "2026-11-30T02:59:59Z" }, 0).offer_until, "2026-11-30T02:59:59.000Z");
  assert.equal(productToRow({ ...base, offerUntil: "2026-11-30T02:59:59Z" }, 0).offer_until, null);
  assert.equal(productToRow({ ...base, oldPrice: 100 }, 0).offer_until, null);
});

test("hombre: las ofertas vencidas se leen como precio de antes; las vigentes guardan la fecha", () => {
  const a = leerAjustes([
    { product_id: "v", price: 80, old_price: 100, offer_until: "2026-11-30T02:59:59Z", active: true },
    { product_id: "x", price: 80, old_price: 100, offer_until: "2026-11-10T02:59:59Z", active: true },
    { product_id: "s", price: 80, old_price: 100, active: true },
  ], AHORA);
  assert.deepEqual(a.v, { price: 80, active: true, old: 100, hasta: "2026-11-30T02:59:59.000Z" });
  assert.deepEqual(a.x, { price: 100, active: true });
  assert.deepEqual(a.s, { price: 80, active: true, old: 100 });
});

test("hombre: la fila sólo lleva offer_until si hay algo que decir (compatibilidad con una base sin la columna)", () => {
  assert.equal("offer_until" in ajusteAFila("s", { price: 80, old: 100, active: true }), false);
  assert.equal(ajusteAFila("v", { price: 80, old: 100, hasta: "2026-11-30T02:59:59Z", active: true }).offer_until, "2026-11-30T02:59:59.000Z");
  assert.equal(ajusteAFila("v", { price: 80, old: 100, hasta: null, active: true }).offer_until, null);
});

test("hombre: terminar la oferta o cambiar el precio borra el vencimiento guardado", () => {
  const conFecha = { v: { price: 80, active: true, old: 100, hasta: "2026-11-30T02:59:59.000Z" } };
  const sin = cambiarAjuste(conFecha, "v", { old: null });
  assert.equal(sin.v.hasta, null);
  assert.equal("old" in sin.v, false);
  const mas = cambiarAjuste(conFecha, "v", { price: 120 });
  assert.equal(mas.v.hasta, null);
  const igual = cambiarAjuste(conFecha, "v", { price: 70 });
  assert.equal(igual.v.hasta, "2026-11-30T02:59:59.000Z");
});

test("precios en masa: una oferta nueva lleva su fecha, y sin fecha no hereda la anterior", () => {
  const prod = { id: "p", name: "R", price: 80, oldPrice: 100, offerUntil: "2026-11-30T02:59:59.000Z", active: true };
  const nueva = aplicarCambios({}, [prod], [{ fuente: "db", id: "p", precio: 70, antes: 100, hasta: "2026-12-05T02:59:59Z" }]);
  assert.equal(nueva.productos[0].offerUntil, "2026-12-05T02:59:59.000Z");
  const sinFecha = aplicarCambios({}, [prod], [{ fuente: "db", id: "p", precio: 70, antes: 100 }]);
  assert.equal("offerUntil" in sinFecha.productos[0], false);
  const termina = aplicarCambios({}, [prod], [{ fuente: "db", id: "p", precio: 100, antes: null }]);
  assert.equal("offerUntil" in termina.productos[0], false);
  const men = aplicarCambios({}, [], [{ fuente: "men", id: "m", precio: 70, antes: 100, hasta: "2026-12-05T02:59:59Z" }]);
  assert.deepEqual(men.ajustes.m, { price: 70, active: true, old: 100, hasta: "2026-12-05T02:59:59.000Z" });
  const menSin = aplicarCambios({}, [], [{ fuente: "men", id: "m", precio: 70, antes: 100 }]);
  assert.equal("hasta" in menSin.ajustes.m, false);
});

test("deshacer: la foto del producto vuelve con su vencimiento", () => {
  const prod = { id: "p", name: "R", price: 80, oldPrice: 100, offerUntil: "2026-11-30T02:59:59.000Z", active: true };
  const foto = capturar({}, [prod], [], ["p"]);
  const cambiado = aplicarCambios({}, [prod], [{ fuente: "db", id: "p", precio: 100, antes: null }]);
  assert.equal("offerUntil" in cambiado.productos[0], false);
  assert.equal(aplicarFoto({}, cambiado.productos, foto).productos[0].offerUntil, "2026-11-30T02:59:59.000Z");
});
