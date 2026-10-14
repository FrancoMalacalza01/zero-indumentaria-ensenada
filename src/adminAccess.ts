/**
 * Traba del panel interno (`/admin`).
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
 * El acceso de verdad, con usuario, contraseña y roles en un servidor, es
 * Etapa 2: ahí la contraseña se verifica del lado del servidor y los datos
 * dejan de estar en el navegador del visitante.
 *
 * CÓMO CAMBIARLA: `node scripts/clave-admin.mjs "la nueva clave"` imprime el
 * bloque de abajo ya armado. Dejando `hash` y `salt` vacíos, el panel vuelve
 * a abrirse sin contraseña.
 */
export const adminAccess = {
  hash: "dw8gJiQBGIOTLAgJWzs9Pkyqc4zYHIThCupRjlYW+6w=",
  salt: "1cwN+AFcWf9ZjXk1RHjYlQ==",
  iterations: 310000,
};

/** Si falta el hash o la sal, el panel queda abierto como antes. */
export const adminLocked = Boolean(adminAccess.hash && adminAccess.salt);

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
export async function checkAdminPassword(password: string) {
  if (!adminLocked) return true;
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
    {
      name: "PBKDF2",
      salt: fromBase64(adminAccess.salt),
      iterations: adminAccess.iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits)) === adminAccess.hash;
}
