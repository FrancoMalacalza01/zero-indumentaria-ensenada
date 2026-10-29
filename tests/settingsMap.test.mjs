import test from "node:test";
import assert from "node:assert/strict";
import {
  cuitFormateado,
  faltaParaVender,
  leerSettings,
  porDefecto,
  costoEnvio,
  faltaParaEnvioGratis,
  llegaAlEnvioGratis,
} from "../src/settingsMap.mjs";

test("una configuración vacía da la de fábrica, no una tienda rota", () => {
  for (const vacio of [null, undefined, {}, "no es un objeto", 42]) {
    const s = leerSettings(vacio);
    assert.equal(s.envio.zonas.length, 4);
    assert.equal(s.devoluciones.dias, 10);
    assert.equal(s.pago.efectivo, true);
  }
});

test("de fábrica hay envíos a toda la provincia, no sólo a los tres locales", () => {
  const s = leerSettings({});
  assert.deepEqual(
    s.envio.zonas.map((z) => z.nombre),
    [
      "Ensenada",
      "Berisso",
      "La Plata",
      "Resto de la Provincia de Buenos Aires",
    ],
  );
  assert.equal(s.envio.zonas.find((z) => z.id === "bsas").tipo, "correo");
});

test("el whatsapp se queda sólo con los números", () => {
  assert.equal(
    leerSettings({ whatsapp: "+54 9 221 123-4567" }).whatsapp,
    "5492211234567",
  );
});

test("una zona sin costo cargado no vale cero: vale 'no sabemos'", () => {
  const s = leerSettings({});
  assert.equal(costoEnvio(s, "Ensenada", 1000), null);
  assert.equal("costo" in s.envio.zonas[0], false);
});

test("una zona con costo cargado se cobra", () => {
  const s = leerSettings({
    envio: { zonas: [{ nombre: "Berisso", costo: 3500 }], envioGratisDesde: 0 },
  });
  assert.equal(costoEnvio(s, "Berisso", 1000), 3500);
});

test("pasando el umbral, el envío no se cobra", () => {
  const s = leerSettings({
    envio: {
      zonas: [{ nombre: "Berisso", costo: 3500 }],
      envioGratisDesde: 99999,
    },
  });
  assert.equal(costoEnvio(s, "Berisso", 99998), 3500);
  assert.equal(costoEnvio(s, "Berisso", 99999), 0);
  assert.equal(costoEnvio(s, "Berisso", 200000), 0);
});

test("una zona que el local no cubre no tiene costo: no se puede cobrar", () => {
  assert.equal(costoEnvio(leerSettings({}), "Ushuaia", 500000), null);
});

test("con el umbral en cero, el envío gratis no existe", () => {
  const s = leerSettings({
    envio: { zonas: [{ nombre: "X", costo: 1000 }], envioGratisDesde: 0 },
  });
  assert.equal(costoEnvio(s, "X", 10_000_000), 1000);
  assert.equal(llegaAlEnvioGratis(s, 10_000_000), false);
  assert.equal(faltaParaEnvioGratis(s, 10_000_000), 0);
});

test("cuánto falta para el envío gratis", () => {
  const s = leerSettings({ envio: { envioGratisDesde: 99999 } });
  assert.equal(faltaParaEnvioGratis(s, 0), 99999);
  assert.equal(faltaParaEnvioGratis(s, 60000), 39999);
  assert.equal(faltaParaEnvioGratis(s, 99999), 0);
  assert.equal(llegaAlEnvioGratis(s, 99999), true);
});

test("dos zonas con el mismo nombre serían un cobro equivocado: se descarta la segunda", () => {
  const s = leerSettings({
    envio: {
      zonas: [
        { nombre: "Berisso", costo: 1000 },
        { nombre: "Berisso", costo: 9000 },
      ],
    },
  });
  assert.equal(s.envio.zonas.length, 1);
  assert.equal(costoEnvio(s, "Berisso", 0), 1000);
});

test("una zona sin nombre no entra, y un costo basura queda sin definir", () => {
  const s = leerSettings({
    envio: {
      zonas: [
        { nombre: "  ", costo: 100 },
        { nombre: "Chivilcoy", costo: "carísimo" },
        { nombre: "Tandil", costo: -500 },
      ],
    },
  });
  assert.deepEqual(
    s.envio.zonas.map((z) => z.nombre),
    ["Chivilcoy", "Tandil"],
  );
  assert.equal(costoEnvio(s, "Chivilcoy", 0), null);
  assert.equal(costoEnvio(s, "Tandil", 0), null);
});

test("a la zona sin id se le arma uno con el nombre", () => {
  const s = leerSettings({ envio: { zonas: [{ nombre: "Mar del Plata" }] } });
  assert.equal(s.envio.zonas[0].id, "mar-del-plata");
});

test("los días de arrepentimiento no pueden bajar de los diez de la ley", () => {
  assert.equal(leerSettings({ devoluciones: { dias: 3 } }).devoluciones.dias, 10);
  assert.equal(leerSettings({ devoluciones: { dias: 0 } }).devoluciones.dias, 10);
  assert.equal(leerSettings({ devoluciones: { dias: 30 } }).devoluciones.dias, 30);
});

