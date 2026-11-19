import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const archivo = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
const cabecerasVercel = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));

/** Las cabeceras de la regla `/*` de public/_headers, por nombre. */
function cabecerasDelArchivo() {
  const bloque = archivo.split(/\n(?=\S)/).find((b) => b.trim().startsWith("/*"));
  const salida = {};
  for (const l of bloque.split("\n").slice(1)) {
    const m = /^\s+([\w-]+):\s*(.+)$/.exec(l);
    if (m) salida[m[1]] = m[2].trim();
  }
  return salida;
}

test("public/_headers (Cloudflare Pages) dice lo mismo que vercel.json", () => {
  assert.deepEqual(cabecerasDelArchivo(), cabecerasVercel);
});

test("la CSP deja hablar con Supabase y con Payway, y no se abre de más", () => {
  const csp = cabecerasVercel["Content-Security-Policy"];
  const connect = /connect-src ([^;]+);/.exec(csp)[1].split(" ");
  assert.deepEqual(connect, ["'self'", "https://*.supabase.co", "https://*.payway.com.ar"]);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test("no hay un 404.html: sin él, Cloudflare Pages manda las rutas del sitio a index.html", () => {
  assert.equal(existsSync(new URL("../public/404.html", import.meta.url)), false);
});

test("los assets con hash se guardan en la caché del navegador", () => {
  assert.match(archivo, /\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
});
