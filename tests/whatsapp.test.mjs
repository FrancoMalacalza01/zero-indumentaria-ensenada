import test from "node:test";
import assert from "node:assert/strict";
import { enlaceWhatsapp, mensajeConsultaPrenda } from "../src/whatsapp.mjs";

test("un número válido da el enlace de wa.me con el mensaje codificado", () => {
  const url = enlaceWhatsapp("5492211234567", "Hola, ¿tienen talle M?");
  assert.equal(
    url,
    "https://wa.me/5492211234567?text=Hola%2C%20%C2%BFtienen%20talle%20M%3F",
  );
});

test("sin mensaje, el enlace es sólo al número", () => {
  assert.equal(enlaceWhatsapp("5492211234567"), "https://wa.me/5492211234567");
  assert.equal(enlaceWhatsapp("5492211234567", ""), "https://wa.me/5492211234567");
  assert.equal(enlaceWhatsapp("5492211234567", "   "), "https://wa.me/5492211234567");
});

test("un número con símbolos se limpia y uno que no es un teléfono da null", () => {
  assert.equal(
    enlaceWhatsapp("+54 9 221 123-4567", "hola"),
    "https://wa.me/5492211234567?text=hola",
  );
  for (const malo of ["", "   ", null, undefined, "123", "abc", "12345", "1234567890123456", {}, []])
    assert.equal(enlaceWhatsapp(malo, "hola"), null, `debía rechazar ${String(malo)}`);  // Un teléfono guardado como número y no como texto también vale.
  assert.equal(enlaceWhatsapp(5492211234567, "hola"), "https://wa.me/5492211234567?text=hola");
});

test("un mensaje con caracteres peligrosos para una URL no la rompe", () => {
  const url = enlaceWhatsapp("5492211234567", "a&b=c?d#e\n\"f\"");
  const texto = new URL(url).searchParams.get("text");
  assert.equal(texto, 'a&b=c?d#e\n"f"');
  assert.equal(new URL(url).hash, "", "el # del mensaje no puede cortar la URL");
});

test("el mensaje de consulta lleva la prenda, la marca y el precio que ve el cliente", () => {
  const m = mensajeConsultaPrenda({
    nombre: "Remera Logo Mini Bordada MC - 10182",
    marca: "Mistral",
    precio: "$ 32.900",
  });
  assert.equal(
    m,
    [
      "Hola Zero Indumentaria, quiero consultar por esta prenda:",
      "• Remera Logo Mini Bordada MC - 10182 (Mistral) — $ 32.900",
      "¿Tienen disponibilidad y en qué talles?",
    ].join("\n"),
  );
});

test("si falta la marca o el precio, el mensaje sigue bien armado", () => {
  assert.match(mensajeConsultaPrenda({ nombre: "Buzo Alva", precio: "$ 87.900" }), /• Buzo Alva — \$ 87\.900\n/);
  assert.match(mensajeConsultaPrenda({ nombre: "Buzo Alva", marca: "Zero" }), /• Buzo Alva \(Zero\)\n/);
  assert.match(mensajeConsultaPrenda({ nombre: "Buzo Alva" }), /• Buzo Alva\n/);
  assert.doesNotThrow(() => mensajeConsultaPrenda({}));
  assert.doesNotThrow(() => mensajeConsultaPrenda({ nombre: 42, marca: null, precio: undefined }));
});

test("los espacios y saltos de línea raros del nombre no ensucian el mensaje", () => {
  const m = mensajeConsultaPrenda({ nombre: "  Remera \n  Blank   MC ", marca: " Mistral ", precio: "$ 1" });
  assert.match(m, /• Remera Blank MC \(Mistral\) — \$ 1\n/);
});

test("una prenda en oferta dice de cuánto era, para que quien atiende vea el descuento", () => {
  const m = mensajeConsultaPrenda({
    nombre: "Remera Logo Mini Bordada MC - 10182",
    marca: "Mistral",
    precio: "$ 29.600",
    antes: "$ 32.900",
  });
  assert.equal(
    m.split("\n")[1],
    "• Remera Logo Mini Bordada MC - 10182 (Mistral) — $ 29.600 (antes $ 32.900)",
  );
});

test("sin oferta, o sin precio, el 'antes' no aparece ni rompe el mensaje", () => {
  assert.doesNotMatch(mensajeConsultaPrenda({ nombre: "Buzo", precio: "$ 1", antes: "" }), /antes/);
  assert.doesNotMatch(mensajeConsultaPrenda({ nombre: "Buzo", precio: "$ 1", antes: undefined }), /antes/);
  // Un "antes" sin precio actual no tiene sentido: se ignora.
  assert.doesNotMatch(mensajeConsultaPrenda({ nombre: "Buzo", antes: "$ 5" }), /antes/);
  assert.doesNotThrow(() => mensajeConsultaPrenda({ nombre: "Buzo", precio: "$ 1", antes: 42 }));
});
