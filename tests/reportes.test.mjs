import test from "node:test";
import assert from "node:assert/strict";
import { reporte, diaLocal, ultimosDias } from "../src/reportes.mjs";

const HOY = new Date("2026-10-15T15:00:00.000Z");

const producto = (id, nombre, precio, stock) => ({
  id,
  name: nombre,
  category: "Hombre",
  type: "Remera",
  price: precio,
  image: "",
  color: "",
  colorHex: "#132457",
  sizes: Object.keys(stock),
  stock,
  isNew: false,
  active: true,
  description: "",
});

const venta = (id, productId, nombre, size, cuantas, fecha, pedido) => ({
  id,
  date: fecha,
  productId,
  productName: nombre,
  size,
  delta: -cuantas,
  reason: "Venta",
  orderId: pedido,
});

test("una venta de las diez de la noche es del día de hoy, no de mañana", () => {
  // 22:00 en Argentina es 01:00 UTC del día siguiente. Si se contara en UTC,
  // la venta caería en el día equivocado y el reporte diario sería inútil
  // para un local que cierra a la noche.
  assert.equal(diaLocal("2026-10-16T01:00:00.000Z"), "2026-10-15");
  assert.equal(diaLocal("2026-10-15T14:00:00.000Z"), "2026-10-15");
  assert.equal(diaLocal("2026-10-15T02:30:00.000Z"), "2026-10-14");
});

test("una fecha ilegible no rompe el reporte", () => {
  assert.equal(diaLocal("cualquier cosa"), "");
  assert.equal(diaLocal(undefined), "");
});

test("el período son los días pedidos, incluido hoy y sin huecos", () => {
  const dias = ultimosDias(3, HOY);
  assert.deepEqual(dias, ["2026-10-13", "2026-10-14", "2026-10-15"]);
});

test("suma unidades y separa el mostrador de la web", () => {
  const productos = [producto("1", "Remera", 30000, { M: 4 })];
  const movs = [
    venta("a", "1", "Remera", "M", 2, "2026-10-15T13:00:00.000Z", "V-1"),
    venta("b", "1", "Remera", "M", 1, "2026-10-14T13:00:00.000Z", "M-00001"),
  ];
  const pedidos = [
    { id: "M-00001", date: "2026-10-14T13:00:00.000Z", items: [], total: 30000, status: "Completado", customer: "J", delivery: "pickup" },
  ];
  const r = reporte(productos, movs, pedidos, 7, HOY);
  assert.equal(r.unidades, 3);
  assert.equal(r.devueltas, 0);
  assert.equal(r.unidadesMostrador, 2);
  assert.equal(r.unidadesWeb, 1);
  assert.equal(r.pedidos, 1);
  assert.equal(r.facturado, 30000);
});

test("la facturación no cuenta los pedidos cancelados ni devueltos", () => {
  const pedidos = [
    { id: "M-1", date: "2026-10-15T13:00:00.000Z", items: [], total: 10000, status: "Completado", customer: "", delivery: "pickup" },
    { id: "M-2", date: "2026-10-15T13:00:00.000Z", items: [], total: 90000, status: "Cancelado", customer: "", delivery: "pickup" },
    { id: "M-3", date: "2026-10-15T13:00:00.000Z", items: [], total: 70000, status: "Devuelto", customer: "", delivery: "pickup" },
  ];
  const r = reporte([], [], pedidos, 7, HOY);
  assert.equal(r.facturado, 10000);
  assert.equal(r.pedidos, 1);
});

test("separa lo facturado de lo efectivamente cobrado", () => {
  const pedidos = [
    { id: "M-1", date: "2026-10-15T13:00:00.000Z", items: [], total: 10000, status: "Pendiente", customer: "", delivery: "pickup", paymentStatus: "aprobado" },
    { id: "M-2", date: "2026-10-15T13:00:00.000Z", items: [], total: 40000, status: "Pendiente", customer: "", delivery: "pickup", paymentStatus: "sin_pago" },
  ];
  const r = reporte([], [], pedidos, 7, HOY);
  assert.equal(r.facturado, 50000);
  assert.equal(r.cobrado, 10000);
  assert.equal(r.pagados, 1);
});

