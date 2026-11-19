// Genera la traba del panel interno.
//
//   node scripts/clave-admin.mjs                → inventa una contraseña
//   node scripts/clave-admin.mjs "mi clave"     → usa la que le pases
//
// Imprime las variables de entorno del modo demo del panel (VITE_PANEL_DEMO_HASH y
// VITE_PANEL_DEMO_SALT). La contraseña en sí no se guarda en ningún lado: lo que
// viaja al navegador es el hash, y del hash no se vuelve a la contraseña. El modo
// demo sólo funciona con VITE_PANEL_DEMO=1; en producción está apagado.
import { randomBytes, pbkdf2Sync } from "node:crypto";

const ITERATIONS = 310000;
const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";

function invent() {
  const bytes = randomBytes(16);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  // En grupos de cuatro, para que se pueda dictar por teléfono.
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

const given = process.argv[2];
const password = given || invent();
if (!given) console.log(`\nContraseña: ${password}\n`);
else if (password.length < 10)
  console.log("\nAviso: es corta. El hash viaja en el sitio, así que una\n" +
    "contraseña corta se puede adivinar probando. Usá 12 caracteres o más.\n");

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");

console.log("Para probar el modo demo en tu computadora, creá un archivo .env.local con:\n");
console.log("VITE_PANEL_DEMO=1");
console.log(`VITE_PANEL_DEMO_HASH=${hash.toString("base64")}`);
console.log(`VITE_PANEL_DEMO_SALT=${salt.toString("base64")}\n`);
if (!given) console.log("Guardá la contraseña: no se puede recuperar de acá.\n");
