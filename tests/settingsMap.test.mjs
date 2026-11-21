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
  PLAZO_CORREO_CLASICO,
  textoPlazoEnvio, textoDePausa } from "../src/settingsMap.mjs";

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
  for (const id of ["razonSocial", "cuit", "domicilio", "contacto"])
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
  });
  assert.deepEqual(faltaParaVender(s).filter((f) => f.impide), []);
});

test("la tabla de medidas corporales ya no figura entre lo que falta para vender (decisión del local)", () => {
  const ids = faltaParaVender(leerSettings({})).map((f) => f.id);
  assert.equal(ids.includes("talles"), false);
});

test("un mail de contacto alcanza aunque no haya WhatsApp", () => {
  const conMail = leerSettings({ empresa: { emailContacto: "hola@mistral.com" } });
  assert.equal(
    faltaParaVender(conMail).some((f) => f.id === "contacto"),
    false,
  );
});

test("una zona de Correo que nunca tuvo plazo trae el de Paq.ar Clásico", () => {
  const s = leerSettings({
    envio: { zonas: [{ nombre: "La Plata", tipo: "correo" }] },
  });
  assert.equal(s.envio.zonas[0].plazo, PLAZO_CORREO_CLASICO);
  assert.equal(PLAZO_CORREO_CLASICO, "2 a 5 días hábiles");
});

test("una zona de reparto propio no inventa un plazo", () => {
  const s = leerSettings({
    envio: { zonas: [{ nombre: "Ensenada", tipo: "local" }] },
  });
  assert.equal("plazo" in s.envio.zonas[0], false);
});

test("dejar el plazo vacío a propósito se respeta y no vuelve solo", () => {
  // Es la única forma de no decir ningún plazo: si el vacío se confundiera con
  // "nunca se cargó", el de fábrica reaparecería cada vez que se guarda.
  const una = leerSettings({
    envio: { zonas: [{ nombre: "La Plata", tipo: "correo", plazo: "" }] },
  });
  assert.equal(una.envio.zonas[0].plazo, "");
  const otra = leerSettings(JSON.parse(JSON.stringify(una)));
  assert.equal(otra.envio.zonas[0].plazo, "");
  assert.equal(textoPlazoEnvio(otra.envio.zonas[0]), null);
});

test("el plazo cargado a mano se conserva, sin espacios de más y con tope de largo", () => {
  const s = leerSettings({
    envio: {
      zonas: [
        { nombre: "A", tipo: "correo", plazo: "  3 días hábiles  " },
        { nombre: "B", tipo: "local", plazo: "el mismo día" },
        { nombre: "C", tipo: "correo", plazo: "x".repeat(500) },
      ],
    },
  });
  assert.equal(s.envio.zonas[0].plazo, "3 días hábiles");
  assert.equal(s.envio.zonas[1].plazo, "el mismo día");
  assert.equal(s.envio.zonas[2].plazo.length, 80);
});

test("un plazo que no es texto se ignora y no rompe la zona", () => {
  for (const basura of [42, null, {}, ["2 días"], true]) {
    const s = leerSettings({
      envio: { zonas: [{ nombre: "La Plata", tipo: "correo", plazo: basura }] },
    });
    assert.equal(s.envio.zonas[0].plazo, PLAZO_CORREO_CLASICO);
  }
});

test("leer dos veces da lo mismo: guardar el panel no cambia los plazos", () => {
  const uno = leerSettings({
    envio: {
      zonas: [
        { nombre: "A", tipo: "correo" },
        { nombre: "B", tipo: "correo", plazo: "" },
        { nombre: "C", tipo: "local", plazo: "mañana" },
        { nombre: "D", tipo: "local" },
      ],
    },
  });
  assert.deepEqual(leerSettings(JSON.parse(JSON.stringify(uno))), uno);
});

