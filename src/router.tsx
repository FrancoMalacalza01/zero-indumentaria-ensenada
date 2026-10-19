/**
 * El router del sitio: veinte líneas en vez de una librería.
 *
 * La tienda tiene diez pantallas y ninguna necesita rutas anidadas ni carga
 * diferida por ruta. Lo que hace falta es que un link no recargue la página y
 * que el botón "atrás" del navegador funcione, y eso es esto.
 *
 * Vive aparte de `App.tsx` para que las páginas de texto legal, que son
 * largas y no se tocan seguido, puedan estar en su propio archivo sin
 * importarse en círculo con la tienda.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
}
export function Link({
  to,
  children,
  className = "",
  ...rest
}: {
  to: string;
  children: ReactNode;
  className?: string;
  tabIndex?: number;
  "aria-hidden"?: boolean;
}) {
  return (
    <a
      className={className}
      href={to}
      {...rest}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}

/** La ruta actual, incluida la query. Se actualiza con el botón "atrás". */
export function useRoute() {
  const [path, setPath] = useState(location.pathname + location.search);
  useEffect(() => {
    const handler = () => setPath(location.pathname + location.search);
    addEventListener("popstate", handler);
    return () => removeEventListener("popstate", handler);
  }, []);
  return path;
}