test("el ticket promedio es la facturación sobre los pedidos, y sin pedidos es cero", () => {
  const pedidos = [
    { id: "M-1", date: "2026-10-15T13:00:00.000Z", items: [], total: 10000, status: "Completado", customer: "", delivery: "pickup" },
    { id: "M-2", date: "2026-10-15T13:00:00.000Z", items: [], total: 15000, status: "Completado", customer: "", delivery: "pickup" },
  ];
  assert.equal(reporte([], [], pedidos, 7, HOY).ticket, 12500);
  assert.equal(reporte([], [], [], 7, HOY).ticket, 0);
});

test("lo de antes del período no entra", () => {
  const movs = [
    venta("viejo", "1", "Remera", "M", 9, "2026-09-01T13:00:00.000Z", "V-0"),
    venta("nuevo", "1", "Remera", "M", 1, "2026-10-15T13:00:00.000Z", "V-1"),
  ];
  const r = reporte([producto("1", "Remera", 1000, { M: 1 })], movs, [], 7, HOY);
  assert.equal(r.unidades, 1);
});

test("un ingreso no es una venta, y lo que volvió no se vendió", () => {
  const movs = [
    { id: "i", date: "2026-10-15T13:00:00.000Z", productId: "1", productName: "R", size: "M", delta: 20, reason: "Ingreso" },
    { id: "d", date: "2026-10-15T13:00:00.000Z", productId: "1", productName: "R", size: "M", delta: 2, reason: "Devolución" },
    venta("v", "1", "R", "M", 3, "2026-10-15T13:00:00.000Z", "V-1"),
  ];
  const r = reporte([producto("1", "R", 1000, { M: 5 })], movs, [], 7, HOY);
  // Tres salieron, dos volvieron: se vendió una.
  assert.equal(r.vendidasBrutas, 3);
  assert.equal(r.devueltas, 2);
  assert.equal(r.unidades, 1);
});

test("un pedido que se cancela deja de contar como venta", () => {
  // Cancelar deja un movimiento de Devolución, igual que una devolución de
  // mostrador: en los dos casos esa venta no existió.
  const movs = [
    venta("v", "1", "R", "M", 1, "2026-10-15T13:00:00.000Z", "M-00001"),
    { id: "c", date: "2026-10-15T14:00:00.000Z", productId: "1", productName: "R", size: "M", delta: 1, reason: "Devolución", orderId: "M-00001" },
  ];
  const r = reporte([producto("1", "R", 1000, { M: 5 })], movs, [], 7, HOY);
  assert.equal(r.unidades, 0);
  assert.equal(r.masVendidos.length, 0);
});

test("el ranking también descuenta lo que volvió", () => {
  const movs = [
    venta("a", "1", "R", "M", 5, "2026-10-15T13:00:00.000Z", "V-1"),
    { id: "b", date: "2026-10-15T14:00:00.000Z", productId: "1", productName: "R", size: "M", delta: 2, reason: "Devolución", orderId: "V-1" },
  ];
  const r = reporte([producto("1", "R", 1000, { M: 5 })], movs, [], 7, HOY);
  assert.deepEqual(r.masVendidos.map((x) => [x.unidades, x.valorHoy]), [[3, 3000]]);
});

test("el ranking ordena por unidades y valoriza al precio de hoy", () => {
  const productos = [
    producto("1", "Remera", 30000, { M: 2 }),
    producto("2", "Buzo", 80000, { L: 9 }),
  ];
  const movs = [
    venta("a", "2", "Buzo", "L", 1, "2026-10-15T13:00:00.000Z", "V-1"),
    venta("b", "1", "Remera", "M", 5, "2026-10-15T13:00:00.000Z", "V-1"),
  ];
  const r = reporte(productos, movs, [], 7, HOY);
  assert.deepEqual(
    r.masVendidos.map((x) => [x.nombre, x.unidades, x.valorHoy, x.stockHoy]),
    [
      ["Remera", 5, 150000, 2],
      ["Buzo", 1, 80000, 9],
    ],
  );
});

