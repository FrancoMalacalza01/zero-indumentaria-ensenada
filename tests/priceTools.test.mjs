import test from "node:test";
import assert from "node:assert/strict";
import {
  redondear,
  leerRegla,
  calcularPrecio,
  variacion,
  vistaPrevia,
  precioDeProducto,
  ofertaDeProducto,
  descuento,
  aplicarCambios,
  capturar,
  aplicarFoto,
  historialVacio,
  anotar,
  deshacer,
  rehacer,
  filasACsv,
  LIMITE_HISTORIAL,
} from "../src/priceTools.mjs";
import { PRECIO_MAXIMO } from "../src/menOverrides.mjs";

const prod = (id, price, extra = {}) => ({
  id,
  name: `Producto ${id}`,
  price,
  active: true,
  stock: { M: 1 },
  ...extra,
});

// --- redondeo ---------------------------------------------------------------

test("el redondeo lleva el precio al múltiplo más cercano", () => {
  assert.equal(redondear(32949, "100"), 32900);
  assert.equal(redondear(32950, "100"), 33000);
  assert.equal(redondear(32740, "500"), 32500);
  assert.equal(redondear(32760, "500"), 33000);
  assert.equal(redondear(32400, "1000"), 32000);
  assert.equal(redondear(32600, "1000"), 33000);
  assert.equal(redondear(32949.4, "ninguno"), 32949);
});

test("terminado en 900 elige el X.900 más cercano y no baja de 900", () => {
  assert.equal(redondear(32500, "900"), 32900);
  assert.equal(redondear(32300, "900"), 31900);
  assert.equal(redondear(32900, "900"), 32900);
  assert.equal(redondear(50, "900"), 900);
  assert.equal(redondear(100, "900"), 900);
});

// --- leer la regla ----------------------------------------------------------

test("los porcentajes se leen con coma o punto, y los montos como pesos enteros", () => {
  assert.deepEqual(leerRegla("subir", "10"), { ok: true, value: 10 });
  assert.deepEqual(leerRegla("subir", "7,5"), { ok: true, value: 7.5 });
  assert.deepEqual(leerRegla("bajar", "12.5 %"), { ok: true, value: 12.5 });
  assert.deepEqual(leerRegla("sumar", "5.000"), { ok: true, value: 5000 });
  assert.deepEqual(leerRegla("fijar", "$ 32.900"), { ok: true, value: 32900 });
});

test("una regla mal escrita se rechaza con motivo en vez de adivinar", () => {
  for (const [op, v] of [
    ["subir", ""], ["subir", "abc"], ["subir", "0"], ["subir", "-5"], ["subir", "5000"],
    ["bajar", "100"], ["bajar", "150"], ["sumar", "12,5"], ["sumar", "0"], ["fijar", "-1"],
    ["nada", "10"], [undefined, "10"],
  ]) {
    const r = leerRegla(op, v);
    assert.equal(r.ok, false, `${op} ${v} debía rechazarse`);
    assert.ok(r.error.length > 8);
  }
});

// --- calcular ---------------------------------------------------------------

test("cada operación hace la cuenta que dice", () => {
  assert.deepEqual(calcularPrecio(10000, "subir", 10), { ok: true, value: 11000 });
  assert.deepEqual(calcularPrecio(10000, "bajar", 25), { ok: true, value: 7500 });
  assert.deepEqual(calcularPrecio(10000, "sumar", 1500), { ok: true, value: 11500 });
  assert.deepEqual(calcularPrecio(10000, "restar", 1500), { ok: true, value: 8500 });
  assert.deepEqual(calcularPrecio(10000, "fijar", 27500), { ok: true, value: 27500 });
});

test("el redondeo se aplica sobre el resultado de la cuenta", () => {
  assert.deepEqual(calcularPrecio(32900, "subir", 10, "100"), { ok: true, value: 36200 });
  assert.deepEqual(calcularPrecio(32900, "subir", 10, "900"), { ok: true, value: 35900 });
  assert.deepEqual(calcularPrecio(32900, "bajar", 15, "1000"), { ok: true, value: 28000 });
});