test("un descuento por contado con un cero de más se recorta", () => {
  assert.equal(leerSettings({ pago: { descuentoContado: 100 } }).pago.descuentoContado, 90);
  assert.equal(leerSettings({ pago: { descuentoContado: 10 } }).pago.descuentoContado, 10);
  assert.equal(leerSettings({ pago: { descuentoContado: -5 } }).pago.descuentoContado, 0);
});

test("apagar una forma de pago se respeta; lo que no es booleano no la apaga", () => {
  assert.equal(leerSettings({ pago: { efectivo: false } }).pago.efectivo, false);
  assert.equal(leerSettings({ pago: { efectivo: "no" } }).pago.efectivo, true);
});

test("el QR de Cuenta DNI se guarda tal como se cargó", () => {
  const qr = "data:image/webp;base64,AAAA";
  assert.equal(leerSettings({ pago: { cuentaDniQr: qr } }).pago.cuentaDniQr, qr);
});

test("la configuración de fábrica pasa por el lector sin cambiar", () => {
  assert.deepEqual(leerSettings(porDefecto()), porDefecto());
});

test("el cobro online viene apagado y se puede prender", () => {
  assert.equal(leerSettings({}).pago.mercadoPagoOnline, false);
  assert.equal(
    leerSettings({ pago: { mercadoPagoOnline: true } }).pago.mercadoPagoOnline,
    true,
  );
  // Lo que no es booleano no lo prende: un "true" de texto no alcanza.
  assert.equal(
    leerSettings({ pago: { mercadoPagoOnline: "true" } }).pago.mercadoPagoOnline,
    false,
  );
});

test("el CUIT se muestra con los guiones donde van", () => {
  assert.equal(cuitFormateado("30712345670"), "30-71234567-0");
  assert.equal(cuitFormateado("30-71234567-0"), "30-71234567-0");
  // Uno incompleto se muestra tal cual en vez de inventarle un formato.
  assert.equal(cuitFormateado("3071"), "3071");
  assert.equal(cuitFormateado(undefined), "");
});

test("el CUIT guarda sólo dígitos y no más de once", () => {
  assert.equal(leerSettings({ empresa: { cuit: "30-71234567-0" } }).empresa.cuit, "30712345670");
  assert.equal(
    leerSettings({ empresa: { cuit: "3071234567012345" } }).empresa.cuit.length,
    11,
  );
});

test("una tienda recién instalada no está en condiciones de vender, y dice por qué", () => {
  const faltan = faltaParaVender(leerSettings({}));
  const ids = faltan.map((f) => f.id);
  for (const id of ["razonSocial", "cuit", "domicilio", "contacto", "talles"])
    assert.ok(ids.includes(id), `falta avisar de ${id}`);
  // Cada punto explica de dónde sale: si no, es una lista de caprichos.
  assert.ok(faltan.every((f) => f.porque.length > 20));
});

test("con los datos cargados, lo que impide vender desaparece", () => {
  const s = leerSettings({
    whatsapp: "5492211234567",
    empresa: {
      razonSocial: "Zero Indumentaria",
      cuit: "30712345670",
      domicilioLegal: "La Merced 327, Ensenada",
    },
    talles: { filas: [{ talle: "M", pecho: "96", cintura: "80", cadera: "100" }] },
  });
  assert.deepEqual(faltaParaVender(s).filter((f) => f.impide), []);
});

test("sin tabla de medidas no se puede vender ropa, aunque esté todo lo demás", () => {
  const s = leerSettings({
    whatsapp: "5492211234567",
    empresa: { razonSocial: "X", cuit: "30712345670", domicilioLegal: "Y" },
  });
  assert.deepEqual(
    faltaParaVender(s).filter((f) => f.impide).map((f) => f.id),
    ["talles"],
  );
});

test("una tabla de talles sin ninguna medida cargada no cuenta como tabla", () => {
  // Es el estado en que queda la tienda con los talles precargados: S, M, L...
  // y todas las medidas vacías. Tiene filas, pero no informa nada.
  const vacia = leerSettings({
    whatsapp: "5492211234567",
    empresa: { razonSocial: "X", cuit: "30712345670", domicilioLegal: "Y" },
    talles: {
      filas: [
        { talle: "S", pecho: "", cintura: "", cadera: "" },
        { talle: "M", pecho: "", cintura: "", cadera: "" },
      ],
    },
  });
  assert.deepEqual(
    faltaParaVender(vacia).filter((f) => f.impide).map((f) => f.id),
    ["talles"],
  );
  // Con una sola medida real en alguna fila, la tabla ya informa algo.
  const conUna = leerSettings({
    whatsapp: "5492211234567",
    empresa: { razonSocial: "X", cuit: "30712345670", domicilioLegal: "Y" },
    talles: { filas: [{ talle: "S", pecho: "", cintura: "", cadera: "" }, { talle: "M", pecho: "96", cintura: "", cadera: "" }] },
  });
  assert.deepEqual(faltaParaVender(conUna).filter((f) => f.impide), []);
});

test("un mail de contacto alcanza aunque no haya WhatsApp", () => {
  const conMail = leerSettings({ empresa: { emailContacto: "hola@mistral.com" } });
  assert.equal(
    faltaParaVender(conMail).some((f) => f.id === "contacto"),
    false,
  );
});
