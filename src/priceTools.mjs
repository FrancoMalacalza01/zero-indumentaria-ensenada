/**
 * Herramientas para cambiar precios en el panel.
 *
 * Es la parte con cuentas, y por eso está aparte de la pantalla y con pruebas:
 * un porcentaje mal aplicado se cobra mal. Todo es puro: recibe datos y
 * devuelve datos nuevos, no toca el estado ni la red.
 *
 * Hay dos tipos de artículo y se cambian distinto:
 * - **Tienda** (`db`): los productos de la base. El precio vive en el producto.
 * - **Hombre** (`men`): el catálogo de las marcas. El precio propio vive en la
 *   lista de excepciones (`menOverrides.mjs`) y `null` es "el de la marca".
 */
import {
  PRECIO_MAXIMO,
  cambiarAjuste,
  leerPrecio,
} from "./menOverrides.mjs";
import { hastaValido } from "./ofertas.mjs";

export const OPERACIONES = [
  { id: "subir", etiqueta: "Subir un porcentaje", unidad: "%" },
  { id: "bajar", etiqueta: "Bajar un porcentaje", unidad: "%" },
  { id: "oferta", etiqueta: "Poner en oferta (descuento %)", unidad: "%" },
  { id: "sumar", etiqueta: "Sumar un monto", unidad: "$" },
  { id: "restar", etiqueta: "Restar un monto", unidad: "$" },
  { id: "fijar", etiqueta: "Fijar un precio", unidad: "$" },
];

export const REDONDEOS = [
  { id: "ninguno", etiqueta: "Sin redondeo" },
  { id: "100", etiqueta: "A los $100" },
  { id: "500", etiqueta: "A los $500" },
  { id: "1000", etiqueta: "A los $1.000" },
  { id: "900", etiqueta: "Terminado en 900" },
];

/** Cuántos cambios se pueden deshacer. */
export const LIMITE_HISTORIAL = 30;

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

/**
 * Redondea un precio. "Terminado en 900" lleva al $X.900 más cercano
 * (32.500 → 32.900, 32.300 → 31.900) y nunca baja de $900.
 */
export function redondear(valor, modo) {
  if (modo === "900")
    return Math.max(900, Math.round((valor + 100) / 1000) * 1000 - 100);
  const paso = Number(modo);
  if (Number.isFinite(paso) && paso > 0) return Math.round(valor / paso) * paso;
  return Math.round(valor);
}

/**
 * Lee el número de una regla escrita a mano. Los porcentajes admiten coma o
 * punto decimal ("7,5"); los montos son pesos enteros ("5.000").
 */
export function leerRegla(op, entrada) {
  const unidad = OPERACIONES.find((o) => o.id === op)?.unidad;
  if (!unidad) return { ok: false, error: "Elegí qué querés hacer." };
  if (unidad === "$") return leerPrecio(entrada);
  const texto = String(entrada ?? "").replace(/[%\s]/g, "").replace(",", ".");
  if (!texto) return { ok: false, error: "Poné el porcentaje." };
  if (!/^\d+(\.\d+)?$/.test(texto))
    return { ok: false, error: "El porcentaje sólo puede llevar números." };
  const valor = Number(texto);
  if (!(valor > 0)) return { ok: false, error: "El porcentaje tiene que ser mayor a cero." };
  if (op === "bajar" && valor >= 100)
    return { ok: false, error: "Bajar el 100% o más dejaría el precio en cero." };
  if (op === "oferta" && valor >= 100)
    return { ok: false, error: "Un descuento del 100% o más dejaría el precio en cero." };
  if (valor > 1000)
    return { ok: false, error: "Ese porcentaje es demasiado alto. ¿Es correcto?" };
  return { ok: true, value: valor };
}

/**
 * El precio nuevo de un artículo según una regla. No corta ni inventa: si la
 * cuenta da un precio imposible (cero, negativo, más del máximo) lo dice, y esa
 * prenda no se toca.
 */
export function calcularPrecio(actual, op, valor, redondeo = "ninguno") {
  if (!Number.isInteger(actual) || actual <= 0)
    return { ok: false, error: "No tiene un precio actual." };
  let crudo;
  switch (op) {
    case "subir":
      crudo = actual * (1 + valor / 100);
      break;
    case "bajar":
    case "oferta":
      // Una oferta es una baja de precio; lo que la distingue es que además
      // guarda el precio anterior para mostrarlo tachado (ver `vistaPrevia`).
      crudo = actual * (1 - valor / 100);
      break;
    case "sumar":
      crudo = actual + valor;
      break;
    case "restar":
      crudo = actual - valor;
      break;
    case "fijar":
      crudo = valor;
      break;
    default:
      return { ok: false, error: "Elegí qué querés hacer." };
  }
  if (!Number.isFinite(crudo)) return { ok: false, error: "La cuenta no da un número." };
  const final = redondear(crudo, redondeo);
  if (!(final > 0)) return { ok: false, error: "Quedaría en cero o menos." };
  if (final > PRECIO_MAXIMO) return { ok: false, error: "Pasa el precio máximo." };
  return { ok: true, value: final };
}

