import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, Lock, WifiOff } from "lucide-react";
import {
  adminLocked,
  checkAdminPassword,
  InsecureContextError,
} from "./adminAccess";
import {
  login,
  olvidarSesion,
  sesionGuardada,
  sesionUsable,
  CredencialesInvalidas,
  NoEsAdmin,
  SinConexion,
} from "./auth";
import type { Session } from "./auth";
import { serverConfigured } from "./server";

/**
 * La puerta del panel.
 *
 * Hay dos formas de entrar y no son lo mismo:
 *
 * - **Con el servidor.** Usuario y contraseña se verifican afuera y vuelven
 *   con un permiso que vence. Con eso el panel publica: lo que carga el dueño
 *   aparece en la tienda.
 * - **Modo demo.** Si no se puede llegar al servidor, queda la contraseña
 *   local de siempre, que abre el panel pero no publica nada. Sirve para
 *   mostrar el sistema sin conexión; no sirve para trabajar.
 *
 * El modo demo es la salida de emergencia, no el camino principal: solo se
 * ofrece después de que el servidor no contestó.
 */

/** Dura lo que dura la pestaña. Solo para el modo demo. */
const SESSION_KEY = "mistral-admin-unlocked";

function demoRecordada() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export interface Acceso {
  /** La sesión del servidor, o `null` si entró en modo demo. */
  session: Session | null;
  /** Cierra la sesión y vuelve a pedir el login. */
  salir: () => void;
}

export default function AdminGate({
  children,
  onExit,
}: {
  children: (acceso: Acceso) => ReactNode;
  onExit: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  // Se arranca revisando si quedó una sesión de antes, y hasta que eso se
  // sepa no se muestra ni el panel ni el login: mostrar el login y sacarlo
  // medio segundo después es peor que esperar.
  const [revisando, setRevisando] = useState(() => Boolean(sesionGuardada()));
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ofrecerDemo, setOfrecerDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const guardada = sesionGuardada();
    if (!guardada) return;
    let vigente = true;
    sesionUsable(guardada)
      .then((viva) => {
        if (!vigente) return;
        if (viva) setSession(viva);
        setRevisando(false);
      })
      .catch(() => {
        if (vigente) setRevisando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const salir = () => {
    olvidarSesion();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* Nada que hacer. */
    }
    setSession(null);
    setDemo(false);
    setPassword("");
    setError("");
  };

  if (session) return <>{children({ session, salir })}</>;
  if (demo || (!adminLocked && !serverConfigured))
    return <>{children({ session: null, salir })}</>;

  if (revisando)
    return (
      <main className="admin-gate">
        <div className="admin-gate-checking">
          <Lock size={30} />
          <p>Verificando la sesión…</p>
        </div>
      </main>
    );

  const entrarEnDemo = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* Entra igual, solo que no queda recordado. */
    }
    setDemo(true);
  };

  /**
   * Sin servidor, la contraseña local decide. Devuelve true si abrió.
   *
   * Si el panel ya la había recordado en esta pestaña, no la vuelve a pedir.
   */
  const probarLocal = async () => {
    if (demoRecordada() || !adminLocked) {
      entrarEnDemo();
      return true;
    }
    try {
      if (await checkAdminPassword(password)) {
        entrarEnDemo();
        return true;
      }
    } catch (err) {
      setError(
        err instanceof InsecureContextError
          ? "El panel necesita una conexión segura (https) para verificar la contraseña."
          : "No se pudo verificar la contraseña en este navegador.",
      );
      return false;
    }
    return false;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setOfrecerDemo(false);
    try {
      setSession(await login(email, password));
      return;
    } catch (err) {
      if (err instanceof CredencialesInvalidas) {
        setError("Usuario o contraseña incorrecta.");
      } else if (err instanceof NoEsAdmin) {
        setError(
          "Esa cuenta existe pero no tiene permiso para el panel. Hay que agregarla a la lista de administradores.",
        );
      } else if (err instanceof SinConexion) {
        // El servidor no contestó, así que de la contraseña no sabemos nada.
        // Recién acá se ofrece el modo demo.
        if (await probarLocal()) return;
        setOfrecerDemo(true);
        if (!error)
          setError(
            "No se pudo llegar al servidor. Se puede entrar en modo demo, pero los cambios no se publican.",
          );
      } else {
        setError("No se pudo entrar. Probá de nuevo en un rato.");
      }
    }
    setPassword("");
    // Una espera corta después de cada error: probar contraseñas se hace
    // lento y molesto.
    setTimeout(() => setBusy(false), 1500);
  };

  return (
    <main className="admin-gate">
      <form onSubmit={submit}>
        <Lock size={30} />
        <h1>Panel interno</h1>
        <p>Entrá con tu usuario para cargar productos, stock y pedidos.</p>
        <label className="field">
          Usuario
          <input
            type="email"
            autoFocus
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-green" type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
          <ArrowRight size={18} />
        </button>
        {ofrecerDemo && (
          <button
            type="button"
            className="admin-gate-demo"
            onClick={entrarEnDemo}
          >
            <WifiOff size={16} />
            Entrar en modo demo
          </button>
        )}
        <button type="button" className="text-link" onClick={onExit}>
          Volver a la tienda
        </button>
      </form>
    </main>
  );
}
