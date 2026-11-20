import { useId } from "react";

export type Localidad = { nombre: string; cp: string };

/** Lo que vale en el desplegable cuando el cliente prefiere escribir su código postal. */
export const OTRA_LOCALIDAD = "__otra__";

/**
 * "¿En qué localidad vivís?": el cliente elige la suya y el código postal sale de la lista que cargó el
 * local, así no tiene que saberlo de memoria. Si la suya no está, elige "Otra" y escribe el código.
 *
 * `nombre` es la localidad elegida ("" = ninguna todavía, OTRA_LOCALIDAD = escribe el código). Se guarda
 * el nombre y no sólo el código porque dos localidades pueden compartir código (La Plata y Tolosa).
 */
export default function SelectorDeLocalidad({
  localidades, nombre, onElegir,
}: {
  localidades: Localidad[];
  nombre: string;
  onElegir: (nombre: string, cp: string) => void;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      ¿En qué localidad vivís?
      <select
        id={id}
        value={nombre}
        onChange={(e) => {
          const n = e.target.value;
          onElegir(n, localidades.find((l) => l.nombre === n)?.cp ?? "");
        }}
      >
        <option value="">Elegí tu localidad</option>
        {localidades.map((l) => <option key={l.nombre} value={l.nombre}>{l.nombre}</option>)}
        <option value={OTRA_LOCALIDAD}>Otra (escribo mi código postal)</option>
      </select>
    </label>
  );
}

/** La localidad que corresponde a un código ya escrito, para arrancar con la elección que había. */
export function localidadInicial(localidades: Localidad[], cp: string): string {
  const limpio = cp.trim();
  if (!limpio) return "";
  return localidades.find((l) => l.cp === limpio)?.nombre ?? OTRA_LOCALIDAD;
}
