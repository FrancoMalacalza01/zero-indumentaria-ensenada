import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTORNO_PRODUCCION, ENTORNO_SANDBOX, MEDIOS, binDe, centavos, codigoValido, cuerpoDePago, cuerpoDeToken, dniValido, idTransaccion,
  interpretarPago, medioValido, mensajeDeRechazo, tarjetaValida, urlPaywayValida, vencimiento,
} from "../supabase/functions/_shared/payway.mjs";

test("el número de tarjeta se valida con el dígito verificador", () => {
  assert.equal(tarjetaValida("4507 9900 0000 4905"), true); // tarjeta de prueba de Payway
  assert.equal(tarjetaValida("4507990000004906"), false);
  assert.equal(tarjetaValida("1234"), false);
  assert.equal(tarjetaValida(""), false);
  assert.equal(tarjetaValida(undefined), false);
  assert.equal(binDe("4507 9900 0000 4905"), "450799");
});

test("el vencimiento acepta 12/29 y 12/2029 y rechaza lo vencido o roto", () => {
  const hoy = new Date(2026, 10, 10); // noviembre de 2026
  assert.deepEqual(vencimiento("12/29", hoy), { mes: "12", anio: "29" });
  assert.deepEqual(vencimiento("1/2030", hoy), { mes: "01", anio: "30" });
  assert.deepEqual(vencimiento("11/26", hoy), { mes: "11", anio: "26" }); // vale hasta fin de mes
  assert.equal(vencimiento("10/26", hoy), null);
  assert.equal(vencimiento("13/29", hoy), null);
  assert.equal(vencimiento("12-29", hoy)?.anio, "29");
  assert.equal(vencimiento("hola", hoy), null);
});

test("código de seguridad y documento", () => {
  assert.equal(codigoValido("123"), true);
  assert.equal(codigoValido("1234"), true);
  assert.equal(codigoValido("12"), false);
  assert.equal(codigoValido("12a"), false);
  assert.equal(dniValido("38555826"), true);
  assert.equal(dniValido("38.555.826"), false);
  assert.equal(dniValido("123"), false);
});

test("sólo se aceptan direcciones https de Payway: ahí viajan los datos de la tarjeta", () => {
  const ok = "https://developers-ventasonline.payway.com.ar/api/v2";
  assert.equal(urlPaywayValida(ok), ok);
  assert.equal(urlPaywayValida(ENTORNO_SANDBOX), ENTORNO_SANDBOX);
  assert.equal(urlPaywayValida(ENTORNO_PRODUCCION), ENTORNO_PRODUCCION);
  assert.equal(urlPaywayValida(ok + "/"), ok);
  assert.equal(urlPaywayValida("http://developers-ventasonline.payway.com.ar/api/v2"), "");
  assert.equal(urlPaywayValida("https://payway.com.ar.evil.com/api/v2"), "");
  assert.equal(urlPaywayValida("https://evilpayway.com.ar/api/v2"), "");
  assert.equal(urlPaywayValida("https://user:pass@payway.com.ar/api/v2"), "");
  assert.equal(urlPaywayValida("javascript:alert(1)"), "");
  assert.equal(urlPaywayValida(""), "");
});

test("el cuerpo del token no lleva nada de más y limpia el número", () => {
  const c = cuerpoDeToken({
    numero: "4507 9900 0000 4905",
    vencimiento: { mes: "12", anio: "29" },
    codigo: " 123 ",
    titular: "Jose Perez",
    dni: "38555826",
  });
  assert.deepEqual(c, {
    card_number: "4507990000004905",
    card_expiration_month: "12",
    card_expiration_year: "29",
    security_code: "123",
    card_holder_name: "Jose Perez",
    card_holder_identification: { type: "dni", number: "38555826" },
  });
});