test("un precio imposible no se inventa: se avisa y no se toca", () => {
  assert.equal(calcularPrecio(5000, "restar", 5000).ok, false);
  assert.equal(calcularPrecio(5000, "restar", 9000).ok, false);
  assert.equal(calcularPrecio(PRECIO_MAXIMO, "subir", 50).ok, false);
  assert.equal(calcularPrecio(0, "subir", 10).ok, false);
  assert.equal(calcularPrecio(12.5, "subir", 10).ok, false);
  assert.equal(calcularPrecio(10000, "inventada", 10).ok, false);
  assert.equal(calcularPrecio(10000, "fijar", NaN).ok, false);
});

test("la variación sale en por ciento entero", () => {
  assert.equal(variacion(32900, 36190), 10);
  assert.equal(variacion(10000, 7500), -25);
  assert.equal(variacion(10000, 10000), 0);
  assert.equal(variacion(0, 500), 0);
});

// --- vista previa -----------------------------------------------------------

test("la vista previa cuenta lo que cambia, lo que queda igual y lo que no se puede", () => {
  const v = vistaPrevia(
    [
      { key: "a", precio: 10000 },
      { key: "b", precio: 20000 },
      { key: "c", precio: 800 },
    ],
    "restar",
    1000,
  );
  assert.equal(v.cambian, 2);
  assert.equal(v.errores, 1);
  assert.equal(v.iguales, 0);
  assert.deepEqual(v.filas.map((f) => [f.key, f.estado, f.despues]), [
    ["a", "cambia", 9000],
    ["b", "cambia", 19000],
    ["c", "error", null],
  ]);
  assert.equal(v.promedioPct, -7.5);
});

test("una regla que no mueve el precio queda como 'igual', no como cambio", () => {
  const v = vistaPrevia([{ key: "a", precio: 32900 }], "subir", 1, "900");
  assert.equal(v.cambian, 0);
  assert.equal(v.iguales, 1);
  assert.equal(v.promedioPct, 0);
});

// --- producto de la tienda --------------------------------------------------

test("el precio anterior sobrevive sólo si sigue siendo mayor al nuevo", () => {
  const p = prod("a", 30000, { oldPrice: 40000 });
  assert.equal(precioDeProducto(p, 35000).oldPrice, 40000);
  assert.equal("oldPrice" in precioDeProducto(p, 40000), false);
  assert.equal("oldPrice" in precioDeProducto(p, 50000), false);
  assert.equal(precioDeProducto(p, 35000).price, 35000);
  assert.equal(p.price, 30000, "no muta el original");
});

// --- aplicar y deshacer -----------------------------------------------------

test("un cambio toca sólo a los artículos nombrados", () => {
  const productos = [prod("a", 10000), prod("b", 20000)];
  const r = aplicarCambios({}, productos, [
    { fuente: "db", id: "a", precio: 12000 },
    { fuente: "men", id: "m1", precio: 27500, precioMarca: 32900 },
    { fuente: "men", id: "m2", activo: false },
  ]);
  assert.deepEqual(r.productos.map((p) => p.price), [12000, 20000]);
  assert.deepEqual(r.ajustes.m1, { price: 27500, active: true });
  assert.deepEqual(r.ajustes.m2, { price: null, active: false });
  assert.equal(productos[0].price, 10000, "no muta los productos");
});

test("poner el precio de la marca no guarda una excepción", () => {
  const r = aplicarCambios({}, [], [
    { fuente: "men", id: "m1", precio: 32900, precioMarca: 32900 },
  ]);
  assert.deepEqual(r.ajustes, {});
});

test("null vuelve al precio de la marca y borra la excepción si queda como fábrica", () => {
  const r = aplicarCambios(
    { m1: { price: 27500, active: true }, m2: { price: 1000, active: false } },
    [],
    [
      { fuente: "men", id: "m1", precio: null },
      { fuente: "men", id: "m2", precio: null },
    ],
  );
  assert.equal("m1" in r.ajustes, false);
  assert.deepEqual(r.ajustes.m2, { price: null, active: false });
});

