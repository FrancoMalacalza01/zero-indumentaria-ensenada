import test from "node:test";
import assert from "node:assert/strict";
import { rowsToProducts } from "../src/catalogMap.mjs";

const fila = (extra = {}) => ({
  id: "1",
  name: "Remera Blank MC",
  category: "Hombre",
  type: "Remera",
  price: 35900,
  old_price: null,
  image: "/images/product-1.webp",
  images: [],
  color: "Verde claro",
  color_hex: "#b8c1a9",
  sizes: ["M", "L"],
  is_new: true,
  active: true,
  description: "Un esencial.",
  ...extra,
});

test("a product and its stock rows become one product with stock per size", () => {
  const [p] = rowsToProducts(
    [fila()],
    [
      { product_id: "1", size: "M", qty: 3 },
      { product_id: "1", size: "L", qty: 0 },
    ],
  );
  assert.deepEqual(p.stock, { M: 3, L: 0 });
  assert.equal(p.price, 35900);
  assert.equal(p.colorHex, "#b8c1a9");
  assert.equal(p.isNew, true);
  assert.equal(p.oldPrice, undefined);
});

test("a size with no stock row counts as zero, not as missing", () => {
  const [p] = rowsToProducts([fila()], [{ product_id: "1", size: "M", qty: 4 }]);
  assert.deepEqual(p.stock, { M: 4, L: 0 });
});

test("stock rows for a size the product no longer sells are ignored", () => {
  const [p] = rowsToProducts(
    [fila()],
    [
      { product_id: "1", size: "M", qty: 2 },
      { product_id: "1", size: "XXL", qty: 9 },
    ],
  );
  assert.deepEqual(Object.keys(p.stock), ["M", "L"]);
});

test("stock belonging to another product does not leak in", () => {
  const [p] = rowsToProducts(
    [fila()],
    [
      { product_id: "2", size: "M", qty: 99 },
      { product_id: "1", size: "M", qty: 1 },
    ],
  );
  assert.deepEqual(p.stock, { M: 1, L: 0 });
});

test("old_price only appears when the row actually carries one", () => {
  const [con] = rowsToProducts([fila({ old_price: 49900 })], []);
  assert.equal(con.oldPrice, 49900);
  const [sin] = rowsToProducts([fila({ old_price: 0 })], []);
  assert.equal(sin.oldPrice, undefined);
});

test("rows with no id, no name or no sizes are dropped instead of half-built", () => {
  const out = rowsToProducts(
    [
      fila({ id: "" }),
      fila({ id: "x", name: "" }),
      fila({ id: "y", sizes: [] }),
      fila({ id: "ok" }),
    ],
    [],
  );
  assert.deepEqual(out.map((p) => p.id), ["ok"]);
});

test("negative, fractional and junk quantities become whole non-negative numbers", () => {
  const [p] = rowsToProducts(
    [fila({ sizes: ["M", "L"] })],
    [
      { product_id: "1", size: "M", qty: -5 },
      { product_id: "1", size: "L", qty: "3.7" },
    ],
  );
  assert.deepEqual(p.stock, { M: 0, L: 3 });
});

test("an unknown category falls back instead of breaking the filters", () => {
  const [p] = rowsToProducts([fila({ category: "Calzado" })], []);
  assert.equal(p.category, "Hombre");
});

test("nothing, null or junk input returns an empty list", () => {
  for (const value of [undefined, null, {}, "x", 7])
    assert.deepEqual(rowsToProducts(value, value), []);
  assert.deepEqual(rowsToProducts([], []), []);
});

test("order is kept as the server sent it", () => {
  const out = rowsToProducts(
    [fila({ id: "3" }), fila({ id: "1" }), fila({ id: "2" })],
    [],
  );
  assert.deepEqual(out.map((p) => p.id), ["3", "1", "2"]);
});
