/**
 * Traba del panel interno (`/admin`).
 *
 * OJO: esto NO es la forma principal de entrar. Es el modo demo, la salida
 * de emergencia para cuando no se puede llegar al servidor. El acceso de
 * verdad vive en `auth.ts`: usuario y contraseña verificados afuera, y
 * permisos de base que deciden qué se puede escribir.
 *
 * QUÉ ES Y QUÉ NO ES. Esto evita que alguien entre al panel de casualidad o
 * curioseando: sin la contraseña, la pantalla no se abre. No es control de
 * acceso de verdad, y conviene tenerlo claro:
 *
 * - El hash viaja en el sitio, como todo el resto del código. No se puede
 *   volver de ahí a la contraseña, pero sí se pueden probar contraseñas
 *   contra él sin límite y sin que nos enteremos. Por eso la traba vale lo
 *   que valga la contraseña: una corta o adivinable no sirve de nada.
 * - Los datos de la demo viven en el `localStorage` del navegador y se leen
 *   sin contraseña. Esto tapa la pantalla, no los datos.
 *
 * Con el acceso de verdad (`auth.ts`) nada de esto aplica: la contraseña no
 * viaja ni como hash, se verifica en el servidor, y los datos del panel
 * dejan de estar en el navegador.
 *
 * CÓMO CAMBIARLA: desde el panel, con el botón de arriba a la derecha. Esa
 * contraseña queda guardada en el navegador donde la cambiaste y pisa a la de
 * abajo; borrar los datos del sitio la devuelve a la de fábrica.
 *
 * Para cambiar la de fábrica, la que viene en el sitio para todos:
 * `node scripts/clave-admin.mjs "la nueva clave"` imprime el bloque de abajo
 * ya armado. Dejando `hash` y `salt` vacíos, el panel se abre sin contraseña.
 */
export const adminAccess = {
  hash: "jlczHdK+UTh/rhdW6ciQpLBOgYMwAwKxt7BPVBQ7Ykc=",
  salt: "J77+0ig57ezXsE2ynYMZQw==",
  iterations: 310000,
};

/** Clave puesta desde el panel. Vale solo en este navegador. */
const OVERRIDE_KEY = "mistral-admin-pass-v1";

interface Credencial {
  hash: string;
  salt: string;
  iterations: number;
}

function leerOverride(): Credencial | null {
  try {
    const raw = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "null");
    if (
      raw &&
      typeof raw.hash === "string" &&
      typeof raw.salt === "string" &&
      Number.isInteger(raw.iterations) &&
      raw.iterations > 0 &&
      raw.hash &&
      raw.salt
    )
      return raw as Credencial;
  } catch {
    /* Un guardado roto no puede dejar afuera al dueño: se usa el de fábrica. */
  }
  return null;
}

/** La credencial que manda: la del navegador si hay, si no la de fábrica. */
function credencial(): Credencial {
  return leerOverride() || adminAccess;
}

/** Si falta el hash o la sal, el panel queda abierto como antes. */
export const adminLocked = Boolean(adminAccess.hash && adminAccess.salt);

/** true si la clave de este navegador no es la que viene de fábrica. */
export function passwordCambiada() {
  return leerOverride() !== null;
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export class InsecureContextError extends Error {}

/**
 * Compara la contraseña tecleada contra el hash guardado. Las 310.000 vueltas
 * de PBKDF2 tardan a propósito: hacen cara cada prueba.
 */
async function derivar(
  password: string,
  salt: BufferSource,
  iterations: number,
) {
  // crypto.subtle no existe fuera de HTTPS. Si no está, no se puede verificar
  // nada, así que la traba queda cerrada en vez de abrirse sola.
  if (!globalThis.crypto?.subtle) throw new InsecureContextError();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function checkAdminPassword(password: string) {
  if (!adminLocked) return true;
  const actual = credencial();
  const hash = await derivar(
    password,
    fromBase64(actual.salt),
    actual.iterations,
  );
  return hash === actual.hash;
}

/**
 * Guarda una contraseña nueva para este navegador. No se guarda la
 * contraseña: se guarda su hash, con una sal nueva al azar.
 */
export async function setAdminPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(password, salt, adminAccess.iterations);
  const credencialNueva: Credencial = {
    hash,
    salt: toBase64(salt),
    iterations: adminAccess.iterations,
  };
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(credencialNueva));
}

/** Vuelve a la contraseña de fábrica en este navegador. */
export function resetAdminPassword() {
  localStorage.removeItem(OVERRIDE_KEY);
}