test("ocultar un producto de la tienda no toca su precio", () => {
  const r = aplicarCambios({}, [prod("a", 10000, { oldPrice: 15000 })], [
    { fuente: "db", id: "a", activo: false },
  ]);
  assert.equal(r.productos[0].active, false);
  assert.equal(r.productos[0].price, 10000);
  assert.equal(r.productos[0].oldPrice, 15000);
});

test("deshacer devuelve todo exactamente como estaba, tienda y hombre", () => {
  const productos = [prod("a", 10000, { oldPrice: 15000 }), prod("b", 20000)];
  const ajustes = { m1: { price: 27500, active: true } };
  const cambios = [
    { fuente: "db", id: "a", precio: 16000 }, // supera el anterior: se borra
    { fuente: "men", id: "m1", precio: null },
    { fuente: "men", id: "m2", activo: false },
  ];
  const antes = capturar(ajustes, productos, ["m1", "m2"], ["a"]);
  const nuevo = aplicarCambios(ajustes, productos, cambios);
  const despues = capturar(nuevo.ajustes, nuevo.productos, ["m1", "m2"], ["a"]);
  assert.notDeepEqual(antes, despues);
  const vuelta = aplicarFoto(nuevo.ajustes, nuevo.productos, antes);
  assert.deepEqual(vuelta.ajustes, ajustes);
  assert.deepEqual(vuelta.productos, productos);
  const otraVez = aplicarFoto(vuelta.ajustes, vuelta.productos, despues);
  assert.deepEqual(otraVez.ajustes, nuevo.ajustes);
  assert.deepEqual(otraVez.productos, nuevo.productos);
});

test("deshacer no toca lo que no está en la foto", () => {
  const productos = [prod("a", 10000), prod("b", 20000)];
  const foto = capturar({}, productos, [], ["a"]);
  const r = aplicarFoto({ x: { price: 5, active: true } }, [prod("a", 1), prod("b", 999)], foto);
  assert.equal(r.productos[0].price, 10000);
  assert.equal(r.productos[1].price, 999);
  assert.deepEqual(r.ajustes, { x: { price: 5, active: true } });
});

// --- historial --------------------------------------------------------------

const entrada = (n) => ({ etiqueta: `cambio ${n}`, antes: { men: {}, db: {} }, despues: { men: {}, db: {} } });

test("se deshace y se rehace en orden", () => {
  let h = historialVacio();
  h = anotar(h, entrada(1));
  h = anotar(h, entrada(2));
  let r = deshacer(h);
  assert.equal(r.entrada.etiqueta, "cambio 2");
  r = deshacer(r.historial);
  assert.equal(r.entrada.etiqueta, "cambio 1");
  assert.equal(deshacer(r.historial).entrada, null);
  let q = rehacer(r.historial);
  assert.equal(q.entrada.etiqueta, "cambio 1");
  q = rehacer(q.historial);
  assert.equal(q.entrada.etiqueta, "cambio 2");
  assert.equal(rehacer(q.historial).entrada, null);
});

test("un cambio nuevo después de deshacer borra lo que se podía rehacer", () => {
  let h = anotar(anotar(historialVacio(), entrada(1)), entrada(2));
  h = deshacer(h).historial;
  assert.equal(h.futuro.length, 1);
  h = anotar(h, entrada(3));
  assert.equal(h.futuro.length, 0);
  assert.deepEqual(h.pasado.map((e) => e.etiqueta), ["cambio 1", "cambio 3"]);
});

test("el historial tiene tope y descarta lo más viejo", () => {
  let h = historialVacio();
  for (let i = 0; i < LIMITE_HISTORIAL + 10; i++) h = anotar(h, entrada(i));
  assert.equal(h.pasado.length, LIMITE_HISTORIAL);
  assert.equal(h.pasado[0].etiqueta, "cambio 10");
});

test("deshacer y rehacer sobre un historial vacío no rompen nada", () => {
  const h = historialVacio();
  assert.equal(deshacer(h).entrada, null);
  assert.equal(rehacer(h).entrada, null);
});

// --- CSV --------------------------------------------------------------------

