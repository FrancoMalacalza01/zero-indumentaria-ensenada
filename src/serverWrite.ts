/**
 * Lo que el panel escribe en el servidor.
 *
 * Todo pasa por acá y todo lleva el permiso de la sesión: la base rechaza
 * cualquier escritura que no venga de alguien que esté en `admins`. Si una de
 * estas funciones falla, falla fuerte y con el motivo adentro, porque un
 * guardado que no se guardó y no avisa es peor que un error en la cara.
 *
 * Armar las filas no se hace acá: eso vive en `serverSync.mjs`, que se puede
 * probar sin red.
 */
import { URL_SERVIDOR, CLAVE_PUBLICA } from "./server";
import { rowsToProducts } from "./catalogMap.mjs";
import {
  productToRow,
  stockRows,
  sizesFilter,
  movementToRow,
  rowToMovement,
  orderToRow,
  rowToOrder,
} from "./serverSync.mjs";
import { sesionUsable } from "./auth";
import type { Session } from "./auth";
import { ajusteAFila } from "./menOverrides.mjs";
import type { AjustesHombre } from "./menOverrides.mjs";
import type { Movement, Order, Product } from "./types";

const ESPERA_MAXIMA = 15_000;

/** El permiso venció y no se pudo renovar: hay que loguearse de nuevo. */
export class SesionVencida extends Error {
  constructor() {
    super("La sesión venció. Hay que entrar de nuevo.");
  }
}

/** El servidor rechazó la escritura. El mensaje es el que dio la base. */
export class ErrorDelServidor extends Error {}

async function pedir(
  session: Session,
  ruta: string,
  init: RequestInit = {},
  extraHeaders: Record<string, string> = {},
) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_SERVIDOR}/rest/v1/${ruta}`, {
      ...init,
      signal: corte.signal,
      headers: {
        apikey: CLAVE_PUBLICA,
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
    });
  } catch {
    throw new ErrorDelServidor("No se pudo llegar al servidor");
  } finally {
    clearTimeout(reloj);
  }
  if (respuesta.status === 401 || respuesta.status === 403)
    throw new SesionVencida();
  if (!respuesta.ok) {
    // PostgREST explica bien qué pasó; conviene mostrarlo tal cual antes que
    // un "algo salió mal".
    const detalle = await respuesta.text().catch(() => "");
    let mensaje = `El servidor respondió ${respuesta.status}`;
    try {
      const json = JSON.parse(detalle);
      if (json?.message) mensaje = json.message;
    } catch {
      if (detalle) mensaje = detalle.slice(0, 300);
    }
    throw new ErrorDelServidor(mensaje);
  }
  if (respuesta.status === 204) return null;
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}

/** Envuelve una escritura: renueva el permiso antes y avisa si ya no sirve. */
async function conSesion<T>(
  session: Session,
  tarea: (s: Session) => Promise<T>,
): Promise<{ session: Session; valor: T }> {
  const viva = await sesionUsable(session);
  if (!viva) throw new SesionVencida();
  return { session: viva, valor: await tarea(viva) };
}

const UPSERT = { Prefer: "resolution=merge-duplicates,return=minimal" };
const SILENCIO = { Prefer: "return=minimal" };

/**
 * Publica un producto: lo crea o lo actualiza, con su stock.
 *
 * El orden importa. Primero el producto, porque el stock lo referencia.
 * Después los talles que tiene. Y al final se borran los talles que quedaron
 * del producto de antes: sin ese barrido, sacar un talle del editor lo dejaba
 * para siempre en la base, con stock y todo.
 */
export async function publicarProducto(
  session: Session,
  product: Product,
  position = 0,
) {
  return conSesion(session, async (s) => {
    await pedir(
      s,
      "products",
      { method: "POST", body: JSON.stringify([productToRow(product, position)]) },
      UPSERT,
    );
    const filas = stockRows(product);
    if (filas.length)
      await pedir(
        s,
        "stock",
        { method: "POST", body: JSON.stringify(filas) },
        UPSERT,
      );
    const conservar = sizesFilter(product);
    const filtro = conservar
      ? `product_id=eq.${encodeURIComponent(product.id)}&size=not.in.${encodeURIComponent(conservar)}`
      : `product_id=eq.${encodeURIComponent(product.id)}`;
    await pedir(s, `stock?${filtro}`, { method: "DELETE" }, SILENCIO);
  });
}

/**
 * Borra un producto del servidor.
 *
 * El stock va primero porque apunta al producto. Los movimientos NO se
 * borran: el historial tiene que sobrevivir al producto, por eso guarda el
 * nombre adentro.
 */
export async function borrarProducto(session: Session, id: string) {
  return conSesion(session, async (s) => {
    const clave = `product_id=eq.${encodeURIComponent(id)}`;
    await pedir(s, `stock?${clave}`, { method: "DELETE" }, SILENCIO);
    await pedir(
      s,
      `products?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
      SILENCIO,
    );
  });
}

