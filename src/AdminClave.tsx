import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { checkAdminPassword, passwordCambiada, resetAdminPassword, setAdminPassword } from "./adminAccess";

/**
 * Cambiar la contraseña del panel. Queda guardada en este navegador y pisa a
 * la que viene en el sitio. Se guarda el hash, nunca la contraseña.
 */
export function PasswordDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const propia = passwordCambiada();
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (nueva.length < 8) {
      setError("La contraseña nueva tiene que tener 8 caracteres o más.");
      return;
    }
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!(await checkAdminPassword(actual))) {
        setError("La contraseña actual no es esa.");
        setBusy(false);
        return;
      }
      await setAdminPassword(nueva);
      notify("Contraseña cambiada en este navegador");
      onClose();
    } catch {
      setError("No se pudo cambiar la contraseña en este navegador.");
      setBusy(false);
    }
  }
  function volverAFabrica() {
    resetAdminPassword();
    notify("Volviste a la contraseña de fábrica");
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="admin-dialog admin-dialog-narrow"
      aria-labelledby="admin-password-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="admin-product-form" onSubmit={submit}>
        <div className="admin-dialog-heading">
          <div>
            <span className="admin-eyebrow">ACCESO AL PANEL</span>
            <h2 id="admin-password-title">Cambiar la contraseña</h2>
            <p>
              Vale en este navegador. En otra computadora o celular sigue la
              de siempre, y borrar los datos del sitio la devuelve a esa.
            </p>
          </div>
          <button
            type="button"
            className="admin-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="admin-dialog-body">
          <label className="admin-field admin-field-full">
            Contraseña actual
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
          <label className="admin-field admin-field-full">
            Contraseña nueva
            <input
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <small>
              Ocho caracteres o más. Cuanto más larga, mejor: es lo único que
              tapa el panel.
            </small>
          </label>
          <label className="admin-field admin-field-full">
            Repetila
            <input
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </label>
          {error && (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          )}
          {propia && (
            <button
              type="button"
              className="admin-text-button"
              onClick={volverAFabrica}
            >
              Volver a la contraseña de fábrica
            </button>
          )}
        </div>
        <div className="admin-dialog-footer">
          <button
            type="button"
            className="admin-button admin-button-outline"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={busy}
          >
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
