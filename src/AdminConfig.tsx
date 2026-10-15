import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CircleHelp,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Settings, ZonaEnvio } from "./types";
import { prepararImagen } from "./imagen";
import { money } from "./Store";

/**
 * La pantalla donde el dueño carga lo que antes estaba en el código.
 *
 * Tres cosas que importan y que están acá a propósito:
 *
 * 1. **Las ayudas de cada forma de pago.** No son decoración: dicen qué le
 *    cuesta cada medio y qué no se puede hacer. Lo más importante: cobrar
 *    más por pagar con tarjeta está prohibido, así que el campo que hay es
 *    un descuento por contado, no un recargo.
 * 2. **Los topes de las devoluciones.** El umbral configurable vale sólo
 *    para el cambio por talle o color. El arrepentimiento y la prenda
 *    fallada los paga el local siempre, y eso no se puede configurar porque
 *    no es una decisión comercial: es la ley.
 * 3. **El QR de Cuenta DNI se carga como imagen.** No hace falta pegar una
 *    URL ni subirla a ningún lado: se achica y se guarda con el resto de la
 *    configuración.
 */

function Ayuda({ children }: { children: ReactNode }) {
  return (
    <p className="config-ayuda">
      <CircleHelp size={14} />
      <span>{children}</span>
    </p>
  );
}

function Ojo({ children }: { children: ReactNode }) {
  return (
    <p className="config-ojo">
      <TriangleAlert size={14} />
      <span>{children}</span>
    </p>
  );
}

