import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src", "men-catalog.json");
const cachePath = path.join(root, "research", "cache");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

function clean(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFacets(html, brand) {
  const colors = new Set();
  const sizes = new Set();
  const brooksfieldMarker = '<div class="product-variants js-product-variants">';
  let variants;
  if (brand === "Mistral") {
    const formIndex = html.indexOf('<form id="product_form"');
    const form = formIndex < 0 ? "" : html.slice(formIndex);
    const marker = form.match(/<div\b[^>]*class=["'][^"']*js-product-variants\b[^"']*form-row[^"']*["'][^>]*>/i);
    variants = marker ? form.slice(marker.index + marker[0].length) : "";
  } else {
    const markerIndex = html.indexOf(brooksfieldMarker);
    variants = markerIndex < 0 ? "" : html.slice(markerIndex + brooksfieldMarker.length);
  }
  if (!variants) return { colors: [], sizes: [] };
  const groups = brand === "Mistral"
    ? [...variants.matchAll(/<div\b[^>]*class=["'][^"']*js-product-variants-group[^"']*["'][^>]*>[\s\S]*?<\/select>/gi)].map((match) => match[0])
    : [...variants.matchAll(/<div\b[^>]*class=["'][^"']*product-variants-item[^"']*["'][^>]*>[\s\S]*?<\/ul>/gi)].map((match) => match[0]);

  for (const group of groups) {
    const label = clean(group.match(/<(?:label|span)\b[^>]*class=["'][^"']*(?:form-label|form-control-label)[^"']*["'][^>]*>([\s\S]*?)<\/(?:label|span)>/i)?.[1] || "").toLocaleLowerCase("es-AR");
    const target = label.includes("color") ? colors : label.includes("talle") || label.includes("tamaño") ? sizes : null;
    if (!target) continue;
    if (brand === "Mistral") {
      for (const option of group.matchAll(/<option\b[^>]*value=["']([^"']+)["'][^>]*>/gi)) {
        const value = clean(option[1]);
        if (value) target.add(value);
      }
    } else {
      const titleValues = [...group.matchAll(/\btitle=["']([^"']+)["']/gi)].map((match) => clean(match[1]));
      for (const value of titleValues) if (value) target.add(value);
    }
  }
  return { colors: [...colors], sizes: [...sizes] };
}

let parsed = 0;
let missing = 0;
for (const product of catalog.products) {
  const prefix = product.brand === "Mistral" ? "m-product-" : "b-product-";
  const htmlPath = path.join(cachePath, `${prefix}${product.id}.html`);
  try {
    const html = await readFile(htmlPath, "utf8");
    Object.assign(product, extractFacets(html, product.brand));
    parsed += 1;
  } catch {
    product.colors = [];
    product.sizes = [];
    missing += 1;
  }
}

await writeFile(catalogPath, `${JSON.stringify(catalog)}\n`, "utf8");
const sizes = new Set(catalog.products.flatMap((product) => product.sizes));
const colors = new Set(catalog.products.flatMap((product) => product.colors));
console.log(`Parsed ${parsed} products; ${missing} pages missing; ${sizes.size} sizes; ${colors.size} colors.`);