/**
 * Deja en el servidor los ajustes del catálogo de hombre de las prendas
 * indicadas, tal como están en `ajustes`: las que tienen un cambio se guardan
 * y las que volvieron a como vienen de fábrica se borran.
 *
 * Cada parte es una sola escritura aunque sean cientos de prendas (dar de baja
 * una selección entera): o entran todas las bajas o no entra ninguna. Los ids
 * se filtran antes de armar la consulta; vienen del catálogo, pero esto llega
 * a una URL.
 */
export async function publicarAjustes(
  session: Session,
  ids: string[],
  ajustes: AjustesHombre,
) {
  return conSesion(session, async (s) => {
    const limpios = ids.filter((id) => /^[\w.-]+$/.test(id));
    const filas = limpios
      .filter((id) => ajustes[id])
      .map((id) => ({
        ...ajusteAFila(id, ajustes[id]),
        updated_at: new Date().toISOString(),
      }));
    const quitar = limpios.filter((id) => !ajustes[id]);
    if (filas.length)
      await pedir(
        s,
        "catalog_overrides?on_conflict=product_id",
        { method: "POST", body: JSON.stringify(filas) },
        UPSERT,
      );
    if (quitar.length)
      await pedir(
        s,
        `catalog_overrides?product_id=in.(${quitar.join(",")})`,
        { method: "DELETE" },
        SILENCIO,
      );
  });
}

/** Guarda el orden de la lista tal como quedó en el panel. */
export async function guardarOrden(session: Session, products: Product[]) {
  return conSesion(session, async (s) => {
    const filas = products.map((p, i) => productToRow(p, i));
    if (!filas.length) return;
    await pedir(
      s,
      "products",
      { method: "POST", body: JSON.stringify(filas) },
      UPSERT,
    );
  });
}

/** Guarda movimientos de stock. Se manda de a tandas, no de a uno. */
export async function guardarMovimientos(
  session: Session,
  movements: Movement[],
) {
  return conSesion(session, async (s) => {
    const filas = movements.map((m) => movementToRow(m));
    if (!filas.length) return;
    await pedir(
      s,
      "movements",
      { method: "POST", body: JSON.stringify(filas) },
      UPSERT,
    );
  });
}

/** Guarda un pedido, nuevo o con el estado cambiado. */
export async function guardarPedido(session: Session, order: Order) {
  return conSesion(session, async (s) => {
    await pedir(
      s,
      "orders",
      { method: "POST", body: JSON.stringify([orderToRow(order)]) },
      UPSERT,
    );
  });
}

/**
 * Cancela un pedido y devuelve su stock, en un solo paso.
 *
 * Lo hace la base y no el panel porque son tres cosas que tienen que pasar
 * juntas: el stock vuelve, queda el movimiento y el pedido cambia de estado.
 * Si el panel las hiciera de a una, un corte de red en el medio dejaría el
 * stock devuelto y el pedido todavía activo.
 */
export async function cancelarPedido(
  session: Session,
  id: string,
  motivo = "",
) {
  return conSesion(session, async (s) => {
    const r = await pedir(s, "rpc/cancelar_pedido", {
      method: "POST",
      body: JSON.stringify({ p_id: id, p_motivo: motivo }),
    });
    if (r?.error) throw new ErrorDelServidor(String(r.error));
    return r as { ok: true; unidades: number };
  });
}

/**
 * Trae todo lo que el panel necesita, incluido lo que la tienda no muestra.
 *
 * La tienda pide solo lo publicado; el panel tiene que ver también lo
 * despublicado, si no el dueño no puede volver a publicarlo.
 */
export async function cargarPanel(session: Session) {
  return conSesion(session, async (s) => {
    const [productos, stock, movimientos, pedidos] = await Promise.all([
      pedir(s, "products?select=*&order=position.asc"),
      pedir(s, "stock?select=product_id,size,qty"),
      pedir(s, "movements?select=*&order=fecha.desc&limit=2000"),
      pedir(s, "orders?select=*&order=fecha.desc&limit=1000"),
    ]);
    return {
      products: rowsToProducts(productos, stock) as Product[],
      movements: (Array.isArray(movimientos) ? movimientos : []).map((f) =>
        rowToMovement(f),
      ) as Movement[],
      orders: (Array.isArray(pedidos) ? pedidos : []).map((f) =>
        rowToOrder(f),
      ) as Order[],
    };
  });
}
