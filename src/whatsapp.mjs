/**
 * Enlaces de WhatsApp para consultar por una prenda.
 *
 * El número sale de la configuración del local y ya viene sólo con dígitos y
 * con código de país (ver `leerSettings`). Acá se vuelve a mirar igual: un
 * número que no es un teléfono (vacío, "123", basura) tiene que dar "sin
 * enlace" y no un `wa.me/123` que mande al cliente a un desconocido.
 */

/** Los teléfonos van de 10 dígitos (sin código de país) a 15 (tope internacional). */
const MIN_DIGITOS = 10;
const MAX_DIGITOS = 15;

/**
 * El enlace de WhatsApp al número, con el mensaje ya escrito. Devuelve `null`
 * si el número no es válido: quien llama no muestra el botón.
 */
export function enlaceWhatsapp(numero, mensaje) {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return null;
  const texto = typeof mensaje === "string" ? mensaje.trim() : "";
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/**
 * El mensaje que sale escrito cuando alguien consulta por una prenda. Lleva el
 * nombre (que en el catálogo incluye el código) y el precio que el cliente ve,
 * para que quien atiende sepa de cuál se trata sin preguntar.
 *
 * `precio` y `antes` son textos ya armados ("$ 32.900"): cómo se escribe la
 * plata lo decide la pantalla. `antes` es el precio de antes de una oferta; con
 * él, el mensaje dice de cuánto era y quien atiende ve el descuento.
 */
export function mensajeConsultaPrenda({ nombre, marca, precio, antes }) {
  const limpio = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const prenda = limpio(nombre);
  const detalle = [
    limpio(marca) && `(${limpio(marca)})`,
    limpio(precio) && `— ${limpio(precio)}${limpio(antes) && limpio(precio) ? ` (antes ${limpio(antes)})` : ""}`,
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "Hola Zero Indumentaria, quiero consultar por esta prenda:",
    `• ${[prenda, detalle].filter(Boolean).join(" ")}`,
    "¿Tienen disponibilidad y en qué talles?",
  ].join("\n");
}
