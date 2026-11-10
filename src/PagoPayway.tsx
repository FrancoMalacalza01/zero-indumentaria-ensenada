import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, CreditCard, Lock } from "lucide-react";
import { pagarConPayway } from "./funciones";
import {
  MEDIOS,
  binDe,
  codigoValido,
  cuerpoDeToken,
  dniValido,
  tarjetaValida,
  vencimiento,
} from "../supabase/functions/_shared/payway.mjs";
import "./payway.css";

type Resultado = { estado: "aprobado" | "rechazado" | "pendiente" | "error"; mensaje: string };

/** "4507990000004905" -> "4507 9900 0000 4905": sólo para que se lea mejor mientras se escribe. */
const agrupar = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

/**
 * Cobro con tarjeta por Payway (modelo NO PCI).
 *
 * Los datos de la tarjeta salen de acá DIRECTO a Payway, que devuelve un token. A
 * nuestro servidor sólo le llega ese token, nunca el número, el vencimiento ni el
 * código. El número no se guarda en ningún lado: apenas se pide el token, el
 * formulario se vacía, salga como salga.
 */
export function PagoPayway({
  pedido,
  total,
  url,
  clavePublica,
  money,
}: {
  pedido: string;
  total: number;
  url: string;
  clavePublica: string;
  money: (n: number) => string;
}) {
  const [numero, setNumero] = useState("");
  const [venc, setVenc] = useState("");
  const [codigo, setCodigo] = useState("");
  const [titular, setTitular] = useState("");
  const [dni, setDni] = useState("");
  const [medio, setMedio] = useState<number>(MEDIOS[0].id);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cerrado = resultado?.estado === "aprobado" || resultado?.estado === "pendiente";

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || cerrado) return;
    setError("");
    const fecha = vencimiento(venc);
    if (!tarjetaValida(numero)) return setError("Revisá el número de la tarjeta.");
    if (!fecha) return setError("Revisá el vencimiento (por ejemplo 12/29): la tarjeta tiene que estar vigente.");
    if (!codigoValido(codigo)) return setError("Revisá el código de seguridad (3 o 4 números).");
    if (titular.trim().length < 3) return setError("Escribí el nombre como figura en la tarjeta.");
    if (!dniValido(dni)) return setError("Revisá el DNI: solo números, sin puntos.");

    setEnviando(true);
    const bin = binDe(numero);
    let token = "";
    try {
      const r = await fetch(`${url}/tokens`, {
        method: "POST",
        headers: { apikey: clavePublica, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(cuerpoDeToken({ numero, vencimiento: fecha, codigo, titular, dni })),
      });
      const datos = await r.json().catch(() => ({}));
      if (r.ok && typeof datos?.id === "string") token = datos.id;
      else if (r.status === 401 || r.status === 403)
        setError("El cobro con tarjeta no está disponible ahora. Escribinos por WhatsApp y lo resolvemos.");
      else setError("No pudimos validar la tarjeta. Revisá los datos y probá de nuevo.");
    } catch {
      setError("No pudimos conectar con el servicio de pagos. Probá de nuevo en un momento.");
    }
    // Pase lo que pase, los datos de la tarjeta no se quedan en pantalla ni en memoria.
    setNumero("");
    setVenc("");
    setCodigo("");
    if (!token) {
      setEnviando(false);
      return;
    }
    const r = await pagarConPayway({ pedido, token, bin, medio });
    setResultado(r);
    setEnviando(false);
  };

  return (
    <div className="payway">
      <h2>
        <CreditCard size={20} /> Pagar {money(total)} con tarjeta
      </h2>
      {resultado?.estado === "aprobado" ? (
        <p className="payway-ok" role="status">
          <CheckCircle2 size={20} /> ¡Pago aprobado! Ya empezamos a preparar tu pedido.
        </p>
      ) : resultado?.estado === "pendiente" ? (
        <p className="payway-aviso" role="status">
          {resultado.mensaje}
        </p>
      ) : (
        <form onSubmit={enviar} autoComplete="on" noValidate>
          <label>
            Medio de pago
            <select value={medio} onChange={(e) => setMedio(Number(e.target.value))}>
              {MEDIOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Número de tarjeta
            <input
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={numero}
              onChange={(e) => setNumero(agrupar(e.target.value))}
            />
          </label>
          <div className="payway-fila">
            <label>
              Vencimiento
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                maxLength={7}
                value={venc}
                onChange={(e) => setVenc(e.target.value.replace(/[^\d/]/g, ""))}
              />
            </label>
            <label>
              Código
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>
          <label>
            Nombre en la tarjeta
            <input autoComplete="cc-name" value={titular} onChange={(e) => setTitular(e.target.value)} />
          </label>
          <label>
            DNI del titular
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Solo números"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>
          {(error || resultado) && (
            <p className="form-error" role="alert">
              {error || resultado?.mensaje}
            </p>
          )}
          <button className="button button-green" disabled={enviando}>
            {enviando ? "Procesando el pago…" : `Pagar ${money(total)}`}
          </button>
          <small className="payway-nota">
            <Lock size={13} /> Los datos de tu tarjeta van directo a Payway: la tienda no los ve ni los guarda.
          </small>
        </form>
      )}
    </div>
  );
}
