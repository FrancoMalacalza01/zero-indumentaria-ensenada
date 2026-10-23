/**
 * La configuración del local, ida y vuelta con el servidor.
 *
 * La lee cualquiera, porque la tienda necesita mostrar los alias, las zonas y
 * la política de devoluciones. La escribe sólo un admin: los permisos de la
 * base no dejan a nadie más.
 *
 * Si el servidor no contesta, la tienda usa la configuración de fábrica. Más
 * vale una tienda con la dirección vieja que una tienda en blanco.
 */
import { URL_SERVIDOR, CLAVE_PUBLICA, serverConfigured } from "./server";
import { leerSettings, porDefecto } from "./settingsMap.mjs";
import type { Session } from "./auth";
import { sesionUsable } from "./auth";
import type { Settings } from "./types";

export { porDefecto, leerSettings };

const ESPERA_MAXIMA = 8000;

/** Trae la configuración. Devuelve `null` si no se pudo. */
export async function fetchSettings(): Promise<Settings | null> {
  if (!serverConfigured) return null;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  try {
    const respuesta = await fetch(
      `${URL_SERVIDOR}/rest/v1/settings?select=datos&id=eq.local`,
      {
        signal: corte.signal,
        headers: {
          apikey: CLAVE_PUBLICA,
          Authorization: `Bearer ${CLAVE_PUBLICA}`,
          Accept: "application/json",
        },
      },
    );
    if (!respuesta.ok) return null;
    const filas = await respuesta.json();
    if (!Array.isArray(filas) || !filas.length) return null;
    return leerSettings(filas[0]?.datos) as Settings;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/** Guarda la configuración. Tira error con el motivo si el servidor la rechaza. */
export async function guardarSettings(session: Session, settings: Settings) {
  const viva = await sesionUsable(session);
  if (!viva) throw new Error("La sesión venció. Hay que entrar de nuevo.");
  const respuesta = await fetch(
    `${URL_SERVIDOR}/rest/v1/settings?id=eq.local`,
    {
      method: "PATCH",
      headers: {
        apikey: CLAVE_PUBLICA,
        Authorization: `Bearer ${viva.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        datos: settings,
        updated_at: new Date().toISOString(),
      }),
    },
  ).catch(() => {
    throw new Error("No se pudo llegar al servidor.");
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    let mensaje = `El servidor respondió ${respuesta.status}`;
    try {
      const json = JSON.parse(detalle);
      if (json?.message) mensaje = json.message;
    } catch {
      if (detalle) mensaje = detalle.slice(0, 300);
    }
    throw new Error(mensaje);
  }
  return { session: viva };
}