test("el CSV abre bien en Excel y no deja colar fórmulas", () => {
  const csv = filasACsv([
    ["Nombre", "Precio"],
    ['Remera "Logo"', 32900],
    ["=HYPERLINK(\"http://x\")", "+5"],
    ["-cmd", "@sum"],
    [null, undefined],
  ]);
  assert.ok(csv.startsWith("﻿"));
  const lineas = csv.slice(1).split("\r\n");
  assert.equal(lineas[0], '"Nombre";"Precio"');
  assert.equal(lineas[1], '"Remera ""Logo""";"32900"');
  assert.equal(lineas[2], `"'=HYPERLINK(""http://x"")";"'+5"`);
  assert.equal(lineas[3], `"'-cmd";"'@sum"`);
  assert.equal(lineas[4], '"";""');
});

// --- ofertas ----------------------------------------------------------------

test("una oferta se calcula como una baja de precio, redondeo incluido", () => {
  assert.deepEqual(calcularPrecio(30000, "oferta", 20), { ok: true, value: 24000 });
  assert.deepEqual(calcularPrecio(32900, "oferta", 15, "900"), { ok: true, value: 27900 });
  assert.equal(leerRegla("oferta", "20").ok, true);
  assert.equal(leerRegla("oferta", "100").ok, false);
  assert.equal(leerRegla("oferta", "150").ok, false);
  assert.equal(leerRegla("oferta", "").ok, false);
});

test("el descuento de una oferta sale en por ciento entero y es 0 si no hay oferta", () => {
  assert.equal(descuento(30000, 24000), 20);
  assert.equal(descuento(32900, 27500), 16);
  for (const [a, p] of [[24000, 24000], [20000, 24000], [undefined, 100], [0, 5], [100, 0], [NaN, 5]])
    assert.equal(descuento(a, p), 0, `descuento(${a}, ${p})`);
});

test("la vista previa de una oferta cuenta el descuento sobre el precio original", () => {
  const v = vistaPrevia([{ key: "a", precio: 30000 }], "oferta", 20);
  assert.equal(v.cambian, 1);
  assert.deepEqual(v.filas[0], { key: "a", antes: 30000, despues: 24000, estado: "cambia", base: 30000 });
  assert.equal(v.promedioPct, -20);
});

test("repetir una oferta no acumula descuentos: se cuenta siempre sobre el original", () => {
  // Ya está en oferta: cuesta 24.000 y antes costaba 30.000.
  const item = { key: "a", precio: 24000, base: 30000 };
  // Otro 20% da lo mismo que ya tiene: nada que cambiar (no 19.200).
  const igual = vistaPrevia([item], "oferta", 20);
  assert.equal(igual.iguales, 1);
  assert.equal(igual.cambian, 0);
  // Un 30% pasa a 21.000 (30% de 30.000), no a 16.800.
  const mas = vistaPrevia([item], "oferta", 30);
  assert.equal(mas.filas[0].despues, 21000);
  assert.equal(mas.filas[0].base, 30000);
  assert.equal(mas.cambian, 1);
});

test("una oferta cuyo redondeo se come el descuento no es una oferta: se avisa", () => {
  // 1% de 30.000 son 300, y al redondear a $1.000 vuelve a 30.000.
  const v = vistaPrevia([{ key: "a", precio: 30000 }], "oferta", 1, "1000");
  assert.equal(v.errores, 1);
  assert.equal(v.cambian, 0);
  assert.match(v.filas[0].error, /no baja el precio/);
});

test("un artículo sin precio válido no entra en la oferta", () => {
  const v = vistaPrevia([{ key: "a", precio: 0 }, { key: "b", precio: 10000 }], "oferta", 10);
  assert.equal(v.errores, 1);
  assert.equal(v.cambian, 1);
});

test("ofertaDeProducto guarda el precio anterior sólo si es mayor", () => {
  const p = prod("a", 30000);
  assert.deepEqual(
    [ofertaDeProducto(p, 24000, 30000).price, ofertaDeProducto(p, 24000, 30000).oldPrice],
    [24000, 30000],
  );
  for (const anterior of [24000, 20000, null, undefined, 0])
    assert.equal("oldPrice" in ofertaDeProducto(p, 24000, anterior), false, String(anterior));
  assert.equal(p.price, 30000, "no muta el producto");
});

