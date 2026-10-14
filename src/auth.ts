/**
 * Login del panel contra el servidor.
 *
 * La diferencia con `adminAccess.ts` es de fondo. Esa traba vive en el
 * navegador: tapa la pantalla y nada más. Esto es acceso de verdad: el
 * servidor verifica la contraseña, devuelve un permiso con vencimiento, y
 * sin ese permiso la base no deja escribir ni una fila.
 *
 * Y no alcanza con estar logueado: para escribir hay que estar además en la
 * tabla `admins`, que se carga a mano. Si alguna vez quedan los registros
 * abiertos, una cuenta nueva no puede tocar el catálogo.
 */
import { URL_SERVIDOR, CLAVE_PUBLICA, serverConfigured } from "./server";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Milisegundos epoch. Pasado eso el permiso no sirve más. */
  expiresAt: number;
  email: string;
  userId: string;
}

/** Dura entre visitas: el dueño no tiene que loguearse cada vez. */
const SESSION_KEY = "mistral-admin-session-v1";

/** Se renueva antes de vencer, así no se corta en medio de un guardado. */
const MARGEN = 60_000;

const ESPERA_MAXIMA = 12_000;

/** La contraseña no es la que va. */
export class CredencialesInvalidas extends Error {}
/** No se pudo llegar al servidor. Distinto de una contraseña mal puesta. */
export class SinConexion extends Error {}
/** Entró, pero no está en `admins`: no puede escribir nada. */
export class NoEsAdmin extends Error {}

function leerSesion(datos: unknown, emailPedido: string): Session {
  const d = datos as Record<string, unknown> | null;
  const accessToken = typeof d?.access_token === "string" ? d.access_token : "";
  const refreshToken =
    typeof d?.refresh_token === "string" ? d.refresh_token : "";
  if (!accessToken || !refreshToken)
    throw new SinConexion("El servidor contestó algo que no entiendo");
  const segundos = Number(d?.expires_in);
  const user = d?.user as Record<string, unknown> | undefined;
  return {
    accessToken,
    refreshToken,
    expiresAt:
      Date.now() + (Number.isFinite(segundos) ? segundos : 3600) * 1000,
    email: typeof user?.email === "string" ? user.email : emailPedido,
    userId: typeof user?.id === "string" ? user.id : "",
  };
}

async function pedirToken(ruta: string, cuerpo: object, email: string) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_SERVIDOR}/auth/v1/${ruta}`, {
      method: "POST",
      signal: corte.signal,
      headers: {
        apikey: CLAVE_PUBLICA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    // Sin red o con el servidor caído. No se sabe nada de la contraseña.
    throw new SinConexion("No se pudo llegar al servidor");
  } finally {
    clearTimeout(reloj);
  }
  if (respuesta.status === 400 || respuesta.status === 401)
    throw new CredencialesInvalidas();
  if (!respuesta.ok)
    throw new SinConexion(`El servidor respondió ${respuesta.status}`);
  return leerSesion(await respuesta.json(), email);
}

/**
 * Pregunta al servidor si esta sesión está en `admins`.
 *
 * La política de lectura de esa tabla usa la misma función que las de
 * escritura, así que una lista vacía significa exactamente "no puede
 * escribir". Mejor enterarse acá que al primer guardado.
 */
export async function confirmarAdmin(session: Session) {
  const respuesta = await fetch(
    `${URL_SERVIDOR}/rest/v1/admins?select=user_id&limit=1`,
    {
      headers: {
        apikey: CLAVE_PUBLICA,
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
      },
    },
  ).catch(() => {
    throw new SinConexion("No se pudo llegar al servidor");
  });
  if (!respuesta.ok)
    throw new SinConexion(`El servidor respondió ${respuesta.status}`);
  const filas = await respuesta.json();
  return Array.isArray(filas) && filas.length > 0;
}

/** Entra con usuario y contraseña. Tira `NoEsAdmin` si entró pero no puede escribir. */
export async function login(email: string, password: string) {
  if (!serverConfigured) throw new SinConexion("No hay servidor configurado");
  const session = await pedirToken(
    "token?grant_type=password",
    { email: email.trim(), password },
    email.trim(),
  );
  if (!(await confirmarAdmin(session))) {
    // Se cierra la sesión que acabamos de abrir: no sirve para nada y es
    // mejor no dejarla dando vueltas.
    await logout(session).catch(() => {});
    throw new NoEsAdmin();
  }
  guardarSesion(session);
  return session;
}

/** Renueva el permiso antes de que venza. */
export async function renovar(session: Session) {
  const nueva = await pedirToken(
    "token?grant_type=refresh_token",
    { refresh_token: session.refreshToken },
    session.email,
  );
  guardarSesion(nueva);
  return nueva;
}

/** true si el permiso todavía sirve, con un rato de margen. */
export function vigente(session: Session | null): session is Session {
  return Boolean(session && session.expiresAt > Date.now() + MARGEN);
}

/**
 * La sesión lista para usar: la renueva si está por vencer.
 *
 * Devuelve `null` cuando ya no se puede seguir, y en ese caso deja todo
 * limpio para que el panel vuelva a pedir el login.
 */
export async function sesionUsable(session: Session | null) {
  if (vigente(session)) return session;
  if (!session) return null;
  try {
    return await renovar(session);
  } catch (err) {
    // Si el servidor no está, la sesión puede seguir siendo buena: no se
    // borra. Si rechazó el refresh, ya no vuelve y se limpia.
    if (!(err instanceof SinConexion)) olvidarSesion();
    return null;
  }
}

export async function logout(session: Session) {
  olvidarSesion();
  await fetch(`${URL_SERVIDOR}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: CLAVE_PUBLICA,
      Authorization: `Bearer ${session.accessToken}`,
    },
  }).catch(() => {
    // Ya está olvidada de este lado; que el servidor no conteste no cambia
    // nada para el que apretó "Salir".
  });
}

export function guardarSesion(session: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* Sin localStorage se puede trabajar igual, solo que no queda guardada. */
  }
}

export function olvidarSesion() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Nada que hacer. */
  }
}

/** Lo que haya quedado guardado de una visita anterior. */
export function sesionGuardada(): Session | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (
      raw &&
      typeof raw.accessToken === "string" &&
      typeof raw.refreshToken === "string" &&
      typeof raw.expiresAt === "number" &&
      raw.accessToken &&
      raw.refreshToken
    )
      return raw as Session;
  } catch {
    /* Un guardado roto es lo mismo que no tener ninguno. */
  }
  return null;
}
