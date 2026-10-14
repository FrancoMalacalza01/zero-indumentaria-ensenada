import test from "node:test";
import assert from "node:assert/strict";
import { prepareOrder } from "../src/commerce.mjs";

const orderDate = "2026-09-26T16:00:00.000Z";
const makeProducts = () => [
  {
    id: "shirt",
    name: "Remera Classic",
    price: 32000,
    image: "/shirt.webp",
    active: true,
    sizes: ["S", "M"],
    stock: { S: 4, M: 3 },
  },
  {
    id: "hoodie",
    name: "Buzo Essential",
    price: 65000,
    image: "/hoodie.webp",
    active: true,
    sizes: ["S", "L"],
    stock: { S: 7, L: 2 },
  },
];
const line = (overrides = {}) => ({
  productId: "shirt",
  size: "M",
  quantity: 1,
  ...overrides,
});
function freezeDeep(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function place(products, cart) {
  return prepareOrder(
    products,
    cart,
    "pickup",
    "  Cliente de prueba  ",
    "M-TEST",
    orderDate,
  );
}
function expectRejectedWithoutMutation(products, cart) {
  const originalProducts = structuredClone(products);
  const originalCart = structuredClone(cart);
  freezeDeep(products);
  freezeDeep(cart);
  const result = place(products, cart);
  assert.equal(typeof result.error, "string");
  assert.ok(result.error.length > 0);
  assert.equal(result.order, undefined);
  assert.equal(result.products, undefined);
  assert.deepEqual(
    products,
    originalProducts,
    "rejected orders must leave every stock value unchanged",
  );
  assert.deepEqual(
    cart,
    originalCart,
    "rejected orders must not edit cart contents",
  );
}

test("a valid order consumes only the selected sizes, preserving input data", () => {
  const products = makeProducts();
  const cart = [
    line({ quantity: 2 }),
    line({ productId: "hoodie", size: "L" }),
  ];
  const originalProducts = structuredClone(products);
  const originalCart = structuredClone(cart);
  freezeDeep(products);
  freezeDeep(cart);

  const result = place(products, cart);
  assert.equal(result.error, undefined);
  assert.deepEqual(
    result.products.map((p) => p.stock),
    [
      { S: 4, M: 1 },
      { S: 7, L: 1 },
    ],
  );
  assert.deepEqual(products, originalProducts);
  assert.deepEqual(cart, originalCart);
  assert.equal(result.order.total, 129000);
  assert.equal(result.order.id, "M-TEST");
  assert.equal(result.order.date, orderDate);
  assert.equal(result.order.customer, "Cliente de prueba");
  assert.equal(result.order.delivery, "pickup");
  assert.equal(result.order.status, "Pendiente");
  assert.deepEqual(
    result.order.items.map(({ name, price, quantity }) => ({
      name,
      price,
      quantity,
    })),
    [
      { name: "Remera Classic", price: 32000, quantity: 2 },
      { name: "Buzo Essential", price: 65000, quantity: 1 },
    ],
  );
});

test("buying one size leaves the other sizes and products untouched", () => {
  const products = makeProducts();
  const result = place(products, [line({ quantity: 3 })]);
  assert.equal(result.error, undefined);
  assert.equal(result.products[0].stock.M, 0);
  assert.equal(result.products[0].stock.S, 4);
  assert.deepEqual(result.products[1], products[1]);
});

test("duplicate cart rows combine quantities before allowing a purchase", () => {
  expectRejectedWithoutMutation(makeProducts(), [
    line({ quantity: 2 }),
    line({ quantity: 2 }),
  ]);
});

test("duplicate rows at exactly the available quantity decrement stock once for their combined total", () => {
  const result = place(makeProducts(), [
    line({ quantity: 1 }),
    line({ quantity: 2 }),
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.products[0].stock.M, 0);
  assert.equal(result.products[0].stock.S, 4);
  assert.equal(
    result.order.items.reduce((sum, item) => sum + item.quantity, 0),
    3,
  );
  assert.equal(result.order.total, 96000);
});

test("a stale inactive product rejects the entire order without consuming other valid items", () => {
  const products = makeProducts();
  products[1].active = false;
  expectRejectedWithoutMutation(products, [
    line(),
    line({ productId: "hoodie", size: "L" }),
  ]);
});

test("a removed product rejects the order without consuming valid items", () => {
  expectRejectedWithoutMutation(makeProducts(), [
    line(),
    line({ productId: "removed" }),
  ]);
});

test("a stale size with no stock rejects the entire order", () => {
  expectRejectedWithoutMutation(makeProducts(), [line({ size: "XL" })]);
});

test("an empty cart does not produce an order or change stock", () => {
  expectRejectedWithoutMutation(makeProducts(), []);
});

test("zero, negative, fractional, missing, string and non-finite quantities are rejected without mutation", async (t) => {
  for (const quantity of [
    0,
    -1,
    1.5,
    undefined,
    "2",
    NaN,
    Infinity,
    -Infinity,
  ]) {
    await t.test(`quantity ${String(quantity)} (${typeof quantity})`, () => {
      expectRejectedWithoutMutation(makeProducts(), [line({ quantity })]);
    });
  }
});

test("an invalid quantity after a valid item does not partially consume its stock", () => {
  expectRejectedWithoutMutation(makeProducts(), [
    line(),
    line({ productId: "hoodie", size: "L", quantity: 0 }),
  ]);
});

test("a stock change after adding to cart is enforced when the order is prepared", () => {
  const products = makeProducts();
  products[0].stock.M = 1;
  expectRejectedWithoutMutation(products, [line({ quantity: 2 })]);
});
