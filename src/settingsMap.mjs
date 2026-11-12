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

import { ENTORNO_SANDBOX, urlPaywayValida } from "../supabase/functions/_shared/payway.mjs";

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
    /**
     * Cobrar online el monto exacto de la bolsa con Mercado Pago.
     *
     * Esto no alcanza con prenderlo: además hay que cargar el token de la
     * cuenta como secreto en Supabase (MP_ACCESS_TOKEN). Sin el token, la
     * tienda avisa que no está configurado y sigue con el alias de siempre.
     */
    mercadoPagoOnline: false,
    /**
     * Cobrar con tarjeta por Payway. Apagado de fábrica: necesita las claves de Payway
     * (la pública acá, la privada como secreto en Supabase) y casos de prueba aprobados.
     */
    paywayOnline: false,
    paywayClavePublica: "",
    paywayUrl: ENTORNO_SANDBOX,
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
        plazo: "2 a 5 días hábiles",
      },
    ],
    /** Desde este monto de prendas, el envío va sin cargo. 0 = nunca. */
    envioGratisDesde: 100000,
  },
  /**
   * Quién vende. El consumidor tiene que poder saberlo antes de comprar:
   * nombre o razón social, CUIT y domicilio. Sin esto cargado, el sitio no
   * está en condiciones de vender.
   */
  empresa: {
    razonSocial: "",
    cuit: "",
    domicilioLegal: "",
    emailContacto: "",
  },
  /**
   * La tabla de medidas corporales. La Ley 27.521 (SUNITI) la exige en un
   * lugar de fácil acceso y claramente identificable, también en las ventas
   * electrónicas. Las medidas van en centímetros y las carga el local: no se
   * inventan acá.
   */
  talles: {
    filas: [],
    nota: "",
  },
  devoluciones: {
    /** Días corridos del derecho de arrepentimiento. La ley dice diez. */
    dias: 10,
    /**
     * Días corridos para pedir un cambio por talle o color, contados desde que el
     * cliente recibe el pedido. Es una cortesía del local, no el derecho de
     * arrepentimiento: por eso es otro número y no tiene el piso de la ley.
     */
    cambioDias: 30,
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

/**
 * Lo que informa el Correo Argentino para Paq.ar Clásico: "2 a 5 días hábiles
 * según origen y destino desde su día de imposición". Se cuenta desde que el
 * paquete entra al Correo, no desde que el cliente compra: por eso el texto que
 * ve el cliente dice "desde que despachamos tu pedido".
 *
 * Es el rango general del servicio. La tabla del Correo da plazos más finos por
 * ciudad (de 1 a 5 días), pero no trae Ensenada ni Berisso, así que no se
 * inventan: el dueño puede ajustar el plazo de cada zona desde el panel.
 */
export const PLAZO_CORREO_CLASICO = "2 a 5 días hábiles";
const PLAZO_MAXIMO = 80;

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
    const tipo = TIPOS.includes(z?.tipo) ? z.tipo : "local";
    // Si el dueño lo dejó vacío a propósito, se respeta: es la forma de no
    // decir ningún plazo. Si nunca se cargó, las zonas de Correo traen el de
    // fábrica y las de reparto propio no dicen nada.
    const plazoPuesto =
      typeof z?.plazo === "string"
        ? z.plazo.trim().slice(0, PLAZO_MAXIMO)
        : undefined;
    const plazo =
      plazoPuesto !== undefined
        ? plazoPuesto
        : tipo === "correo"
          ? PLAZO_CORREO_CLASICO
          : undefined;
    limpias.push({
      id: texto(z?.id).trim() || nombre.toLowerCase().replace(/\s+/g, "-"),
      nombre,
      tipo,
      ...(puesto === undefined ? {} : { costo: puesto }),
      ...(texto(z?.nota) ? { nota: texto(z.nota) } : {}),
      ...(plazo === undefined || (plazo === "" && tipo !== "correo")
        ? {}
        : { plazo }),
    });
  }
  return limpias;
}

/**
 * Las filas de la tabla de medidas.
 *
 * Una fila sin talle no sirve, y una medida vacía se muestra vacía en vez de
 * inventarse. Acá no hay valores por defecto a propósito: las medidas las
 * carga el local.
 */
