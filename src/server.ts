import { rowsToProducts } from "./catalogMap.mjs";
import type { Product } from "./types";

/**
 * Conexión con el servidor del catálogo.
 *
 * Las credenciales de abajo son **públicas a propósito**: viajan en el sitio,
 * como en cualquier tienda hecha así. Lo que protege los datos no es la clave
 * sino los permisos de la base, que hoy dejan leer solo lo publicado y no
 * dejan escribir nada a nadie. Nunca poner acá la clave de servicio.
 *
 * Se pueden pisar sin tocar el código con las variables VITE_SUPABASE_URL y
 * VITE_SUPABASE_KEY, que es lo que conviene para rotarlas.
 */
const URL_SERVIDOR =
  import.meta.env.VITE_SUPABASE_URL || "https://wveldpcacjgupzrxolgn.supabase.co";
const CLAVE_PUBLICA =
  import.meta.env.VITE_SUPABASE_KEY ||
  "sb_publishable_P2S-V2Tq2T0yxO-KpfQFJQ_60kSF7Hi";

/** Si falta cualquiera de las dos, la tienda usa el catálogo que trae adentro. */
export const serverConfigured = Boolean(URL_SERVIDOR && CLAVE_PUBLICA);

/** Más de esto y es mejor mostrar el catálogo viejo que una pantalla vacía. */
const ESPERA_MAXIMA = 8000;

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
      pedir("products?select=*&active=eq.true&order=position.asc", corte.signal),
      pedir("stock?select=product_id,size,qty", corte.signal),
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