test("el cliente lee que el plazo corre desde el despacho, no desde la compra", () => {
  assert.equal(
    textoPlazoEnvio({ tipo: "correo", plazo: "2 a 5 días hábiles" }),
    "Plazo estimado: 2 a 5 días hábiles desde que despachamos tu pedido.",
  );
  assert.equal(
    textoPlazoEnvio({ tipo: "local", plazo: "el mismo día" }),
    "Plazo estimado: el mismo día.",
  );
});

test("sin plazo no hay frase, venga como venga la zona", () => {
  for (const zona of [undefined, null, {}, { tipo: "correo" }, { tipo: "correo", plazo: "" }, { tipo: "correo", plazo: "   " }, { tipo: "local", plazo: 7 }])
    assert.equal(textoPlazoEnvio(zona), null, JSON.stringify(zona));
});

test("la zona de Correo de fábrica ya trae el plazo", () => {
  const correo = porDefecto().envio.zonas.filter((z) => z.tipo === "correo");
  assert.ok(correo.length > 0);
  for (const z of correo) assert.equal(z.plazo, PLAZO_CORREO_CLASICO);
});

test("Payway: apagado de fábrica, en Sandbox y sin clave", () => {
  const p = leerSettings({}).pago;
  assert.equal(p.paywayOnline, false);
  assert.equal(p.paywayClavePublica, "");
  assert.equal(p.paywayUrl, "https://developers-ventasonline.payway.com.ar/api/v2");
});

test("Payway: la clave pública sólo es letras y números; un texto raro se descarta", () => {
  const clave = "A".repeat(32);
  assert.equal(leerSettings({ pago: { paywayClavePublica: ` ${clave} ` } }).pago.paywayClavePublica, clave);
  assert.equal(leerSettings({ pago: { paywayClavePublica: "corta" } }).pago.paywayClavePublica, "");
  assert.equal(leerSettings({ pago: { paywayClavePublica: "https://x.com/" + clave } }).pago.paywayClavePublica, "");
  assert.equal(leerSettings({ pago: { paywayClavePublica: 12345 } }).pago.paywayClavePublica, "");
});

test("Payway: la tarjeta sólo viaja a una dirección https de Payway", () => {
  const prod = "https://ventasonline.payway.com.ar/api/v2";
  assert.equal(leerSettings({ pago: { paywayUrl: prod + "/" } }).pago.paywayUrl, prod);
  const sandbox = "https://developers-ventasonline.payway.com.ar/api/v2";
  for (const mala of ["http://ventasonline.payway.com.ar/api/v2", "https://evil.com/api/v2", "https://payway.com.ar.evil.com", "basura", "", null])
    assert.equal(leerSettings({ pago: { paywayUrl: mala } }).pago.paywayUrl, sandbox);
});

test("Payway: prenderlo exige un booleano de verdad", () => {
  assert.equal(leerSettings({ pago: { paywayOnline: true } }).pago.paywayOnline, true);
  assert.equal(leerSettings({ pago: { paywayOnline: "true" } }).pago.paywayOnline, false);
});

import { textoQuienPagaEnvio } from "../src/settingsMap.mjs";

test("el cliente lee quién paga el envío, con el monto de la configuración", () => {
  const s = leerSettings({ envio: { envioGratisDesde: 100000 } });
  const t = textoQuienPagaEnvio(s);
  assert.match(t, /lo paga quien compra/);
  assert.match(t, /100\.000/);
  assert.match(t, /lo pagamos nosotros/);
});

test("sin envío gratis, el texto sólo dice que lo paga quien compra", () => {
  const t = textoQuienPagaEnvio(leerSettings({ envio: { envioGratisDesde: 0 } }));
  assert.equal(t, "El envío lo paga quien compra.");
});

test("de fábrica el envío es gratis por encima de $99.999", () => {
  const s = leerSettings({});
  assert.equal(s.envio.envioGratisDesde, 100000);
  assert.equal(llegaAlEnvioGratis(s, 99999), false);
  assert.equal(llegaAlEnvioGratis(s, 100000), true);
});

