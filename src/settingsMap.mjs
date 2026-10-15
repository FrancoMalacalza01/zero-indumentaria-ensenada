/**
 * La configuración del local: lo que el dueño carga desde el panel.
 *
 * Vive sin React y sin red a propósito. Dos razones:
 *
 * 1. Lo que llega de la base es un jsonb que puede venir vacío, a medias o
 *    con basura de una versión anterior. Esta capa lo convierte en algo que
 *    la tienda puede usar sin preguntarse nada, y eso se puede probar sin
 *    navegador.
 * 2. El costo del envío lo calculan dos lados: acá, para mostrárselo al
 *    cliente, y la función `crear_pedido` de la base, que es la que manda.
 *    Tener la cuenta en un archivo que se puede probar es lo que mantiene a
 *    los dos diciendo lo mismo.
 */

/** Lo que trae el sitio cuando el dueño todavía no cargó nada. */
export const porDefecto = () => ({
  // Formato internacional sin el "+", por ejemplo "5492211234567". Vacío, el
  // pedido se abre en WhatsApp y la persona elige el contacto a mano.
  whatsapp: "",
  direccion: {
    calle: "La Merced 327",
    ciudad: "Ensenada",
    provincia: "Buenos Aires",
    cp: "1925",
    // Sin inventar: se completa cuando el dueño los confirme.
    horarios: "",
  },
  pago: {
    mercadoPagoUrl: "",
    mercadoPagoAlias: "",
    cuentaDniAlias: "",
    // Puede ser una URL o la imagen del QR cargada desde el panel.
    cuentaDniQr: "",
    banco: { nombre: "", titular: "", alias: "", cbu: "" },
    efectivo: true,
    debito: true,
    credito: true,
    /** Hasta cuántas cuotas sin interés banca el local. 0 = ninguna. */
    cuotasSinInteres: 0,
    /** Hasta cuántas cuotas acepta el posnet, con interés del banco. */
    cuotasMaximas: 0,
    /**
     * Descuento por pagar en efectivo o por transferencia, en por ciento.
     *
     * Va como descuento y no como recargo por tarjeta a propósito: cobrar
     * más por pagar con tarjeta está prohibido (Ley 25.065, art. 37), y una
     * promo por pago en efectivo es la forma en que se hace.
     */
    descuentoContado: 0,
  },
  envio: {
    zonas: [
      { id: "ensenada", nombre: "Ensenada", tipo: "local" },
      { id: "berisso", nombre: "Berisso", tipo: "local" },
      { id: "la-plata", nombre: "La Plata", tipo: "local" },
      {
        id: "bsas",
        nombre: "Resto de la Provincia de Buenos Aires",
        tipo: "correo",
        nota: "Por Correo Argentino. El costo depende del peso y del código postal.",
      },
    ],
    /** Desde este monto de prendas, el envío va sin cargo. 0 = nunca. */
    envioGratisDesde: 99999,
  },
  devoluciones: {
    /** Días corridos del derecho de arrepentimiento. La ley dice diez. */
    dias: 10,
    /**
     * Desde este monto, el cambio por talle o color lo paga el local.
     * Abajo de eso lo paga el cliente. No aplica al arrepentimiento ni a una
     * prenda fallada: esos los paga el local siempre, lo diga esto o no.
     */
    cambioGratisDesde: 99999,
    /** Dónde se reciben las devoluciones. Vacío = la dirección del local. */
    direccion: "",
    notas: "",
  },
});

const TIPOS = ["local", "correo"];

function texto(valor, porDefectoValor = "") {
  return typeof valor === "string" ? valor : porDefectoValor;
}

function entero(valor, porDefectoValor = 0) {
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) && n >= 0 ? n : porDefectoValor;
}