export default function AdminConfig({
  settings,
  onSave,
  conectado,
  notify,
}: {
  settings: Settings;
  /** Guarda en el servidor. Si tira error, el mensaje se muestra tal cual. */
  onSave: (settings: Settings) => Promise<void>;
  conectado: boolean;
  notify: (texto: string) => void;
}) {
  const [draft, setDraft] = useState<Settings>(() =>
    structuredClone(settings),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const qrInput = useRef<HTMLInputElement>(null);

  const tocado = JSON.stringify(draft) !== JSON.stringify(settings);

  function set<K extends keyof Settings>(clave: K, valor: Settings[K]) {
    setDraft((d) => ({ ...d, [clave]: valor }));
  }
  function setPago<K extends keyof Settings["pago"]>(
    clave: K,
    valor: Settings["pago"][K],
  ) {
    setDraft((d) => ({ ...d, pago: { ...d.pago, [clave]: valor } }));
  }
  function setBanco(clave: keyof Settings["pago"]["banco"], valor: string) {
    setDraft((d) => ({
      ...d,
      pago: { ...d.pago, banco: { ...d.pago.banco, [clave]: valor } },
    }));
  }
  function setDir(clave: keyof Settings["direccion"], valor: string) {
    setDraft((d) => ({ ...d, direccion: { ...d.direccion, [clave]: valor } }));
  }
  function setDev<K extends keyof Settings["devoluciones"]>(
    clave: K,
    valor: Settings["devoluciones"][K],
  ) {
    setDraft((d) => ({
      ...d,
      devoluciones: { ...d.devoluciones, [clave]: valor },
    }));
  }
  function setZonas(zonas: ZonaEnvio[]) {
    setDraft((d) => ({ ...d, envio: { ...d.envio, zonas } }));
  }
  function editarZona(i: number, cambio: Partial<ZonaEnvio>) {
    setZonas(draft.envio.zonas.map((z, j) => (j === i ? { ...z, ...cambio } : z)));
  }

  async function cargarQr(file?: File) {
    if (!file) return;
    try {
      // El QR es un cuadrado chico: 800 px alcanzan de sobra para escanearlo
      // y pesan mucho menos que la foto que sale del celular.
      setPago("cuentaDniQr", await prepararImagen(file, 800));
      notify("QR de Cuenta DNI cargado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la imagen.");
    }
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      await onSave(draft);
      notify("Configuración guardada");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la configuración.",
      );
    }
    setGuardando(false);
  }

  return (
    <section className="admin-card admin-config">
      {!conectado && (
        <div className="admin-local-banner">
          <TriangleAlert size={16} />
          <p>
            <b>Modo demo.</b> Podés mirar y probar, pero para que estos datos
            queden guardados hay que entrar con usuario.
          </p>
        </div>
      )}

      <div className="config-bloque">
        <h2>El local</h2>
        <div className="config-grid">
          <label className="admin-field">
            WhatsApp
            <input
              type="text"
              inputMode="tel"
              placeholder="5492211234567"
              value={draft.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Horarios
            <input
              type="text"
              placeholder="Lun a sáb de 10 a 19"
              value={draft.direccion.horarios}
              onChange={(e) => setDir("horarios", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Calle y número
            <input
              type="text"
              value={draft.direccion.calle}
              onChange={(e) => setDir("calle", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Ciudad
            <input
              type="text"
              value={draft.direccion.ciudad}
              onChange={(e) => setDir("ciudad", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Provincia
            <input
              type="text"
              value={draft.direccion.provincia}
              onChange={(e) => setDir("provincia", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Código postal
            <input
              type="text"
              value={draft.direccion.cp}
              onChange={(e) => setDir("cp", e.target.value)}
            />
          </label>
        </div>
        <Ayuda>
          El WhatsApp va con el código de país y sin el "+", todo junto. Con
          esto vacío, el pedido se abre en WhatsApp con el mensaje escrito pero
          el cliente tiene que elegir el contacto a mano.
        </Ayuda>
      </div>

      <div className="config-bloque">
        <h2>Cobrar antes de entregar</h2>
        <div className="config-grid">
          <label className="admin-field">
            Link de pago de Mercado Pago
            <input
              type="url"
              placeholder="https://mpago.la/..."
              value={draft.pago.mercadoPagoUrl}
              onChange={(e) => setPago("mercadoPagoUrl", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Alias o CVU de Mercado Pago
            <input
              type="text"
              value={draft.pago.mercadoPagoAlias}
              onChange={(e) => setPago("mercadoPagoAlias", e.target.value)}
            />
          </label>
        </div>
        <Ayuda>
          <b>Mercado Pago.</b> El link lleva el monto fijo con el que lo
          creaste, así que sirve para una seña o un precio redondo, no para el
          total de cualquier bolsa. Cobra comisión por venta y libera el dinero
          según el plazo que elijas: cuanto antes lo querés, más caro sale. El
          número exacto está en tu cuenta, en <i>Tu negocio → Costos</i>; no lo
          ponemos acá porque cambia.
        </Ayuda>

        <label className="config-switch">
          <input
            type="checkbox"
            checked={draft.pago.mercadoPagoOnline}
            onChange={(e) => setPago("mercadoPagoOnline", e.target.checked)}
          />
          <span>Cobrar online el monto exacto de la bolsa</span>
        </label>
        <Ayuda>
          Con esto prendido, al cerrar la compra el cliente ve{" "}
          <b>"Pagar ahora"</b> y va a Mercado Pago con el total exacto del
          pedido, envío incluido. Cuando el pago se acredita, el pedido queda
          marcado como pagado solo y pasa a <i>Preparando</i>.
        </Ayuda>
        <Ojo>
          <b>Falta un paso que no se hace desde acá.</b> El token de tu cuenta
          de Mercado Pago no puede vivir en el sitio: con él, cualquiera
          cobraría en tu nombre. Hay que cargarlo como secreto en Supabase
          (Edge Functions → Secrets → <code>MP_ACCESS_TOKEN</code>), y sale de
          Mercado Pago en <i>Tu negocio → Credenciales → Credenciales de
          producción</i>. Mientras no esté, el botón le avisa al cliente que el
          cobro online no está configurado y no se rompe nada.
        </Ojo>

        <div className="config-grid">
          <label className="admin-field">
            Alias o CVU de Cuenta DNI
            <input
              type="text"
              value={draft.pago.cuentaDniAlias}
              onChange={(e) => setPago("cuentaDniAlias", e.target.value)}
            />
          </label>
          <div className="admin-field">
            QR de Cuenta DNI
            <div className="config-qr">
              {draft.pago.cuentaDniQr ? (
                <>
                  <img src={draft.pago.cuentaDniQr} alt="QR de Cuenta DNI" />
                  <button
                    type="button"
                    className="admin-text-button"
                    onClick={() => setPago("cuentaDniQr", "")}
                  >
                    <X size={14} /> Quitar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => qrInput.current?.click()}
                >
                  <ImagePlus size={15} /> Cargar imagen del QR
                </button>
              )}
              <input
                ref={qrInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => cargarQr(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>
        <Ayuda>
          <b>Cuenta DNI.</b> Sí, se puede cargar el QR: sacale una foto o
          bajate la imagen desde la app y subila acá. Se achica y se guarda con
          el resto de la configuración; el cliente lo escanea desde Cuenta DNI.
          Una transferencia entre cuentas no tiene comisión. El QR de comercio,
          el que acredita directo, se pide en Banco Provincia dándote de alta
          como comercio.
        </Ayuda>

        <div className="config-grid">
          <label className="admin-field">
            Banco
            <input
              type="text"
              value={draft.pago.banco.nombre}
              onChange={(e) => setBanco("nombre", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Titular
            <input
              type="text"
              value={draft.pago.banco.titular}
              onChange={(e) => setBanco("titular", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Alias
            <input
              type="text"
              value={draft.pago.banco.alias}
              onChange={(e) => setBanco("alias", e.target.value)}
            />
          </label>
          <label className="admin-field">
            CBU
            <input
              type="text"
              inputMode="numeric"
              value={draft.pago.banco.cbu}
              onChange={(e) => setBanco("cbu", e.target.value)}
            />
          </label>
        </div>
        <Ayuda>
          <b>Transferencia.</b> No tiene comisión: es lo más barato para el
          local. En cambio es lo más trabajoso de controlar, porque hay que ir
          cruzando comprobantes.
        </Ayuda>
      </div>

      <div className="config-bloque">
        <h2>Cobrar en el local</h2>
        <div className="config-switches">
          {(
            [
              ["efectivo", "Efectivo"],
              ["debito", "Tarjeta de débito"],
              ["credito", "Tarjeta de crédito"],
            ] as const
          ).map(([clave, nombre]) => (
            <label className="config-switch" key={clave}>
              <input
                type="checkbox"
                checked={draft.pago[clave]}
                onChange={(e) => setPago(clave, e.target.checked)}
              />
              <span>{nombre}</span>
            </label>
          ))}
        </div>
        <div className="config-grid">
          <label className="admin-field">
            Cuotas sin interés que bancás
            <input
              type="number"
              min={0}
              max={24}
              value={draft.pago.cuotasSinInteres}
              onChange={(e) =>
                setPago("cuotasSinInteres", Math.max(0, Number(e.target.value) || 0))
              }
            />
          </label>
          <label className="admin-field">
            Cuotas máximas del posnet
            <input
              type="number"
              min={0}
              max={24}
              value={draft.pago.cuotasMaximas}
              onChange={(e) =>
                setPago("cuotasMaximas", Math.max(0, Number(e.target.value) || 0))
              }
            />
          </label>
          <label className="admin-field">
            Descuento por efectivo o transferencia (%)
            <input
              type="number"
              min={0}
              max={90}
              value={draft.pago.descuentoContado}
              onChange={(e) =>
                setPago(
                  "descuentoContado",
                  Math.min(90, Math.max(0, Number(e.target.value) || 0)),
                )
              }
            />
          </label>
        </div>
        <Ayuda>
          <b>Débito y crédito.</b> Van por el posnet del local. Cada uno paga
          comisión al que te dio la terminal, y el plazo en que te acreditan
          también lo arreglás con ellos. <b>Las cuotas sin interés las bancás
          vos</b>: si ofrecés tres, el banco te descuenta el costo de
          financiarlas y cobrás menos. Las cuotas "con interés del banco" no te
          cuestan nada extra, pero el cliente paga más.
        </Ayuda>
        <Ojo>
          Por eso el campo es un <b>descuento por efectivo</b> y no un recargo
          por tarjeta: cobrar más por pagar con tarjeta está prohibido (Ley
          25.065, art. 37, y las resoluciones de Defensa del Consumidor que lo
          recuerdan). La promo por pago en efectivo es la forma legal de hacer
          la misma diferencia. El sitio muestra el precio de lista y avisa el
          descuento; vos lo aplicás al cobrar.
        </Ojo>
        <Ojo>
          Toda venta necesita factura o ticket, cobres como cobres. El medio de
          pago no cambia eso. Lo fiscal conviene verlo con tu contador.
        </Ojo>
      </div>

      <div className="config-bloque">
        <h2>Envíos</h2>
        <div className="config-zonas">
          {draft.envio.zonas.map((z, i) => (
            <div className="config-zona" key={z.id || i}>
              <label className="admin-field">
                Zona
                <input
                  type="text"
                  value={z.nombre}
                  onChange={(e) => editarZona(i, { nombre: e.target.value })}
                />
              </label>
              <label className="admin-field">
                Costo (vacío = a coordinar)
                <input
                  type="number"
                  min={0}
                  placeholder="a coordinar"
                  value={z.costo === undefined ? "" : z.costo}
                  onChange={(e) =>
                    editarZona(i, {
                      costo:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="admin-field">
                Cómo llega
                <select
                  value={z.tipo}
                  onChange={(e) =>
                    editarZona(i, {
                      tipo: e.target.value === "correo" ? "correo" : "local",
                    })
                  }
                >
                  <option value="local">Reparto propio</option>
                  <option value="correo">Correo Argentino</option>
                </select>
              </label>
              <button
                type="button"
                className="admin-text-button"
                onClick={() =>
                  setZonas(draft.envio.zonas.filter((_, j) => j !== i))
                }
                aria-label={`Quitar ${z.nombre}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="admin-button"
          onClick={() =>
            setZonas([
              ...draft.envio.zonas,
              {
                id: `zona-${Date.now().toString(36)}`,
                nombre: "",
                tipo: "local",
              },
            ])
          }
        >
          <Plus size={15} /> Agregar zona
        </button>
        <div className="config-grid">
          <label className="admin-field">
            Envío sin cargo desde ($)
            <input
              type="number"
              min={0}
              value={draft.envio.envioGratisDesde}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  envio: {
                    ...d.envio,
                    envioGratisDesde: Math.max(0, Number(e.target.value) || 0),
                  },
                }))
              }
            />
          </label>
        </div>
        <Ayuda>
          Una zona sin costo cargado no sale gratis: el checkout dice "a
          coordinar por WhatsApp", que es mejor que inventarle un número al
          cliente. El umbral se mira contra las prendas, sin el envío, y con{" "}
          <b>0</b> el envío gratis no existe. Para las zonas que van por
          Correo Argentino, el precio depende del peso y del código postal:
          cotizalo en el sitio del Correo y cargá acá un promedio, o dejalo
          vacío y cobralo al coordinar.
        </Ayuda>
      </div>

      <div className="config-bloque">
        <h2>Cambios y devoluciones</h2>
        <div className="config-grid">
          <label className="admin-field">
            Días para arrepentirse
            <input
              type="number"
              min={10}
              max={90}
              value={draft.devoluciones.dias}
              onChange={(e) =>
                setDev("dias", Math.max(10, Number(e.target.value) || 10))
              }
            />
          </label>
          <label className="admin-field">
            Cambio con envío sin cargo desde ($)
            <input
              type="number"
              min={0}
              value={draft.devoluciones.cambioGratisDesde}
              onChange={(e) =>
                setDev(
                  "cambioGratisDesde",
                  Math.max(0, Number(e.target.value) || 0),
                )
              }
            />
          </label>
          <label className="admin-field">
            Dónde se reciben (vacío = el local)
            <input
              type="text"
              value={draft.devoluciones.direccion}
              onChange={(e) => setDev("direccion", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Aclaración extra
            <input
              type="text"
              value={draft.devoluciones.notas}
              onChange={(e) => setDev("notas", e.target.value)}
            />
          </label>
        </div>
        <Ojo>
          El monto de <b>{money(draft.devoluciones.cambioGratisDesde)}</b> vale
          sólo para el <b>cambio por talle o color</b>, que es una cortesía
          tuya. Si el cliente se arrepiente de la compra, o si la prenda vino
          fallada, <b>el envío de vuelta lo pagás vos siempre</b>, sin importar
          el monto: lo dice la Ley 24.240 y no se puede poner condiciones ni
          pedirle que renuncie. Por eso no hay un campo para cambiarlo.
        </Ojo>
        <Ayuda>
          Los días no pueden bajar de 10 porque ese es el mínimo legal. Podés
          dar más si querés. La tienda publica todo esto en{" "}
          <b>/devoluciones</b>, con el botón de arrepentimiento que la
          Resolución 424/2020 exige tener a la vista. Cuando alguien lo usa,
          tenés 24 horas para contestarle con un código de seguimiento.
        </Ayuda>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="config-guardar">
        <button
          type="button"
          className="admin-button admin-button-primary"
          onClick={guardar}
          disabled={!tocado || guardando || !conectado}
        >
          <Save size={15} />
          {guardando ? "Guardando…" : "Guardar configuración"}
        </button>
        {tocado && (
          <button
            type="button"
            className="admin-text-button"
            onClick={() => {
              setDraft(structuredClone(settings));
              setError("");
            }}
          >
            Descartar cambios
          </button>
        )}
        {!tocado && <span className="config-limpio">Sin cambios por guardar</span>}
      </div>
    </section>
  );
}