test("un producto borrado sigue apareciendo con el nombre que guardó el movimiento", () => {
  const movs = [venta("a", "fantasma", "Campera vieja", "M", 2, "2026-10-15T13:00:00.000Z", "V-1")];
  const r = reporte([], movs, [], 7, HOY);
  assert.equal(r.masVendidos[0].nombre, "Campera vieja");
  assert.equal(r.masVendidos[0].valorHoy, 0);
});

test("avisa qué conviene reponer: se vendió y queda poco", () => {
  const productos = [
    producto("1", "Se agota", 1000, { M: 2 }),
    producto("2", "Sobra", 1000, { M: 50 }),
  ];
  const movs = [
    venta("a", "1", "Se agota", "M", 8, "2026-10-15T13:00:00.000Z", "V-1"),
    venta("b", "2", "Sobra", "M", 8, "2026-10-15T13:00:00.000Z", "V-1"),
  ];
  const r = reporte(productos, movs, [], 7, HOY);
  assert.deepEqual(r.porReponer.map((x) => x.nombre), ["Se agota"]);
});

test("un producto que se vendió y volvió no está dormido: se movió", () => {
  const productos = [producto("1", "Fue y vino", 1000, { M: 3 })];
  const movs = [
    venta("a", "1", "Fue y vino", "M", 1, "2026-10-15T13:00:00.000Z", "V-1"),
    { id: "b", date: "2026-10-15T14:00:00.000Z", productId: "1", productName: "Fue y vino", size: "M", delta: 1, reason: "Devolución", orderId: "V-1" },
  ];
  const r = reporte(productos, movs, [], 7, HOY);
  assert.deepEqual(r.quietos, []);
});

test("la plata quieta son los publicados con stock que no vendieron nada", () => {
  const productos = [
    producto("1", "Vendió", 1000, { M: 1 }),
    producto("2", "No vendió", 50000, { M: 3 }),
    { ...producto("3", "Despublicado", 90000, { M: 4 }), active: false },
    producto("4", "Sin stock", 10000, { M: 0 }),
  ];
  const movs = [venta("a", "1", "Vendió", "M", 1, "2026-10-15T13:00:00.000Z", "V-1")];
  const r = reporte(productos, movs, [], 7, HOY);
  assert.deepEqual(r.quietos.map((x) => [x.nombre, x.stock, x.valor]), [
    ["No vendió", 3, 150000],
  ]);
});

test("el valor del inventario cuenta sólo lo publicado", () => {
  const productos = [
    producto("1", "Publicado", 1000, { M: 2, L: 3 }),
    { ...producto("2", "Oculto", 99999, { M: 10 }), active: false },
  ];
  assert.equal(reporte(productos, [], [], 7, HOY).valorInventario, 5000);
});

test("el gráfico diario tiene un valor por día, también los días sin ventas", () => {
  const movs = [venta("a", "1", "R", "M", 4, "2026-10-15T13:00:00.000Z", "V-1")];
  const r = reporte([producto("1", "R", 1000, { M: 1 })], movs, [], 3, HOY);
  assert.deepEqual(r.porDia, [
    { dia: "2026-10-13", unidades: 0 },
    { dia: "2026-10-14", unidades: 0 },
    { dia: "2026-10-15", unidades: 4 },
  ]);
});

test("sin datos no explota: devuelve todo en cero", () => {
  for (const vacio of [undefined, null, "no es una lista"]) {
    const r = reporte(vacio, vacio, vacio, 7, HOY);
    assert.equal(r.unidades, 0);
    assert.equal(r.facturado, 0);
    assert.equal(r.masVendidos.length, 0);
    assert.equal(r.porDia.length, 7);
  }
});
