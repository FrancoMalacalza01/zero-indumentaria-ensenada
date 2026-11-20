import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, Store } from "lucide-react";
import type { Settings } from "./types";
import { money } from "./Store";
import { codigoPostalDe, costoEnvio, deliveryZones, hayCodigosPostales, zonaPorCodigoPostal } from "./delivery";
import { textoPlazoEnvio } from "./settingsMap.mjs";
import { guardarEleccion, leerEleccion } from "./zonaElegida";
import SelectorDeLocalidad, { OTRA_LOCALIDAD, localidadInicial } from "./SelectorDeLocalidad";

/**
 * "Medios de envío" de la ficha de una prenda: el cliente escribe su código postal y ve cuánto
 * le sale el envío y cuándo llega, antes de comprar. Es la misma cuenta del checkout
 * (`costoEnvio`, que también hace la base al cobrar), así que lo que ve acá es lo que se cobra.
 *
 * Si el local todavía no cargó los códigos postales de sus zonas, se muestran las zonas con su
 * costo en vez de pedir el código. La elección queda guardada para la bolsa y el checkout.
 */
export default function CalculadoraDeEnvio({ settings, subtotal }: { settings: Settings; subtotal: number }) {
  const zonas = deliveryZones(settings);
  const conCodigos = hayCodigosPostales(zonas);
  const [escrito, setEscrito] = useState(() => leerEleccion(zonas)?.cp ?? "");
  const [consultado, setConsultado] = useState(() => (conCodigos ? leerEleccion(zonas)?.cp ?? "" : ""));
  const localidades = settings.envio.localidades;
  const [localidad, setLocalidad] = useState(() => localidadInicial(localidades, leerEleccion(zonas)?.cp ?? ""));
  const valido = codigoPostalDe(consultado) !== null;
  const zona = conCodigos && valido ? zonaPorCodigoPostal(zonas, consultado) : null;
  const d = settings.direccion;

  const consultar = (e: FormEvent) => {
    e.preventDefault();
    const cp = escrito.trim();
    setConsultado(cp);
    const z = zonaPorCodigoPostal(zonas, cp);
    // Con zona, la bolsa y el checkout arrancan con este envío.
    if (z) guardarEleccion({ delivery: "shipping", zone: z.nombre, cp });
  };

  const costo = (nombre: string) => {
    const c = costoEnvio(settings, nombre, subtotal);
    return c === null ? "A coordinar" : c === 0 ? "Gratis" : money(c);
  };

  const retiro = (
    <>
      <h4>Retirar por</h4>
      <div className="pdp-envio-fila">
        <div>
          <b><Store size={15} aria-hidden /> Local de Zero</b>
          <span>{d.calle}, {d.ciudad}</span>
        </div>
        <strong>Sin costo</strong>
      </div>
    </>
  );

  if (!zonas.length) return <p>Por ahora sólo retiro en el local.</p>;

  // Sin códigos cargados: se listan las zonas, sin pedir nada.
  if (!conCodigos) {
    return (
      <>
        <h4>Envío a domicilio</h4>
        {zonas.map((z) => (
          <div className="pdp-envio-fila" key={z.id}>
            <div>
              <b>{z.nombre}</b>
              {textoPlazoEnvio(z) && <span>{textoPlazoEnvio(z)}</span>}
            </div>
            <strong>{costo(z.nombre)}</strong>
          </div>
        ))}
        {retiro}
      </>
    );
  }

  if (zona) {
    return (
      <>
        <div className="pdp-envio-cp">
          <span>Entregas para el CP: <b>{consultado.trim().toUpperCase()}</b></span>
          <button type="button" className="pdp-cambiar" onClick={() => { setConsultado(""); }}>Cambiar CP</button>
        </div>
        <h4>Envío a domicilio</h4>
        <div className="pdp-envio-fila">
          <div>
            <b>{zona.tipo === "correo" ? "Correo Argentino · envío a domicilio" : `Envío a ${zona.nombre}`}</b>
            {textoPlazoEnvio(zona) && <span>{textoPlazoEnvio(zona)}</span>}
            {zona.nota && <span>{zona.nota}</span>}
          </div>
          <strong>{costo(zona.nombre)}</strong>
        </div>
        {retiro}
      </>
    );
  }

  return (
    <>
      {localidades.length > 0 && (
        <SelectorDeLocalidad
          localidades={localidades}
          nombre={localidad}
          onElegir={(n, cp) => {
            setLocalidad(n);
            if (!cp) return;
            // Con una localidad de la lista el cálculo es inmediato: no hace falta tocar el botón.
            setEscrito(cp);
            setConsultado(cp);
            const z = zonaPorCodigoPostal(zonas, cp);
            if (z) guardarEleccion({ delivery: "shipping", zone: z.nombre, cp });
          }}
        />
      )}
      {(localidades.length === 0 || localidad === OTRA_LOCALIDAD) && <form className="pdp-cp" onSubmit={consultar}>
        <input
          aria-label="Tu código postal"
          placeholder="Tu código postal"
          inputMode="text"
          autoComplete="postal-code"
          maxLength={10}
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
        />
        <button type="submit" aria-label="Calcular el envío"><Plus size={20} /></button>
      </form>}
      {consultado.trim() !== "" && (
        <p className="form-error" role="alert">
          {valido ? "Todavía no llegamos a ese código postal." : "Escribí los 4 números de tu código postal."}
          {settings.whatsapp && (
            <>
              {" "}
              <a className="text-link" href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer">Consultanos por WhatsApp</a>
            </>
          )}
        </p>
      )}
      {retiro}
    </>
  );
}
