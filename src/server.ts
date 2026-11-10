import { pedirTodasLasFilas } from "./paginar.mjs";
import { rowsToProducts } from "./catalogMap.mjs";
import { leerAjustes } from "./menOverrides.mjs";
import type { AjustesHombre } from "./menOverrides.mjs";
import type { CartItem, Order, PaymentMethodId, Product } from "./types";

/**
 * Conexión con el servidor del catálogo.
 *
 * Las credenciales de abajo son **públicas a propósito**: viajan en el sitio,
 * como en cualquier tienda hecha así. Lo que protege los datos no es la clave
 * sino los permisos de la base: con esta clave se lee solo lo publicado, y
 * para escribir hay que estar logueado Y estar en la tabla `admins`.
 * Nunca poner acá la clave de servicio.
 *
 * Se pueden pisar sin tocar el código con las variables VITE_SUPABASE_URL y
 * VITE_SUPABASE_KEY, que es lo que conviene para rotarlas.
 */
export const URL_SERVIDOR =
  import.meta.env.VITE_SUPABASE_URL || "https://wveldpcacjgupzrxolgn.supabase.co";
export const CLAVE_PUBLICA =
  import.meta.env.VITE_SUPABASE_KEY ||
  "sb_publishable_P2S-V2Tq2T0yxO-KpfQFJQ_60kSF7Hi";

/** Si falta cualquiera de las dos, la tienda usa el catálogo que trae adentro. */
export const serverConfigured = Boolean(URL_SERVIDOR && CLAVE_PUBLICA);

/** Más de esto y es mejor mostrar el catálogo viejo que una pantalla vacía. */
const ESPERA_MAXIMA = 20000;

async function pedir(ruta: string, signal: AbortSignal) {
  const respuesta = await fetch(`${URL_SERVIDOR}/rest/v1/${ruta}`, {
    signal,
    headers: {
      apikey: CLAVE_PUBLICA,
      Authorization: `Bearer ${CLAVE_PUBLICA}`,
      Accept: "application/json",
    },
  });
  if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
  return respuesta.json();
}

/**
 * Trae el catálogo publicado.
 *
 * Devuelve `null` cuando no se pudo, y también cuando el servidor no tiene
 * nada: en los dos casos conviene que la tienda siga mostrando lo que ya
 * tenía antes que quedarse en blanco. El que llama decide qué hacer con eso.
 */
export async function fetchCatalog(): Promise<Product[] | null> {
  if (!serverConfigured) return null;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  try {
    const [productos, stock] = await Promise.all([
      pedirTodasLasFilas((ruta) => pedir(ruta, corte.signal), "products?select=*&active=eq.true&order=position.asc,id.asc"),
      pedirTodasLasFilas((ruta) => pedir(ruta, corte.signal), "stock?select=product_id,size,qty&order=product_id.asc,size.asc"),
    ]);
    const lista = rowsToProducts(productos, stock) as Product[];
    return lista.length ? lista : null;
  } catch {
    // Sin red, con el servidor caído o con una respuesta rara: no es motivo
    // para romper la tienda.
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/** Sólo identificadores de fichas importadas que el local ocultó. */
export async function fetchImportadosOcultos(): Promise<string[] | null> {
  if (!serverConfigured) return null;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  try {
    const filas = await pedirTodasLasFilas<{ source_catalog_id?: unknown }>((ruta) => pedir(ruta, corte.signal), "rpc/catalogo_importado_oculto?order=source_catalog_id.asc");
    return filas.map((f) => f.source_catalog_id).filter((id): id is string => typeof id === "string");
  } catch (err) {
    // Queda en la consola del navegador para poder ver por qué falló (permiso, función que no existe, red).
    console.warn("no se pudo leer la lista de fichas ocultas:", err instanceof Error ? err.message : err);
    return null;
  } finally { clearTimeout(reloj); }
}

/**
 * Trae los ajustes del local sobre el catálogo de hombre: precios propios y
 * prendas dadas de baja.
 *
 * Devuelve `null` cuando no se pudo. Es distinto de `{}`: `{}` es "el servidor
 * contestó y no hay ningún cambio", `null` es "no sé", y en ese caso conviene
 * quedarse con lo último que se supo antes que mostrar de nuevo lo que se dio
 * de baja.
 */
export async function fetchAjustes(): Promise<AjustesHombre | null> {
  if (!serverConfigured) return null;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  try {
    // Con el vencimiento de la oferta; si la base todavía no tiene esa columna (falta correr
    // db/ofertas-con-vencimiento.sql) se pide como antes, para no dejar la tienda sin precios.
    let filas;
    try {
      filas = await pedir("catalog_overrides?select=product_id,price,old_price,offer_until,active", corte.signal);
    } catch {
      filas = await pedir("catalog_overrides?select=product_id,price,old_price,active", corte.signal);
    }
    return Array.isArray(filas) ? leerAjustes(filas) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Manda el pedido al servidor, que descuenta el stock y lo guarda en un solo
 * paso.
 *
 * Esto es lo que hace que dos personas comprando lo último no puedan
 * comprarlo las dos: la cuenta la hace la base, con la fila del stock trabada,
 * y el navegador solo dice qué y cuánto. **Los precios los pone el servidor**,
 * no viajan desde acá: si alguien edita el pedido antes de mandarlo, cambia lo
 * que pide, no lo que paga.
 *
 * Devuelve el pedido ya armado, o el motivo del rechazo en palabras que se le
 * pueden mostrar al cliente ("Quedan 2 de Buzo Alva talle L").
 */
export async function crearPedido(
  cart: CartItem[],
  customer: string,
  delivery: "pickup" | "shipping",
  zone?: string,
  payment?: PaymentMethodId,
): Promise<{ order?: Order; error?: string }> {
  if (!serverConfigured) return { error: "No hay servidor configurado." };
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  try {
    const respuesta = await fetch(`${URL_SERVIDOR}/rest/v1/rpc/crear_pedido`, {
      method: "POST",
      signal: corte.signal,
      headers: {
        apikey: CLAVE_PUBLICA,
        Authorization: `Bearer ${CLAVE_PUBLICA}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        p_items: cart.map((i) => ({
          productId: i.productId,
          size: i.size,
          quantity: i.quantity,
        })),
        p_cliente: customer,
        p_entrega: delivery,
        p_zona: delivery === "shipping" ? zone || null : null,
        p_pago: payment || null,
      }),
    });
    if (!respuesta.ok)
      return {
        error:
          "No pudimos confirmar el pedido. Probá de nuevo en un momento.",
      };
    const datos = await respuesta.json();
    if (datos?.error) return { error: String(datos.error) };
    if (!datos?.order)
      return { error: "El servidor contestó algo que no entiendo." };
    return { order: datos.order as Order };
  } catch {
    // Acá no se puede improvisar: si no sabemos si el pedido entró, decirle al
    // cliente que está listo sería mentirle, y el stock quedaría mal.
    return {
      error: "No pudimos confirmar el pedido. Revisá la conexión y probá otra vez.",
    };
  } finally {
    clearTimeout(reloj);
  }
}
