import test from "node:test";
import assert from "node:assert/strict";
import { faltaEnElPedido, limpiarDireccion, mailLimpio, textoDireccion } from "../src/datosDelPedido.mjs";

const dir = { calle: "Calle 7", numero: "1234", localidad: "La Plata", cp: "1900" };

test("con factura el mail es obligatorio; sin factura no", () => {
  assert.match(faltaEnElPedido({ factura: true, email: "", entrega: "pickup" }), /factura/i);
  assert.match(faltaEnElPedido({ factura: true, email: "   ", entrega: "pickup" }), /factura/i);
  assert.equal(faltaEnElPedido({ factura: true, email: "ana@correo.com", entrega: "pickup" }), null);
  assert.equal(faltaEnElPedido({ factura: false, email: "", entrega: "pickup" }), null);
  assert.equal(faltaEnElPedido({ entrega: "pickup" }), null);
});

test("un mail escrito tiene que ser un mail, con o sin factura", () => {
  assert.match(faltaEnElPedido({ factura: false, email: "ana@", entrega: "pickup" }), /mail/i);
  assert.match(faltaEnElPedido({ factura: true, email: "ana arroba correo", entrega: "pickup" }), /factura/i);
  assert.equal(mailLimpio("  ANA@Correo.COM "), "ana@correo.com");
  assert.equal(mailLimpio("ana@"), "");
});

test("el envío a domicilio pide calle, número, localidad y código postal de 4 dígitos", () => {
  assert.equal(faltaEnElPedido({ entrega: "shipping", direccion: dir }), null);
  for (const campo of ["calle", "numero", "localidad"])
    assert.ok(faltaEnElPedido({ entrega: "shipping", direccion: { ...dir, [campo]: " " } }), campo);
  assert.match(faltaEnElPedido({ entrega: "shipping", direccion: { ...dir, cp: "19" } }), /código postal/);
  assert.match(faltaEnElPedido({ entrega: "shipping", direccion: undefined }), /calle/i);
  // En el retiro no se pide dirección.
  assert.equal(faltaEnElPedido({ entrega: "pickup", direccion: undefined }), null);
});

test("la dirección se limpia: espacios, largos máximos, sólo dígitos en el código y campos desconocidos afuera", () => {
  const d = limpiarDireccion({ calle: "  Calle   7 ", numero: "1234567890123", cp: "B1900ABC", referencia: "x".repeat(300), otro: "no" });
  assert.equal(d.calle, "Calle 7");
  assert.equal(d.numero.length, 10);
  assert.equal(d.cp, "1900");
  assert.equal(d.referencia.length, 140);
  assert.equal("otro" in d, false);
  assert.deepEqual(Object.keys(limpiarDireccion(null)).sort(), ["calle", "cp", "localidad", "numero", "piso", "referencia"]);
});

test("la dirección en una línea para el panel", () => {
  assert.equal(textoDireccion({ ...dir, piso: "2 B", referencia: "timbre roto" }), "Calle 7 1234, piso/depto 2 B, La Plata (CP 1900). Referencia: timbre roto");
  assert.equal(textoDireccion(dir), "Calle 7 1234, La Plata (CP 1900)");
  assert.equal(textoDireccion(null), "");
});
