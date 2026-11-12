import test from "node:test";
import assert from "node:assert/strict";
import { rangosDeCodigosPostales, codigoPostalDe, hayCodigosPostales, zonaPorCodigoPostal, leerSettings } from "../src/settingsMap.mjs";

test("el código postal se lee como lo escribe la gente", () => {
  assert.equal(codigoPostalDe("1925"), 1925);
  assert.equal(codigoPostalDe(" B1925 "), 1925);
  assert.equal(codigoPostalDe("B1925ABC"), 1925);
  for (const x of ["", "19", "19255", "abcd", null, undefined, "1925 1926"]) assert.equal(codigoPostalDe(x), null);
});

test("la lista de códigos de una zona: sueltos y rangos, lo ilegible se ignora", () => {
  assert.deepEqual(rangosDeCodigosPostales("1923, 1925; 1900-1909 B1931 xx 19"), [[1923, 1923], [1925, 1925], [1900, 1909], [1931, 1931]]);
  assert.deepEqual(rangosDeCodigosPostales("1909-1900"), []);
  assert.deepEqual(rangosDeCodigosPostales(undefined), []);
});

const zonas = [
  { nombre: "Ensenada", cp: "1925" },
  { nombre: "Berisso", cp: "1923" },
  { nombre: "La Plata", cp: "1900-1905, 1896, 1897" },
  { nombre: "Resto", cp: "1600-1999" },
  { nombre: "Sin códigos" },
];

test("cada código cae en su zona, y gana la primera si dos lo cubren", () => {
  assert.equal(zonaPorCodigoPostal(zonas, "1925").nombre, "Ensenada");
  assert.equal(zonaPorCodigoPostal(zonas, "b1923abc").nombre, "Berisso");
  assert.equal(zonaPorCodigoPostal(zonas, "1902").nombre, "La Plata");
  assert.equal(zonaPorCodigoPostal(zonas, "1896").nombre, "La Plata");
  assert.equal(zonaPorCodigoPostal(zonas, "1750").nombre, "Resto");
});

test("un código que ninguna zona cubre, o que no es un código, no tiene zona", () => {
  assert.equal(zonaPorCodigoPostal(zonas, "5000"), null);
  assert.equal(zonaPorCodigoPostal(zonas, "hola"), null);
  assert.equal(zonaPorCodigoPostal([], "1925"), null);
});

test("el checkout pide el código sólo si el local cargó alguno", () => {
  assert.equal(hayCodigosPostales(zonas), true);
  assert.equal(hayCodigosPostales([{ nombre: "A" }, { nombre: "B", cp: "xx" }]), false);
  assert.equal(hayCodigosPostales(undefined), false);
});

test("la configuración conserva los códigos de cada zona", () => {
  const s = leerSettings({ envio: { zonas: [{ nombre: "Ensenada", cp: " 1925 " }, { nombre: "Otra" }] } });
  assert.equal(s.envio.zonas[0].cp, "1925");
  assert.equal("cp" in s.envio.zonas[1], false);
});
