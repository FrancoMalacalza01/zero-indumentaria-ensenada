import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(root, "src/men-catalog.json"), "utf8"));

test("el relevamiento de hombre incluye ambas marcas y secciones", () => {
  const counts = Object.groupBy(catalog.products, (product) => product.brand);
  assert.ok(counts.Mistral?.length >= 200);
  assert.ok(counts.Brooksfield?.length >= 700);
  assert.ok(new Set(counts.Mistral.map((product) => product.category)).size >= 9);
  assert.ok(new Set(counts.Brooksfield.map((product) => product.category)).size >= 12);
  assert.equal(new Set(catalog.products.map((product) => product.id)).size, catalog.products.length);
});

test("cada ficha conserva precio, origen y todas las fotos locales", () => {
  for (const product of catalog.products) {
    const domain = product.brand === "Mistral" ? "www.mistral.com.ar" : "www.brooksfieldstore.com";
    assert.ok(product.name && product.category && product.priceARS > 0, product.id);
    assert.equal(new URL(product.url).hostname, domain, product.id);
    assert.ok(product.images.length > 0, product.id);
    assert.equal(product.images.length, product.sourceImages.length, product.id);
    assert.equal(new Set(product.images).size, product.images.length, product.id);
    for (const [index, photo] of product.images.entries()) {
      assert.ok(photo.startsWith("/men-gallery/"), `${product.id} foto ${index}`);
      assert.ok(existsSync(path.join(root, "public", photo.slice(1))), `${product.id} foto ${index}`);
      assert.equal(new URL(product.sourceImages[index]).protocol, "https:", product.id);
    }
    assert.ok(product.cover?.startsWith("/men-images/"), product.id);
    assert.ok(existsSync(path.join(root, "public", product.cover.slice(1))), product.id);
  }
});
