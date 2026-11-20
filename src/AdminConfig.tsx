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
import { faltaParaVender, PLAZO_CORREO_CLASICO } from "./settingsMap.mjs";
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
  // Sobre el borrador, no sobre lo guardado: así el aviso se va apagando a
  // medida que se completan los campos, antes de apretar guardar.
  const faltan = faltaParaVender(draft);

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
  function setEmpresa(clave: keyof Settings["empresa"], valor: string) {
    setDraft((d) => ({ ...d, empresa: { ...d.empresa, [clave]: valor } }));
  }
  function setTalles(filas: Settings["talles"]["filas"]) {
    setDraft((d) => ({ ...d, talles: { ...d.talles, filas } }));
  }
  function editarTalle(i: number, cambio: Partial<Settings["talles"]["filas"][0]>) {
    setTalles(draft.talles.filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
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

      {faltan.length > 0 && (
        <div className="config-faltan">
          <h2>
            <TriangleAlert size={16} /> Para vender por internet falta cargar
            esto
          </h2>
          <p>
            No es una lista de caprichos: cada punto sale de algo que la ley
            argentina le exige a quien vende por internet. Lo que el sistema no
            puede hacer solo es inventar un CUIT o una tabla de medidas.
          </p>
          <ul>
            {faltan.map((f) => (
              <li key={f.id} className={f.impide ? "impide" : ""}>
                <b>{f.que}</b>
                <span>{f.porque}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="config-bloque">
        <h2>Quién vende</h2>
        <div className="config-grid">
          <label className="admin-field">
            Nombre o razón social
            <input
              type="text"
              placeholder="Zero Indumentaria"
              value={draft.empresa.razonSocial}
              onChange={(e) => setEmpresa("razonSocial", e.target.value)}
            />
          </label>
          <label className="admin-field">
            CUIT
            <input
              type="text"
              inputMode="numeric"
              placeholder="30-71234567-0"
              value={draft.empresa.cuit}
              onChange={(e) => setEmpresa("cuit", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Domicilio
            <input
              type="text"
              placeholder="La Merced 327, Ensenada, Buenos Aires"
              value={draft.empresa.domicilioLegal}
              onChange={(e) => setEmpresa("domicilioLegal", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Mail de contacto
            <input
              type="email"
              placeholder="hola@..."
              value={draft.empresa.emailContacto}
              onChange={(e) => setEmpresa("emailContacto", e.target.value)}
            />
          </label>
        </div>
        <Ayuda>
          Esto aparece en el pie de la tienda y en las páginas legales. El
          consumidor tiene derecho a saber a quién le compra antes de comprar
          (Ley 24.240, art. 4), y el domicilio es adonde puede dirigir un
          reclamo.
        </Ayuda>
      </div>

      <div className="config-bloque">
        <h2>Tabla de talles</h2>
        <div className="config-talles">
          {draft.talles.filas.map((f, i) => (
            <div className="config-talle" key={i}>
              <label className="admin-field">
                Talle
                <input
                  type="text"
                  value={f.talle}
                  onChange={(e) => editarTalle(i, { talle: e.target.value })}
                />
              </label>
              <label className="admin-field">
                Pecho (cm)
                <input
                  type="text"
                  inputMode="numeric"
                  value={f.pecho}
                  onChange={(e) => editarTalle(i, { pecho: e.target.value })}
                />
              </label>
              <label className="admin-field">
                Cintura (cm)
                <input
                  type="text"
                  inputMode="numeric"
                  value={f.cintura}
                  onChange={(e) => editarTalle(i, { cintura: e.target.value })}
                />
              </label>
              <label className="admin-field">
                Cadera (cm)
                <input
                  type="text"
                  inputMode="numeric"
                  value={f.cadera}
                  onChange={(e) => editarTalle(i, { cadera: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="admin-text-button"
                onClick={() =>
                  setTalles(draft.talles.filas.filter((_, j) => j !== i))
                }
                aria-label={`Quitar el talle ${f.talle}`}
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
            setTalles([
              ...draft.talles.filas,
              { talle: "", pecho: "", cintura: "", cadera: "" },
            ])
          }
        >
          <Plus size={15} /> Agregar un talle
        </button>
        <label className="admin-field config-ancho">
          Aclaración (opcional)
          <input
            type="text"
            placeholder="Las medidas son del cuerpo, no de la prenda."
            value={draft.talles.nota}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                talles: { ...d.talles, nota: e.target.value },
              }))
            }
          />
        </label>
        <Ojo>
          <b>Esto es obligatorio para vender ropa.</b> La Ley 27.521 (SUNITI)
          exige que la tabla de medidas corporales esté a la vista, y en las
          ventas por internet, en un lugar de fácil acceso y claramente
          identificable. La tienda la publica en <b>/talles</b>, enlazada desde
          el pie y desde cada prenda. Las medidas las cargás vos: el sistema no
          puede inventarlas, porque inventar una tabla de talles es justo lo
          que esa ley vino a evitar.
        </Ojo>
      </div>

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
          el cliente tiene que elegir el contacto a mano. Tampoco se muestra el
          botón <b>Consultar por WhatsApp</b> de las prendas de hombre: es lo que
          le permite al cliente preguntar por una prenda sin buscar el número.
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

        <label className="config-switch">
          <input
            type="checkbox"
            checked={draft.pago.paywayOnline}
            onChange={(e) => setPago("paywayOnline", e.target.checked)}
          />
          <span>Cobrar con tarjeta por Payway, dentro de la tienda</span>
        </label>
        <div className="config-grid">
          <label className="admin-field">
            Clave pública de Payway
            <input
              type="text"
              autoComplete="off"
              placeholder="La clave PÚBLICA (la privada no va acá)"
              value={draft.pago.paywayClavePublica}
              onChange={(e) => setPago("paywayClavePublica", e.target.value.trim())}
            />
          </label>
          <label className="admin-field">
            Dirección de la API de Payway
            <input
              type="url"
              value={draft.pago.paywayUrl}
              onChange={(e) => setPago("paywayUrl", e.target.value.trim())}
            />
          </label>
        </div>
        <Ayuda>
          <b>Payway.</b> Con esto prendido y la clave pública cargada, al cerrar
          la compra el cliente ve un formulario para pagar con tarjeta (Visa
          crédito o débito). Los datos de la tarjeta van{" "}
          <b>directo a Payway</b>: la tienda no los ve ni los guarda. El servidor
          cobra el monto exacto del pedido y, si el pago sale aprobado, el pedido
          queda pagado y pasa a <i>Preparando</i>. Mercado Pago sigue
          funcionando igual; podés tener los dos.
        </Ayuda>
        <Ojo>
          <b>Antes de prenderlo, falta lo que no se hace desde acá.</b> (1) La
          clave <b>privada</b> de Payway se carga como secreto en Supabase (Edge
          Functions → Secrets → <code>PAYWAY_PRIVATE_API_KEY</code>): con ella se
          cobra, así que no puede vivir en el sitio. (2) Empezá en{" "}
          <b>Sandbox</b> (la dirección que viene cargada): son claves de prueba
          y no se cobra de verdad. (3) Payway no habilita producción hasta
          aprobar los casos de prueba: pago aprobado, rechazado (códigos 05 y 51)
          y anulación. Al pasar, te dan las claves de producción y cambiás la
          dirección por <code>https://ventasonline.payway.com.ar/api/v2</code> y
          la clave privada del secreto. (4) Hacé primero un pago real de monto
          mínimo antes de abrirlo a todos.
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
                Códigos postales que cubre
                <input
                  type="text"
                  maxLength={600}
                  placeholder="ej. 1923, 1900-1909"
                  value={z.cp ?? ""}
                  onChange={(e) => editarZona(i, { cp: e.target.value })}
                />
              </label>
              <label className="admin-field">
                Cómo llega
                <select
                  value={z.tipo}
                  onChange={(e) => {
                    const correo = e.target.value === "correo";
                    editarZona(i, {
                      tipo: correo ? "correo" : "local",
                      // Al pasar a Correo, si no había plazo, entra el de
                      // fábrica: si no, quedaría sin decir nada sin que nadie
                      // lo haya decidido.
                      ...(correo && !z.plazo ? { plazo: PLAZO_CORREO_CLASICO } : {}),
                    });
                  }}
                >
                  <option value="local">Reparto propio</option>
                  <option value="correo">Correo Argentino</option>
                </select>
              </label>
              <label className="admin-field">
                Plazo estimado
                <input
                  type="text"
                  maxLength={80}
                  placeholder="sin plazo"
                  value={z.plazo ?? ""}
                  onChange={(e) => editarZona(i, { plazo: e.target.value })}
                />
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
          <br />
          <b>Plazo estimado:</b> es lo que lee el cliente al elegir la zona.
          Para Correo Argentino viene el de Paq.ar Clásico, 2 a 5 días hábiles,
          que el Correo cuenta desde que le entregás el paquete, no desde la
          compra; por eso el checkout dice "desde que despachamos tu pedido".
          Es el rango general: si tu experiencia con una zona es otra, ponelo
          acá. Vacío = no se dice ningún plazo.
        </Ayuda>
      </div>

      <div className="config-bloque">
        <h2>Pedidos sin pagar</h2>
        <div className="config-grid">
          <label className="admin-field">
            Se cancelan solos a las (horas)
            <input
              type="number"
              min={0}
              max={720}
              value={draft.pedidos.vencenEnHoras}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  pedidos: {
                    vencenEnHoras: Math.min(720, Math.max(0, Math.trunc(Number(e.target.value) || 0))),
                  },
                }))
              }
            />
          </label>
        </div>
        <Ayuda>
          Un pedido de pago online (tarjeta o Mercado Pago) que nadie pagó se cancela solo pasadas estas horas y
          las prendas vuelven al stock. Evita que pedidos sin pagar dejen una prenda "agotada". Con <b>0</b> no
          vencen. Los pedidos de efectivo o transferencia no vencen solos: los cancelás vos desde Pedidos.
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
            Días para cambiar por talle o color
            <input
              type="number"
              min={1}
              max={90}
              value={draft.devoluciones.cambioDias}
              onChange={(e) =>
                setDev("cambioDias", Math.min(90, Math.max(1, Number(e.target.value) || 30)))
              }
            />
          </label>
          <label className="admin-field">
            Cambio con envío sin cargo desde ($, 0 = lo paga siempre el cliente)
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
          {draft.devoluciones.cambioGratisDesde > 0 ? (
            <>El monto de <b>{money(draft.devoluciones.cambioGratisDesde)}</b> vale</>
          ) : (
            <>Con <b>0</b>, el envío del cambio lo paga <b>siempre el cliente</b>. El monto, si lo pones, vale</>
          )}{" "}
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
