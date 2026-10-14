import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, Lock } from "lucide-react";
import {
  adminLocked,
  checkAdminPassword,
  InsecureContextError,
} from "./adminAccess";

// Dura lo que dura la pestaña: al cerrarla, el panel vuelve a pedir la clave.
const SESSION_KEY = "mistral-admin-unlocked";

function remembered() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Sin sessionStorage se puede entrar igual, solo que hay que teclearla
    // de nuevo en cada pantalla.
    return false;
  }
}

/** Tapa el panel hasta que se escriba la contraseña. */
export default function AdminGate({
  children,
  onExit,
}: {
  children: ReactNode;
  onExit: () => void;
}) {
  const [unlocked, setUnlocked] = useState(() => !adminLocked || remembered());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (unlocked) return <>{children}</>;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (await checkAdminPassword(password)) {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* Entra igual, solo que no queda recordado. */
        }
        setUnlocked(true);
        return;
      }
      setError("Esa no es la contraseña.");
    } catch (err) {
      setError(
        err instanceof InsecureContextError
          ? "El panel necesita una conexión segura (https) para verificar la contraseña."
          : "No se pudo verificar la contraseña en este navegador.",
      );
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
        <p>Escribí la contraseña para ver el stock y los pedidos.</p>
        <label className="field">
          Contraseña
          <input
            type="password"
            autoFocus
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
          {busy ? "Verificando…" : "Entrar"}
          <ArrowRight size={18} />
        </button>
        <button type="button" className="text-link" onClick={onExit}>
          Volver a la tienda
        </button>
      </form>
    </main>
  );
}