/** Cuánto cambió, en por ciento entero: 32.900 → 36.200 es +10. */
export function variacion(antes, despues) {
  if (!(antes > 0) || !Number.isFinite(despues)) return 0;
  return Math.round(((despues - antes) / antes) * 100);
}

/**
 * El descuento de una oferta, en por ciento entero positivo: de 30.000 a 24.000
 * es 20. Es 0 si no hay oferta (sin anterior, o el anterior no es mayor).
 */
export function descuento(anterior, precio) {
  if (!(anterior > 0) || !(precio > 0) || anterior <= precio) return 0;
  return Math.round((1 - precio / anterior) * 100);
}

/**
 * Cómo quedaría cada artículo si se aplicara la regla, sin aplicarla.
 * `items` son `{ key, precio, base? }`. Es lo que se le muestra al dueño antes
 * de confirmar un cambio que puede tocar cientos de precios.
 *
 * Con la operación "oferta", `base` es el precio original de un artículo que ya
 * está en oferta: el descuento se cuenta sobre ese y no sobre el rebajado, así
 * que repetir la oferta cambia el descuento en lugar de acumularlo (20% y 20%
 * no dan 36%). Un artículo que no está en oferta no trae `base`.
 */
export function vistaPrevia(items, op, valor, redondeo = "ninguno") {
  const esOferta = op === "oferta";
  const filas = [];
  let cambian = 0;
  let iguales = 0;
  let errores = 0;
  let suma = 0;
  for (const it of items) {
    const ref = esOferta ? (it.base ?? it.precio) : it.precio;
    const r = calcularPrecio(ref, op, valor, redondeo);
    const extra = esOferta ? { base: ref } : {};
    if (!r.ok) {
      errores++;
      filas.push({ key: it.key, antes: it.precio, despues: null, estado: "error", error: r.error, ...extra });
    } else if (esOferta && r.value >= ref) {
      // El redondeo puede comerse un descuento chico: una oferta que no baja el
      // precio no es una oferta.
      errores++;
      filas.push({
        key: it.key,
        antes: it.precio,
        despues: null,
        estado: "error",
        error: "El descuento, ya redondeado, no baja el precio.",
        ...extra,
      });
    } else if (r.value === it.precio && (!esOferta || it.base === ref)) {
      iguales++;
      filas.push({ key: it.key, antes: it.precio, despues: r.value, estado: "igual", ...extra });
    } else {
      cambian++;
      suma += ((r.value - ref) / ref) * 100;
      filas.push({ key: it.key, antes: it.precio, despues: r.value, estado: "cambia", ...extra });
    }
  }
  return {
    filas,
    cambian,
    iguales,
    errores,
    promedioPct: cambian ? Math.round((suma / cambian) * 10) / 10 : 0,
  };
}

/**
 * El producto con su precio nuevo. El precio anterior es el que se muestra
 * tachado: si el precio nuevo lo alcanza o lo pasa, el "descuento" subiría el
 * precio, así que se saca.
 */
export function precioDeProducto(producto, nuevo) {
  const { oldPrice, offerUntil, ...resto } = producto;
  const sigueOferta = oldPrice && oldPrice > nuevo;
  return {
    ...resto,
    price: nuevo,
    ...(sigueOferta ? { oldPrice } : {}),
    // El vencimiento acompaña a la oferta: si ésta termina, él también.
    ...(sigueOferta && offerUntil ? { offerUntil } : {}),
  };
}

/**
 * El producto con un precio y un precio anterior explícitos: una oferta. Si el
 * anterior no es mayor al precio, no hay oferta y se saca (igual que en
 * `precioDeProducto`).
 */
