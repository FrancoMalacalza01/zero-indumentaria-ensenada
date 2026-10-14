import test from "node:test";
import assert from "node:assert/strict";
import { flattenStock, needsStockMigration } from "../src/migrate.mjs";

test("stock saved per branch is summed into one number per size", () => {
  assert.deepEqual(
    flattenStock({ "La Plata": { S: 4, M: 3 }, Ensenada: { S: 8, M: 6 } }),
    { S: 12, M: 9 },
  );
});

test("a size present in only one branch survives the merge", () => {
  assert.deepEqual(
    flattenStock({ "La Plata": { S: 2 }, Ensenada: { L: 5 } }),
    { S: 2, L: 5 },
  );
});

test("stock already in the new shape is returned untouched", () => {
  assert.deepEqual(flattenStock({ S: 4, M: 3 }), { S: 4, M: 3 });
});

test("running the migration twice changes nothing the second time", () => {
  const once = flattenStock({ "La Plata": { M: 3 }, Ensenada: { M: 6 } });
  assert.deepEqual(flattenStock(once), once);
});

test("junk values become zero instead of text", () => {
  const result = flattenStock({ "La Plata": { M: "3" }, Ensenada: { M: null } });
  assert.deepEqual(result, { M: 3 });
  assert.equal(typeof result.M, "number");
});

test("missing, empty and malformed stock produce an empty object", () => {
  for (const value of [undefined, null, {}, [], "x", 7])
    assert.deepEqual(flattenStock(value), {});
});

test("a negative total is clamped to zero", () => {
  assert.deepEqual(
    flattenStock({ "La Plata": { M: -5 }, Ensenada: { M: 2 } }),
    { M: 0 },
  );
});

test("the old shape is detected and the new one is not", () => {
  assert.equal(
    needsStockMigration([{ stock: { "La Plata": { M: 1 }, Ensenada: {} } }]),
    true,
  );
  assert.equal(needsStockMigration([{ stock: { M: 1 } }]), false);
  assert.equal(needsStockMigration([]), false);
  assert.equal(needsStockMigration(undefined), false);
});
