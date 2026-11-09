import test from "node:test";
import assert from "node:assert/strict";
import { detallesDePrenda } from "../src/detallesPrenda.mjs";

const detalles = {
  "b-1": {
    composicion: "55% lino, 45% algodón",
    caracteristicas: ["Cuello italiano", "55% lino, 45% algodón", "Logo bordado"],
    cuidados: ["Lavar con agua tibia"],
  },
};

test("junta material, color, características y cuidados", () => {
  const d = detallesDePrenda({ id: "b-1", colors: ["Azul", "Blanco"] }, detalles);
  assert.equal(d.composicion, "55% lino, 45% algodón");
  assert.deepEqual(d.colores, ["Azul", "Blanco"]);
  assert.deepEqual(d.cuidados, ["Lavar con agua tibia"]);
});

test("la composición no se repite entre las características", () => {
  const d = detallesDePrenda({ id: "b-1", colors: [] }, detalles);
  assert.deepEqual(d.caracteristicas, ["Cuello italiano", "Logo bordado"]);
});

test("sin ficha, igual se muestra el color; sin nada, no hay bloque", () => {
  assert.deepEqual(detallesDePrenda({ id: "x", colors: ["Negro"] }, detalles).colores, ["Negro"]);
  assert.equal(detallesDePrenda({ id: "x", colors: [] }, detalles), null);
  assert.equal(detallesDePrenda({ id: "x" }, null), null);
  assert.equal(detallesDePrenda(null, detalles), null);
});

test("textos vacíos o que no son texto se descartan, y un id raro no trae nada del prototipo", () => {
  const raro = { a: { composicion: "  ", caracteristicas: ["", 5, null, " Ok "], cuidados: "no es lista" } };
  const d = detallesDePrenda({ id: "a", colors: [] }, raro);
  assert.equal(d.composicion, "");
  assert.deepEqual(d.caracteristicas, ["Ok"]);
  assert.deepEqual(d.cuidados, []);
  assert.equal(detallesDePrenda({ id: "constructor", colors: [] }, raro), null);
});

test("los renglones repetidos de la ficha se muestran una sola vez", () => {
  const d = detallesDePrenda({ id: "r", colors: ["Azul", "Azul"] }, { r: { caracteristicas: ["Forrada", "Forrada", "Cuello"], cuidados: ["Lavar", "Lavar"] } });
  assert.deepEqual(d.caracteristicas, ["Forrada", "Cuello"]);
  assert.deepEqual(d.cuidados, ["Lavar"]);
  assert.deepEqual(d.colores, ["Azul"]);
});
