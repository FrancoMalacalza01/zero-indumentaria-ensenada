// Genera la traba del panel interno.
//
//   node scripts/clave-admin.mjs                → inventa una contraseña
//   node scripts/clave-admin.mjs "mi clave"     → usa la que le pases
//
// Imprime el bloque para pegar en src/adminAccess.ts. La contraseña en sí no
// se guarda en ningún lado: lo que viaja al navegador es el hash, y del hash
// no se vuelve a la contraseña.
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

console.log("Pegá esto en src/adminAccess.ts, reemplazando el bloque actual:\n");
console.log("export const adminAccess = {");
console.log(`  hash: "${hash.toString("base64")}",`);
console.log(`  salt: "${salt.toString("base64")}",`);
console.log(`  iterations: ${ITERATIONS},`);
console.log("};\n");
if (!given) console.log("Guardá la contraseña: no se puede recuperar de acá.\n");