import { textoNotaDeCambios } from "../src/settingsMap.mjs";

test("los días de cambio: 30 de fábrica, aparte del arrepentimiento, con tope razonable", () => {
  const s = leerSettings({});
  assert.equal(s.devoluciones.cambioDias, 30);
  assert.equal(s.devoluciones.dias, 10);
  assert.equal(leerSettings({ devoluciones: { cambioDias: 15 } }).devoluciones.cambioDias, 15);
  assert.equal(leerSettings({ devoluciones: { cambioDias: 0 } }).devoluciones.cambioDias, 30);
  assert.equal(leerSettings({ devoluciones: { cambioDias: 9999 } }).devoluciones.cambioDias, 90);
  assert.equal(leerSettings({ devoluciones: { cambioDias: "xx" } }).devoluciones.cambioDias, 30);
});

test("la nota de cambios de la ficha usa los días de la configuración", () => {
  const t = textoNotaDeCambios(leerSettings({ devoluciones: { cambioDias: 20 } }));
  assert.match(t, /20 días corridos/);
  assert.match(t, /sin uso/);
  assert.match(t, /etiquetas/);
});

test("las horas para que venza un pedido sin pagar: 48 de fábrica, 0 = nunca, con tope", () => {
  assert.equal(leerSettings({}).pedidos.vencenEnHoras, 48);
  assert.equal(leerSettings({ pedidos: { vencenEnHoras: 24 } }).pedidos.vencenEnHoras, 24);
  assert.equal(leerSettings({ pedidos: { vencenEnHoras: 0 } }).pedidos.vencenEnHoras, 0);
  assert.equal(leerSettings({ pedidos: { vencenEnHoras: -5 } }).pedidos.vencenEnHoras, 48);
  assert.equal(leerSettings({ pedidos: { vencenEnHoras: "mucho" } }).pedidos.vencenEnHoras, 48);
  assert.equal(leerSettings({ pedidos: { vencenEnHoras: 99999 } }).pedidos.vencenEnHoras, 720);
});

test("las localidades del envío: nombre y código de 4 dígitos; lo que no sirve o se repite, afuera", () => {
  assert.deepEqual(leerSettings({}).envio.localidades, []);
  const s = leerSettings({
    envio: {
      localidades: [
        { nombre: "City Bell", cp: "1896" },
        { nombre: "city bell", cp: "1896" },
        { nombre: "Ensenada", cp: "B1925" },
        { nombre: "Sin código", cp: "" },
        { nombre: "", cp: "1900" },
        { nombre: "Código raro", cp: "19" },
        "basura",
      ],
    },
  });
  assert.deepEqual(s.envio.localidades, [
    { nombre: "City Bell", cp: "1896" },
    { nombre: "Ensenada", cp: "1925" },
  ]);
  assert.deepEqual(leerSettings({ envio: { localidades: "no" } }).envio.localidades, []);
});

test("la pausa de la tienda: apagada de fábrica, con mensaje del local, y sin pausa no hay texto", () => {
  const base = leerSettings({});
  assert.equal(base.pausa.activa, false);
  assert.equal(textoDePausa(base), null);
  const s = leerSettings({ pausa: { activa: true, mensaje: "  Volvemos el 5 de enero  " } });
  assert.equal(s.pausa.activa, true);
  assert.equal(textoDePausa(s), "Volvemos el 5 de enero");
  // Pausada sin mensaje: hay uno genérico, nunca un cartel vacío.
  assert.match(textoDePausa(leerSettings({ pausa: { activa: true } })), /pausa/i);
  // Sólo `true` pausa: un texto o un número no.
  assert.equal(leerSettings({ pausa: { activa: "true" } }).pausa.activa, false);
  assert.equal(leerSettings({ pausa: "basura" }).pausa.activa, false);
  // Mensaje con tope.
  assert.equal(leerSettings({ pausa: { activa: true, mensaje: "x".repeat(900) } }).pausa.mensaje.length, 300);
});
