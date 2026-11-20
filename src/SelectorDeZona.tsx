import { useId, useState } from "react";
import SelectorDeLocalidad, { OTRA_LOCALIDAD, localidadInicial } from "./SelectorDeLocalidad";
import type { Localidad } from "./SelectorDeLocalidad";
import type { ZonaEnvio } from "./types";
import { codigoPostalDe, hayCodigosPostales, zonaPorCodigoPostal } from "./delivery";

export type EleccionDeZona = { zone: string; cp: string };

/**
 * Cómo elige el cliente adónde va el envío.
 *
 * Si el local cargó los códigos postales de sus zonas, el cliente escribe el suyo y la zona (y
 * su costo) salen solos. Si no cargó ninguno, queda el desplegable de siempre. Un código que
 * ninguna zona cubre no se acepta: el aviso manda a WhatsApp en vez de adivinar un precio.
 */
export default function SelectorDeZona({
  zonas, value, onChange, whatsapp, etiqueta = "¿A qué código postal lo mandamos?", localidades = [],
}: {
  zonas: ZonaEnvio[];
  /** Las localidades que cargó el local: si hay, el cliente elige la suya en vez de escribir el código. */
  localidades?: Localidad[];
  value: EleccionDeZona;
  onChange: (v: EleccionDeZona) => void;
  whatsapp?: string;
  etiqueta?: string;
}) {
  const id = useId();
  const [localidad, setLocalidad] = useState(() => localidadInicial(localidades, value.cp));
  if (!hayCodigosPostales(zonas)) {
    return (
      <label className="field">
        ¿A qué ciudad lo mandamos?
        <select value={value.zone} onChange={(e) => onChange({ zone: e.target.value, cp: "" })}>
          {zonas.map((z) => <option key={z.id}>{z.nombre}</option>)}
        </select>
      </label>
    );
  }
  const escrito = value.cp.trim() !== "";
  const valido = codigoPostalDe(value.cp) !== null;
  const zona = valido ? zonaPorCodigoPostal(zonas, value.cp) : null;
  const conLista = localidades.length > 0;
  const escribe = !conLista || localidad === OTRA_LOCALIDAD;
  return (
    <div className="field selector-cp">
      {conLista && (
        <SelectorDeLocalidad
          localidades={localidades}
          nombre={localidad}
          onElegir={(n, cp) => {
            setLocalidad(n);
            onChange({ cp, zone: zonaPorCodigoPostal(zonas, cp)?.nombre ?? "" });
          }}
        />
      )}
      {escribe && <label htmlFor={id}>{etiqueta}</label>}
      {escribe && <input
        id={id}
        inputMode="text"
        autoComplete="postal-code"
        maxLength={10}
        placeholder="ej. 1925"
        value={value.cp}
        onChange={(e) => {
          const cp = e.target.value;
          onChange({ cp, zone: zonaPorCodigoPostal(zonas, cp)?.nombre ?? "" });
        }}
      />}
      {zona && <small className="cp-ok">Código postal {value.cp.trim().toUpperCase()} · zona: {zona.nombre}</small>}
      {escrito && !zona && (
        <small className="form-error" role="alert">
          {valido ? "Todavía no llegamos a ese código postal." : "Escribí los 4 números de tu código postal."}
          {whatsapp ? (
            <>
              {" "}
              <a className="text-link" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Consultanos por WhatsApp</a>
            </>
          ) : null}
        </small>
      )}
    </div>
  );
}