/** Un costo sin cargar no es cero: es "todavía no sabemos". */
function costo(valor) {
  if (valor === null || valor === undefined || valor === "") return undefined;
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function booleano(valor, porDefectoValor) {
  return typeof valor === "boolean" ? valor : porDefectoValor;
}

function zonas(valor, base) {
  if (!Array.isArray(valor)) return base;
  const limpias = [];
  for (const z of valor) {
    const nombre = texto(z?.nombre).trim();
    if (!nombre) continue;
    // Dos zonas con el mismo nombre harían que el cliente elija una y la base
    // cobre la otra: la base busca por nombre.
    if (limpias.some((x) => x.nombre === nombre)) continue;
    const puesto = costo(z?.costo);
    limpias.push({
      id: texto(z?.id).trim() || nombre.toLowerCase().replace(/\s+/g, "-"),
      nombre,
      tipo: TIPOS.includes(z?.tipo) ? z.tipo : "local",
      ...(puesto === undefined ? {} : { costo: puesto }),
      ...(texto(z?.nota) ? { nota: texto(z.nota) } : {}),
    });
  }
  return limpias;
}

/**
 * Convierte lo que haya guardado en la base en una configuración usable.
 *
 * Nunca falla: lo que no entiende lo reemplaza por el valor de fábrica. Una
 * configuración a medias no puede dejar la tienda sin formas de pago ni sin
 * zonas de envío.
 */
export function leerSettings(datos) {
  const base = porDefecto();
  const d = datos && typeof datos === "object" ? datos : {};
  const pago = d.pago && typeof d.pago === "object" ? d.pago : {};
  const banco = pago.banco && typeof pago.banco === "object" ? pago.banco : {};
  const envio = d.envio && typeof d.envio === "object" ? d.envio : {};
  const dev =
    d.devoluciones && typeof d.devoluciones === "object" ? d.devoluciones : {};
  const dir =
    d.direccion && typeof d.direccion === "object" ? d.direccion : {};
  return {
    // Solo dígitos: un número con espacios o guiones rompe el link de WhatsApp.
    whatsapp: texto(d.whatsapp).replace(/\D/g, ""),
    direccion: {
      calle: texto(dir.calle, base.direccion.calle),
      ciudad: texto(dir.ciudad, base.direccion.ciudad),
      provincia: texto(dir.provincia, base.direccion.provincia),
      cp: texto(dir.cp, base.direccion.cp),
      horarios: texto(dir.horarios),
    },
    pago: {
      mercadoPagoUrl: texto(pago.mercadoPagoUrl),
      mercadoPagoAlias: texto(pago.mercadoPagoAlias),
      cuentaDniAlias: texto(pago.cuentaDniAlias),
      cuentaDniQr: texto(pago.cuentaDniQr),
      banco: {
        nombre: texto(banco.nombre),
        titular: texto(banco.titular),
        alias: texto(banco.alias),
        cbu: texto(banco.cbu),
      },
      efectivo: booleano(pago.efectivo, base.pago.efectivo),
      debito: booleano(pago.debito, base.pago.debito),
      credito: booleano(pago.credito, base.pago.credito),
      cuotasSinInteres: entero(pago.cuotasSinInteres),
      cuotasMaximas: entero(pago.cuotasMaximas),
      // Un descuento mayor al 90% es un error de tipeo, no una promo.
      descuentoContado: Math.min(90, entero(pago.descuentoContado)),
    },
    envio: {
      zonas: zonas(envio.zonas, base.envio.zonas),
      envioGratisDesde: entero(
        envio.envioGratisDesde,
        base.envio.envioGratisDesde,
      ),
    },
    devoluciones: {
      dias: Math.max(10, entero(dev.dias, base.devoluciones.dias)),
      cambioGratisDesde: entero(
        dev.cambioGratisDesde,
        base.devoluciones.cambioGratisDesde,
      ),
      direccion: texto(dev.direccion),
      notas: texto(dev.notas),
    },
  };
}

/**
 * Cuánto sale el envío, en pesos.
 *
 * `null` significa "todavía no está definido": la zona existe pero no tiene
 * costo cargado, y el checkout dice que se coordina por WhatsApp en vez de
 * inventar un número. La base hace exactamente esta misma cuenta.
 *
 * El umbral del envío gratis se mira contra el monto de las prendas, no
 * contra el total: si no, el propio envío ayudaría a alcanzarlo.
 */
export function costoEnvio(settings, nombreZona, subtotal) {
  const zona = (settings?.envio?.zonas || []).find(
    (z) => z.nombre === nombreZona,
  );
  if (!zona) return null;
  const gratis = settings.envio.envioGratisDesde;
  if (gratis > 0 && subtotal >= gratis) return 0;
  return zona.costo === undefined ? null : zona.costo;
}

/** true si la compra ya pasó el monto desde el que el envío va sin cargo. */
export function llegaAlEnvioGratis(settings, subtotal) {
  const gratis = settings?.envio?.envioGratisDesde || 0;
  return gratis > 0 && subtotal >= gratis;
}

/** Cuánto falta para el envío gratis, o 0 si ya llegó o no existe el beneficio. */
export function faltaParaEnvioGratis(settings, subtotal) {
  const gratis = settings?.envio?.envioGratisDesde || 0;
  if (!gratis || subtotal >= gratis) return 0;
  return gratis - subtotal;
}
