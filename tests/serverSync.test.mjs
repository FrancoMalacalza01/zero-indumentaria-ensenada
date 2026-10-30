import test from "node:test";
import assert from "node:assert/strict";
import {
  productToRow,
  stockRows,
  sizesFilter,
  movementToRow,
  rowToMovement,
  orderToRow,
  rowToOrder,
} from "../src/serverSync.mjs";
import { rowsToProducts } from "../src/catalogMap.mjs";

const producto = (extra = {}) => ({
  id: "p1",
  name: "Remera Blank MC",
  category: "Hombre",
  type: "Remera",
  price: 35900,
  image: "/images/product-1.webp",
  color: "Verde claro",
  colorHex: "#b8c1a9",
  sizes: ["M", "L"],
  stock: { M: 3, L: 0 },
  isNew: true,
  active: true,
  description: "Un esencial.",
  ...extra,
});

test("un producto va y vuelve del servidor igual que salió", () => {
  const original = producto({ oldPrice: 41900, images: ["/a.webp", "/b.webp"] });
  const fila = productToRow(original, 0);
  const [vuelta] = rowsToProducts([fila], stockRows(original));
  assert.deepEqual(vuelta, original);
});

test("sin precio viejo manda null, para que el servidor lo borre", () => {
  assert.equal(productToRow(producto()).old_price, null);
  assert.equal(productToRow(producto({ oldPrice: 40000 })).old_price, 40000);
});

test("un producto sin id no se manda a medias: tira error", () => {
  assert.throws(() => productToRow({ name: "x" }), /no tiene id/);
  assert.throws(() => productToRow(null), /no tiene id/);
});

test("una categoría inventada cae en una válida en vez de romper la base", () => {
  assert.equal(productToRow(producto({ category: "Mascotas" })).category, "Hombre");
});

test("el tipo en blanco se completa: la base no acepta vacío", () => {
  assert.equal(productToRow(producto({ type: "  " })).type, "Prenda");
});

test("un precio negativo o basura se guarda en cero, nunca negativo", () => {
  assert.equal(productToRow(producto({ price: -500 })).price, 0);
  assert.equal(productToRow(producto({ price: "ochomil" })).price, 0);
});

test("el orden de la lista es lo que se guarda en position", () => {
  assert.equal(productToRow(producto(), 7).position, 7);
});

test("hay una fila de stock por talle, y el talle sin cargar va en cero", () => {
  assert.deepEqual(stockRows(producto({ stock: { M: 3 } })), [
    { product_id: "p1", size: "M", qty: 3 },
    { product_id: "p1", size: "L", qty: 0 },
  ]);
});

test("el stock no se guarda negativo", () => {
  assert.deepEqual(stockRows(producto({ sizes: ["M"], stock: { M: -4 } })), [
    { product_id: "p1", size: "M", qty: 0 },
  ]);
});

test("un talle que no está en sizes no se guarda, aunque tenga stock", () => {
  const filas = stockRows(producto({ sizes: ["M"], stock: { M: 1, XXL: 9 } }));
  assert.deepEqual(filas.map((f) => f.size), ["M"]);
});

test("el filtro de talles entrecomilla, así una coma no lo parte en dos", () => {
  assert.equal(sizesFilter(producto({ sizes: ["M", "L"] })), '("M","L")');
  assert.equal(sizesFilter(producto({ sizes: ['3,5'] })), '("3,5")');
  assert.equal(sizesFilter(producto({ sizes: ['un"raro'] })), '("un""raro")');
});

test("un producto sin talles no tiene filtro: hay que borrarle todo el stock", () => {
  assert.equal(sizesFilter(producto({ sizes: [] })), null);
});

test("un movimiento va y vuelve igual", () => {
  const mov = {
    id: "m1",
    date: "2026-10-14T12:00:00.000Z",
    productId: "p1",
    productName: "Remera Blank MC",
    size: "M",
    delta: -2,
    reason: "Venta",
    orderId: "V-1",
  };
  assert.deepEqual(rowToMovement(movementToRow(mov)), mov);
});

test("un movimiento sin pedido no inventa orderId al volver", () => {
  const mov = movementToRow({
    id: "m2",
    date: "2026-10-14T12:00:00.000Z",
    productId: "p1",
    productName: "x",
    size: "M",
    delta: 5,
    reason: "Ingreso",
  });
  assert.equal(mov.order_id, null);
  assert.equal("orderId" in rowToMovement(mov), false);
});