test("el identificador de operación es alfanumérico, de hasta 40 y distinto en cada intento", () => {
  const a = idTransaccion("M-00007", 1_700_000_000_000);
  const b = idTransaccion("M-00007", 1_700_000_005_000);
  assert.match(a, /^[A-Za-z0-9]{1,40}$/);
  assert.notEqual(a, b);
  assert.ok(idTransaccion("x".repeat(200)).length <= 40);
});

test("el importe va en centavos enteros y un monto roto da 0", () => {
  assert.equal(centavos(1000), 100000);
  assert.equal(centavos(35900.5), 3590050);
  assert.equal(centavos(0.1 + 0.2), 30); // sin errores de coma flotante
  assert.equal(centavos(0), 0);
  assert.equal(centavos(-5), 0);
  assert.equal(centavos("abc"), 0);
  assert.equal(centavos(1e12), 0);
});

test("el cuerpo del pago sigue la documentación (NO PCI, pago simple, una cuota)", () => {
  const c = cuerpoDePago({ idTransaccion: "M00007Tabc", token: "tok", medio: "1", bin: "450799", total: 50, descripcion: "Pedido M-00007" });
  assert.deepEqual(c, {
    site_transaction_id: "M00007Tabc",
    token: "tok",
    payment_method_id: 1,
    bin: "450799",
    amount: 5000,
    currency: "ARS",
    installments: 1,
    payment_type: "single",
    sub_payments: [],
    description: "Pedido M-00007",
  });
  assert.equal("card_data" in c, false);
});

test("medios de pago: sólo los ids confirmados", () => {
  assert.deepEqual(MEDIOS.map((m) => m.id), [1, 31]);
  assert.equal(medioValido("1"), true);
  assert.equal(medioValido(31), true);
  assert.equal(medioValido(15), false);
  assert.equal(medioValido("1; drop"), false);
});

test("aprobado: se da por pagado sólo si Payway dice approved", () => {
  const r = interpretarPago(200, { id: 15523975, status: "approved", status_details: { error: null } });
  assert.deepEqual(r, { estado: "aprobado", paymentId: "15523975", codigo: null, mensaje: "Pago aprobado." });
});

test("rechazado: fondos insuficientes y denegada, con el mensaje para el cliente", () => {
  const f = interpretarPago(402, { id: 7, status: "rejected", status_details: { error: { type: "insufficient_amount", reason: { id: 51, description: "FONDOS INSUFICIENTES" } } } });
  assert.equal(f.estado, "rechazado");
  assert.equal(f.codigo, 51);
  assert.match(f.mensaje, /fondos/i);
  const d = interpretarPago(200, { id: 8, status: "rejected", status_details: { error: { reason: { id: 5 } } } });
  assert.equal(d.estado, "rechazado");
  assert.match(d.mensaje, /denegó/i);
  // un 402 sin cuerpo también es un rechazo, nunca un pago
  assert.equal(interpretarPago(402, null).estado, "rechazado");
  assert.match(mensajeDeRechazo(9999), /rechazó/);
});

test("un estado que no se entiende NO se da por pagado", () => {
  assert.equal(interpretarPago(200, { id: 1, status: "review" }).estado, "pendiente");
  assert.equal(interpretarPago(200, { id: 1, status: "PREAPPROVED" }).estado, "pendiente");
  assert.equal(interpretarPago(200, { id: 1, status: "APPROVED" }).estado, "aprobado");
  assert.equal(interpretarPago(200, {}).estado, "error");
  assert.equal(interpretarPago(401, { error: "Invalid authentication credentials" }).estado, "error");
  assert.equal(interpretarPago(500, null).estado, "error");
  assert.equal(interpretarPago(200, "texto").estado, "error");
});

test("el mensaje para el cliente nunca trae estados técnicos de Payway", () => {
  for (const r of [interpretarPago(401, { error: "x" }), interpretarPago(200, { status: "review" }), interpretarPago(402, null)])
    assert.doesNotMatch(r.mensaje, /status|rejected|approved|apikey|token/i);
});