export function ofertaDeProducto(producto, precio, anterior, hasta) {
  const { oldPrice, offerUntil, ...resto } = producto;
  const hayOferta = anterior && anterior > precio;
  return {
    ...resto,
    price: precio,
    ...(hayOferta ? { oldPrice: anterior } : {}),
    // Una oferta nueva sin fecha no hereda la de la anterior: dura hasta que se termine a mano.
    ...(hayOferta && hastaValido(hasta) ? { offerUntil: hastaValido(hasta) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Aplicar cambios y deshacerlos
// ---------------------------------------------------------------------------

/**
 * Aplica una lista de cambios sobre el estado y devuelve el estado nuevo, sin
 * mutar nada. Cada cambio es `{ fuente, id, precio?, antes?, activo?, precioMarca? }`:
 * - `precio` (tienda): el precio nuevo. (hombre): el precio propio, o `null`
 *   para volver al de la marca. Si el propio iguala al de la marca no se guarda
 *   una excepción: no sería un cambio.
 * - `antes`: el precio anterior, el que se muestra tachado. Con un número, es una
 *   oferta; con `null`, la termina. Sin esta clave, el anterior sólo se conserva
 *   mientras siga siendo mayor al precio nuevo.
 * - `activo`: publicado/oculto (tienda) o a la venta/de baja (hombre).
 */
export function aplicarCambios(ajustes, productos, cambios) {
  let nuevosAjustes = ajustes;
  const porId = new Map();
  for (const c of cambios) {
    if (c.fuente === "men") {
      const parche = {};
      if ("precio" in c)
        parche.price = c.precio !== null && c.precio === c.precioMarca && !("antes" in c ? c.antes > c.precio : ajustes?.[c.id]?.old > c.precio) ? null : c.precio;
      if ("antes" in c) parche.old = c.antes;
      if ("hasta" in c) parche.hasta = c.hasta;
      // Una oferta nueva sin fecha no hereda la de la anterior.
      else if ("antes" in c && c.antes) parche.hasta = null;
      if ("activo" in c) parche.active = c.activo;
      nuevosAjustes = cambiarAjuste(nuevosAjustes, c.id, parche);
    } else if (c.fuente === "db") {
      porId.set(c.id, { ...(porId.get(c.id) || {}), ...c });
    }
  }
  const nuevosProductos = porId.size
    ? productos.map((p) => {
        const c = porId.get(p.id);
        if (!c) return p;
        let siguiente = p;
        if ("antes" in c)
          siguiente = ofertaDeProducto(
            siguiente,
            typeof c.precio === "number" ? c.precio : siguiente.price,
            c.antes,
            c.hasta,
          );
        else if (typeof c.precio === "number")
          siguiente = precioDeProducto(siguiente, c.precio);
        if ("activo" in c) siguiente = { ...siguiente, active: c.activo !== false };
        return siguiente;
      })
    : productos;
  return { ajustes: nuevosAjustes, productos: nuevosProductos };
}

/**
 * Una foto de cómo están ciertos artículos ahora, para poder volver a ella.
 * Una prenda de hombre sin excepción queda como `null`: restaurarla es borrarla.
 */
export function capturar(ajustes, productos, idsMen, idsDb) {
  const men = {};
  for (const id of idsMen) men[id] = ajustes[id] ? { ...ajustes[id] } : null;
  const db = {};
  const quieren = new Set(idsDb);
  for (const p of productos)
    if (quieren.has(p.id))
      db[p.id] = {
        price: p.price,
        ...(p.oldPrice ? { oldPrice: p.oldPrice } : {}),
        ...(p.oldPrice && p.offerUntil ? { offerUntil: p.offerUntil } : {}),
        active: p.active,
      };
  return { men, db };
}

/** Deja el estado como dice la foto. Lo que no está en la foto no se toca. */
export function aplicarFoto(ajustes, productos, foto) {
  const nuevosAjustes = { ...ajustes };
  for (const [id, a] of Object.entries(foto.men || {})) {
    if (a === null) delete nuevosAjustes[id];
    else nuevosAjustes[id] = { ...a };
  }
  const idsDb = foto.db || {};
  const nuevosProductos = productos.map((p) => {
    const f = idsDb[p.id];
    if (!f) return p;
    const { oldPrice, offerUntil, ...resto } = p;
    return {
      ...resto,
      price: f.price,
      active: f.active,
      ...(f.oldPrice ? { oldPrice: f.oldPrice } : {}),
      ...(f.oldPrice && f.offerUntil ? { offerUntil: f.offerUntil } : {}),
    };
  });
  return { ajustes: nuevosAjustes, productos: nuevosProductos };
}

/** Historial vacío. `pasado` se deshace de atrás hacia adelante; `futuro` se rehace. */
export function historialVacio() {
  return { pasado: [], futuro: [] };
}

/** Anota un cambio nuevo. Un cambio nuevo borra lo que se podía rehacer. */
export function anotar(historial, entrada) {
  const pasado = [...historial.pasado, entrada].slice(-LIMITE_HISTORIAL);
  return { pasado, futuro: [] };
}

/** Saca el último cambio para deshacerlo. `entrada` es `null` si no hay nada. */
export function deshacer(historial) {
  if (!historial.pasado.length) return { historial, entrada: null };
  const entrada = historial.pasado[historial.pasado.length - 1];
  return {
    entrada,
    historial: {
      pasado: historial.pasado.slice(0, -1),
      futuro: [...historial.futuro, entrada],
    },
  };
}

/** Vuelve a hacer el último cambio deshecho. */
export function rehacer(historial) {
  if (!historial.futuro.length) return { historial, entrada: null };
  const entrada = historial.futuro[historial.futuro.length - 1];
  return {
    entrada,
    historial: {
      pasado: [...historial.pasado, entrada],
      futuro: historial.futuro.slice(0, -1),
    },
  };
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

/**
 * Convierte filas en un CSV que Excel abre bien: con BOM, separado por `;` y
 * con todo entre comillas. Una celda que empieza con `=`, `+`, `-` o `@` se
 * escribe con una comilla simple adelante, porque Excel la tomaría por una
 * fórmula y alguien podría colar una desde un nombre de producto.
 */
export function filasACsv(filas) {
  return (
    "﻿" +
    filas
      .map((fila) =>
        fila
          .map((celda) => {
            const t = String(celda ?? "");
            return `"${(/^[=+\-@]/.test(t) ? "'" : "") + t.replace(/"/g, '""')}"`;
          })
          .join(";"),
      )
      .join("\r\n")
  );
}