test("poner en oferta un producto de la tienda guarda el precio anterior tachado", () => {
  const r = aplicarCambios({}, [prod("a", 30000), prod("b", 10000)], [
    { fuente: "db", id: "a", precio: 24000, antes: 30000 },
  ]);
  assert.equal(r.productos[0].price, 24000);
  assert.equal(r.productos[0].oldPrice, 30000);
  assert.equal(r.productos[1].price, 10000);
  assert.equal("oldPrice" in r.productos[1], false);
});

test("terminar la oferta de un producto de la tienda vuelve al precio anterior y saca el tachado", () => {
  const enOferta = [prod("a", 24000, { oldPrice: 30000 })];
  const r = aplicarCambios({}, enOferta, [{ fuente: "db", id: "a", precio: 30000, antes: null }]);
  assert.equal(r.productos[0].price, 30000);
  assert.equal("oldPrice" in r.productos[0], false);
});

test("poner en oferta una prenda de hombre sin precio propio usa el de la marca como anterior", () => {
  const r = aplicarCambios({}, [], [
    { fuente: "men", id: "m1", precio: 26320, antes: 32900, precioMarca: 32900 },
  ]);
  assert.deepEqual(r.ajustes.m1, { price: 26320, active: true, old: 32900 });
});

test("terminar la oferta de una prenda que tenía el precio de la marca borra la excepción", () => {
  const aj = { m1: { price: 26320, active: true, old: 32900 } };
  const r = aplicarCambios(aj, [], [
    { fuente: "men", id: "m1", precio: 32900, antes: null, precioMarca: 32900 },
  ]);
  assert.equal("m1" in r.ajustes, false);
});

test("terminar la oferta de una prenda con precio propio previo vuelve a ese precio", () => {
  const aj = { m1: { price: 24000, active: true, old: 28000 } };
  const r = aplicarCambios(aj, [], [
    { fuente: "men", id: "m1", precio: 28000, antes: null, precioMarca: 32900 },
  ]);
  assert.deepEqual(r.ajustes.m1, { price: 28000, active: true });
});

test("deshacer una oferta devuelve tienda y hombre exactamente como estaban", () => {
  const productos = [prod("a", 30000)];
  const ajustes = { m1: { price: 28000, active: true } };
  const cambios = [
    { fuente: "db", id: "a", precio: 24000, antes: 30000 },
    { fuente: "men", id: "m1", precio: 22400, antes: 28000, precioMarca: 32900 },
  ];
  const antes = capturar(ajustes, productos, ["m1"], ["a"]);
  const nuevo = aplicarCambios(ajustes, productos, cambios);
  const despues = capturar(nuevo.ajustes, nuevo.productos, ["m1"], ["a"]);
  assert.equal(despues.db.a.oldPrice, 30000);
  assert.equal(despues.men.m1.old, 28000);
  const vuelta = aplicarFoto(nuevo.ajustes, nuevo.productos, antes);
  assert.deepEqual(vuelta.ajustes, ajustes);
  assert.deepEqual(vuelta.productos, productos);
  const otraVez = aplicarFoto(vuelta.ajustes, vuelta.productos, despues);
  assert.deepEqual(otraVez.ajustes, nuevo.ajustes);
  assert.deepEqual(otraVez.productos, nuevo.productos);
});

test("cambiar a mano el precio de un artículo en oferta la termina si alcanza al anterior", () => {
  const productos = [prod("a", 24000, { oldPrice: 30000 })];
  const sube = aplicarCambios({}, productos, [{ fuente: "db", id: "a", precio: 31000 }]);
  assert.equal("oldPrice" in sube.productos[0], false);
  const baja = aplicarCambios({}, productos, [{ fuente: "db", id: "a", precio: 22000 }]);
  assert.equal(baja.productos[0].oldPrice, 30000);
});