function filasDeTalles(valor) {
  if (!Array.isArray(valor)) return [];
  const filas = [];
  for (const f of valor) {
    const talle = texto(f?.talle).trim();
    if (!talle) continue;
    // Dos filas con el mismo talle serían dos medidas distintas para lo mismo.
    if (filas.some((x) => x.talle === talle)) continue;
    filas.push({
      talle,
      pecho: texto(f?.pecho).trim(),
      cintura: texto(f?.cintura).trim(),
      cadera: texto(f?.cadera).trim(),
    });
  }
  return filas;
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
  const emp = d.empresa && typeof d.empresa === "object" ? d.empresa : {};
  const tal = d.talles && typeof d.talles === "object" ? d.talles : {};
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
      mercadoPagoOnline: booleano(
        pago.mercadoPagoOnline,
        base.pago.mercadoPagoOnline,
      ),
      paywayOnline: booleano(pago.paywayOnline, base.pago.paywayOnline),
      // Una clave son letras y números. Cualquier otra cosa (un espacio, una URL
      // pegada por error) se descarta: sin clave válida, Payway no se ofrece.
      paywayClavePublica: /^[A-Za-z0-9]{16,64}$/.test(texto(pago.paywayClavePublica).trim())
        ? texto(pago.paywayClavePublica).trim()
        : "",
      // A esta dirección viajan los datos de la tarjeta: sólo Payway, sólo https.
      paywayUrl: urlPaywayValida(pago.paywayUrl) || base.pago.paywayUrl,
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
    empresa: {
      razonSocial: texto(emp.razonSocial).trim(),
      // Solo dígitos: el CUIT se muestra formateado aparte.
      cuit: texto(emp.cuit).replace(/\D/g, "").slice(0, 11),
      domicilioLegal: texto(emp.domicilioLegal).trim(),
      emailContacto: texto(emp.emailContacto).trim(),
    },
    talles: {
      filas: filasDeTalles(tal.filas),
      nota: texto(tal.nota),
    },
    devoluciones: {
      dias: Math.max(10, entero(dev.dias, base.devoluciones.dias)),
      cambioDias: Math.min(90, Math.max(1, entero(dev.cambioDias, base.devoluciones.cambioDias) || base.devoluciones.cambioDias)),
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

/**
 * La frase del plazo para el checkout, o `null` si la zona no dice ninguno.
 *
 * En Correo el plazo corre desde que el paquete entra al Correo, no desde la
 * compra, y el cliente tiene que poder entenderlo: por eso lo aclara.
 */
export function textoPlazoEnvio(zona) {
  const plazo = texto(zona?.plazo).trim();
  if (!plazo) return null;
  return zona?.tipo === "correo"
    ? `Plazo estimado: ${plazo} desde que despachamos tu pedido.`
    : `Plazo estimado: ${plazo}.`;
}

/**
 * Quién paga el envío, dicho como lo lee el cliente antes de comprar.
 *
 * El envío lo paga quien compra; pasado el monto del envío gratis lo paga el local. El monto
 * sale de la configuración (el mismo que usa `costoEnvio` y la base), así el texto nunca
 * promete un umbral distinto del que se cobra.
 */
export function textoQuienPagaEnvio(settings) {
  const gratis = settings?.envio?.envioGratisDesde || 0;
  const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  return gratis > 0
    ? `El envío lo paga quien compra. En compras de ${pesos.format(gratis)} o más (sin contar el envío) lo pagamos nosotros.`
    : "El envío lo paga quien compra.";
}

/** La nota corta de cambios que se ve en cada ficha de producto, antes de comprar. */
export function textoNotaDeCambios(settings) {
  const dias = settings?.devoluciones?.cambioDias || 30;
  return `Cambios por talle o color: hasta ${dias} días corridos desde que recibís el pedido, con la prenda sin uso, con sus etiquetas y en su bolsa original.`;
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

/** El CUIT con los guiones donde van: 30-71234567-0. */
export function cuitFormateado(cuit) {
  const n = texto(cuit).replace(/\D/g, "");
  if (n.length !== 11) return n;
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
}

/**
 * Qué le falta al sitio para estar en condiciones de vender.
 *
 * No es una opinión de diseño: cada punto sale de algo que la ley argentina
 * le exige a quien vende por internet. Lo que devuelve esta función es lo que
 * el panel muestra como pendiente, y es a propósito que la mayoría sean datos
 * del local: el sistema no puede inventar un CUIT ni una tabla de medidas.
 *
 * `impide` marca lo que no debería estar sin resolver el día que se abra la
 * tienda de verdad; el resto es recomendable.
 */
export function faltaParaVender(settings) {
  const s = settings || {};
  const emp = s.empresa || {};
  const faltan = [];
  if (!emp.razonSocial)
    faltan.push({
      id: "razonSocial",
      impide: true,
      que: "El nombre o razón social de quien vende",
      porque:
        "El consumidor tiene que poder saber a quién le compra antes de comprar (Ley 24.240, art. 4).",
    });
  if (emp.cuit.length !== 11)
    faltan.push({
      id: "cuit",
      impide: true,
      que: "El CUIT",
      porque: "Identifica al vendedor y va junto con el nombre.",
    });
  if (!emp.domicilioLegal)
    faltan.push({
      id: "domicilio",
      impide: true,
      que: "El domicilio",
      porque:
        "Es adonde el consumidor puede dirigir un reclamo, y adonde se mandan las devoluciones.",
    });
  if (!s.whatsapp && !emp.emailContacto)
    faltan.push({
      id: "contacto",
      impide: true,
      que: "Un contacto para consultas y reclamos",
      porque:
        "La ley pide un teléfono o un medio electrónico de atención publicado en el sitio.",
    });
  // Una fila sin ninguna medida es un talle anunciado y nada más, que es
  // justamente lo que la ley de talles vino a evitar. Por eso no alcanza con
  // que la tabla tenga filas: tienen que tener medidas.
  if (!(s.talles?.filas || []).some((f) => f.pecho || f.cintura || f.cadera))
    faltan.push({
      id: "talles",
      impide: true,
      que: "La tabla de medidas corporales",
      porque:
        "La Ley 27.521 (SUNITI) la exige en un lugar de fácil acceso también en la venta por internet. Son medidas: no se pueden inventar.",
    });
  if (!s.direccion?.horarios)
    faltan.push({
      id: "horarios",
      impide: false,
      que: "Los horarios del local",
      porque: "Hace falta para que el cliente sepa cuándo puede retirar.",
    });
  return faltan;
}
