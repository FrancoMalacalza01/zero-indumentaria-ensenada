import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tablaDeTalles, columnasDeMedidas } from "../src/tablasTalle.mjs";

const medidas = {
  "m-1": { medidas: { nota: "Prenda en plano", filas: [{ talle: "M", medidas: "Ancho de pecho 54 cm" }, { talle: "L", medidas: "Ancho de pecho 56 cm" }] } },
  "m-2": { medidas: { nota: "", filas: [] } },
  "b-7": { medidas: { nota: "", filas: [{ talle: "S/38", medidas: "Ancho de pecho 54cm" }] } },
};

test("Mistral: la tabla sale de las medidas de su ficha", () => {
  const t = tablaDeTalles({ id: "m-1", brand: "Mistral", category: "Remeras", name: "Remera" }, medidas);
  assert.equal(t.tipo, "filas");
  assert.equal(t.filas.length, 2);
  assert.equal(t.nota, "Prenda en plano");
});

test("Mistral: sin medidas publicadas no hay tabla, ni se inventa una", () => {
  assert.equal(tablaDeTalles({ id: "m-2", brand: "Mistral", category: "Remeras" }, medidas), null);
  assert.equal(tablaDeTalles({ id: "m-9", brand: "Mistral", category: "Remeras" }, medidas), null);
  assert.equal(tablaDeTalles({ id: "m-1", brand: "Mistral" }, null), null);
  // Un id como "constructor" no puede traer nada del prototipo.
  assert.equal(tablaDeTalles({ id: "constructor", brand: "Mistral" }, medidas), null);
});

test("Brooksfield: si la ficha trae las medidas de esa prenda, se usan esas y no la imagen general", () => {
  const t = tablaDeTalles({ id: "b-7", brand: "Brooksfield", category: "Camisas", name: "Camisa" }, medidas);
  assert.equal(t.tipo, "filas");
  assert.equal(t.filas[0].talle, "S/38");
});

test("Brooksfield: sin medidas en la ficha, la imagen por tipo de prenda, y los jeans la suya", () => {
  const img = (category, name = "Algo") => tablaDeTalles({ id: "b-1", brand: "Brooksfield", category, name }, medidas);
  assert.equal(img("Remeras").src, "/men-medidas/brooksfield-remeras.jpg");
  assert.equal(img("Camperas").src, "/men-medidas/brooksfield-camperas.jpg");
  assert.equal(img("Pantalones", "Jean Slim Azul").src, "/men-medidas/brooksfield-jeans.jpg");
  // Sin tabla propia, la de la prenda más parecida, y avisando que es de referencia.
  const chino = img("Pantalones", "Pantalón Chino");
  assert.equal(chino.src, "/men-medidas/brooksfield-jeans.jpg");
  assert.match(chino.referencia, /referencia/i);
  assert.equal(img("Bermudas").src, "/men-medidas/brooksfield-jeans.jpg");
  assert.equal(img("Buzos").src, "/men-medidas/brooksfield-sweaters.jpg");
  assert.equal(img("Chalecos").src, "/men-medidas/brooksfield-sweaters.jpg");
  // Las que sí tienen la suya no llevan el aviso.
  assert.equal(img("Camperas").referencia, undefined);
  assert.equal(img("Pantalones", "Jean Slim Azul").referencia, undefined);
});

test("Brooksfield: accesorios y categorías sin tabla no muestran ninguna", () => {
  for (const c of ["Billeteras", "Cinturones", "Fragancias", "Medias", "Hombre", "Shorts de baño"])
    assert.equal(tablaDeTalles({ id: "b-2", brand: "Brooksfield", category: c, name: "X" }, medidas), null);
});

test("las imágenes de Brooksfield existen en public", () => {
  for (const t of ["remeras", "polos", "camisas", "sweaters", "camperas", "jeans"])
    assert.ok(existsSync(new URL(`../public/men-medidas/brooksfield-${t}.jpg`, import.meta.url)), t);
});

test("otra marca, o datos rotos: sin tabla", () => {
  assert.equal(tablaDeTalles({ id: "x", brand: "Otra" }, medidas), null);
  assert.equal(tablaDeTalles(null, medidas), null);
  assert.equal(tablaDeTalles("hola", medidas), null);
});

test("las medidas de cada talle se arman en columnas cuando son las mismas para todos", () => {
  const t = columnasDeMedidas([
    { talle: "S", medidas: "Ancho de pecho 51 cm, Largo total 70 cm" },
    { talle: "M", medidas: "Ancho de pecho 53 cm, Largo total 72 cm" },
  ]);
  assert.deepEqual(t, {
    titulos: ["Ancho de pecho", "Largo total"],
    filas: [{ talle: "S", valores: ["51 cm", "70 cm"] }, { talle: "M", valores: ["53 cm", "72 cm"] }],
  });
});

test("medidas con rango y con texto largo también quedan en columnas", () => {
  const t = columnasDeMedidas([
    { talle: "S", medidas: "Ancho de cintura 35 a 46 cm, Ancho de cadera 50 cm, Largo lateral 98 cm" },
    { talle: "M", medidas: "Ancho de cintura 37 a 48 cm, Ancho de cadera 52cm, Largo lateral 99.5 cm" },
  ]);
  assert.deepEqual(t.titulos, ["Ancho de cintura", "Ancho de cadera", "Largo lateral"]);
  assert.deepEqual(t.filas[0].valores, ["35 a 46 cm", "50 cm", "98 cm"]);
  assert.equal(t.filas[1].valores[2], "99.5 cm");
});

test("si los talles no traen las mismas medidas, no se inventa una tabla: queda el texto de la marca", () => {
  assert.equal(columnasDeMedidas([
    { talle: "S", medidas: "Ancho de pecho 51 cm, Largo total 70 cm" },
    { talle: "M", medidas: "Ancho de pecho 53 cm" },
  ]), null);
  assert.equal(columnasDeMedidas([{ talle: "S", medidas: "Sin números" }]), null);
  assert.equal(columnasDeMedidas([]), null);
  assert.equal(columnasDeMedidas(undefined), null);
});