test("un motivo que la base no acepta se corta acá y no en producción", () => {
  assert.throws(
    () => movementToRow({ id: "m3", reason: "Regalo", productId: "p1", size: "M", delta: 1 }),
    /Motivo desconocido/,
  );
});

test("un movimiento sin id tira error en vez de perderse", () => {
  assert.throws(() => movementToRow({ reason: "Venta" }), /no tiene id/);
});

test("un pedido va y vuelve igual", () => {
  const pedido = {
    id: "A-1",
    date: "2026-10-14T12:00:00.000Z",
    items: [
      { productId: "p1", size: "M", quantity: 2, name: "Remera", price: 35900, image: "/a.webp" },
    ],
    total: 71800,
    delivery: "shipping",
    status: "Preparando",
    customer: "Juana",
    payment: "mercadopago",
    zone: "Ensenada",
  };
  assert.deepEqual(rowToOrder(orderToRow(pedido)), pedido);
});

test("un pedido para retirar no guarda zona ni la inventa al volver", () => {
  const fila = orderToRow({
    id: "A-2",
    date: "2026-10-14T12:00:00.000Z",
    items: [],
    total: 0,
    delivery: "pickup",
    status: "Pendiente",
    customer: "Juana",
  });
  assert.equal(fila.zone, null);
  assert.equal(fila.payment, null);
  const vuelta = rowToOrder(fila);
  assert.equal("zone" in vuelta, false);
  assert.equal("payment" in vuelta, false);
});

test("una entrega o un estado raro caen en el valor que la base acepta", () => {
  const fila = orderToRow({ id: "A-3", delivery: "drone", status: "Perdido", items: [], total: 0, customer: "" });
  assert.equal(fila.delivery, "pickup");
  assert.equal(fila.status, "Pendiente");
});

test("una fila de pedido rota no voltea el panel", () => {
  const vuelta = rowToOrder({ id: "A-4", items: "no es una lista", total: null });
  assert.deepEqual(vuelta.items, []);
  assert.equal(vuelta.total, 0);
});

test("un pedido con envío y pago aprobado va y vuelve igual", () => {
  const pedido = {
    id: "M-00009",
    date: "2026-10-15T12:00:00.000Z",
    items: [
      { productId: "p1", size: "M", quantity: 1, name: "Buzo", price: 80000, image: "/a.webp" },
    ],
    total: 88000,
    envio: 8000,
    delivery: "shipping",
    status: "Preparando",
    customer: "Juana",
    payment: "mercadopago",
    zone: "Resto de la Provincia de Buenos Aires",
    paymentStatus: "aprobado",
  };
  assert.deepEqual(rowToOrder(orderToRow(pedido)), pedido);
});

test("el panel no puede pisar un pago aprobado al guardar un pedido", () => {
  // Un pedido sin estado de pago (por ejemplo uno viejo de la demo) no manda
  // la columna: así el upsert del panel deja el pago como lo dejó el servidor.
  const fila = orderToRow({
    id: "M-00010",
    date: "2026-10-15T12:00:00.000Z",
    items: [],
    total: 0,
    delivery: "pickup",
    status: "Completado",
    customer: "Juana",
  });
  assert.equal("payment_status" in fila, false);
  // Y uno con un estado inventado tampoco.
  const falso = orderToRow({
    id: "M-00011",
    date: "2026-10-15T12:00:00.000Z",
    items: [],
    total: 0,
    delivery: "pickup",
    status: "Completado",
    customer: "Juana",
    paymentStatus: "regalado",
  });
  assert.equal("payment_status" in falso, false);
});

test("los estados nuevos del pedido no se caen a Pendiente", () => {
  for (const status of ["Devuelto", "Cancelado"]) {
    const fila = orderToRow({
      id: "M-x",
      date: "2026-10-15T12:00:00.000Z",
      items: [],
      total: 0,
      delivery: "pickup",
      status,
      customer: "J",
    });
    assert.equal(fila.status, status);
  }
});

test("marca e identificador de origen se guardan y se leen", () => {
  const original = producto({ brand: "Mistral", sourceCatalogId: "m-123" });
  const fila = productToRow(original);
  assert.equal(fila.brand, "Mistral");
  assert.equal(fila.source_catalog_id, "m-123");
  assert.deepEqual(rowsToProducts([fila], stockRows(original))[0], original);
});
