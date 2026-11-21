// Lo que se le pide al cliente además de las prendas: si quiere factura (y a qué mail mandarla) y, en los envíos,
// adónde. Las mismas reglas las aplica la base (`crear_pedido`): la pantalla avisa antes, pero la que manda es la
// base, porque es la que guarda el pedido.

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Un texto recortado a un largo máximo y sin espacios de más. */
function texto(valor, max) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** El mail como lo guardamos: sin espacios y en minúsculas. Vacío si no es un mail. */
export function mailLimpio(valor) {
  const m = texto(valor, 120).toLowerCase();
  return MAIL.test(m) ? m : "";
}

/**
 * La dirección de entrega tal como se guarda: sólo los campos que usamos, recortados.
 * @returns { calle, numero, piso, localidad, cp, referencia }
 */
export function limpiarDireccion(d) {
  const x = d && typeof d === "object" ? d : {};
  const cp = String(x.cp ?? "").replace(/\D/g, "").slice(0, 4);
  return {
    calle: texto(x.calle, 80),
    numero: texto(x.numero, 10),
    piso: texto(x.piso, 20),
    localidad: texto(x.localidad, 60),
    cp,
    referencia: texto(x.referencia, 140),
  };
}

/**
 * ¿Faltan datos para tomar el pedido? Devuelve el aviso para el cliente, o `null` si está todo.
 *
 * - Con factura: el mail es obligatorio (ahí se la mandamos). Sin factura: el mail es opcional, pero si lo escribió
 *   tiene que ser un mail.
 * - Con envío a domicilio: calle, número, localidad y código postal (4 dígitos) son obligatorios.
 */
export function faltaEnElPedido({ factura, email, entrega, direccion } = {}) {
  const mail = texto(email, 120);
  if (factura && !mailLimpio(mail)) return "Para mandarte la factura necesitamos tu mail.";
  if (mail && !mailLimpio(mail)) return "Ese mail no parece un mail. Revisalo.";
  if (entrega === "shipping") {
    const d = limpiarDireccion(direccion);
    if (!d.calle) return "Escribí la calle de tu domicilio.";
    if (!d.numero) return "Escribí el número de tu domicilio (o \"s/n\").";
    if (!d.localidad) return "Escribí tu localidad.";
    if (d.cp.length !== 4) return "Escribí los 4 números de tu código postal.";
  }
  return null;
}

/** La dirección en una línea, para el panel y para copiar a MiCorreo. Vacío si no hay. */
export function textoDireccion(direccion) {
  const d = limpiarDireccion(direccion);
  if (!d.calle) return "";
  const calle = `${d.calle} ${d.numero}`.trim();
  const partes = [calle, d.piso && `piso/depto ${d.piso}`, d.localidad && `${d.localidad}${d.cp ? ` (CP ${d.cp})` : ""}`].filter(Boolean);
  return partes.join(", ") + (d.referencia ? `. Referencia: ${d.referencia}` : "");
}
