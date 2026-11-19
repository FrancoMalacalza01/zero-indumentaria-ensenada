import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, MessageCircle, Ruler, ShieldCheck } from "lucide-react";
import { money, useStore } from "./Store";
import { paymentOptions } from "./payment";
import { Link } from "./router";
import { cuitFormateado } from "./settingsMap.mjs";
import type { Settings } from "./types";

/**
 * Las páginas de texto legal de la tienda.
 *
 * QUÉ SON Y QUÉ NO SON. Son el texto que la ley argentina obliga a publicar a
 * quien vende por internet, armado sobre las normas que están citadas al pie
 * de cada una. **No son asesoramiento legal.** Antes de abrir la tienda de
 * verdad conviene que las lea un abogado, sobre todo los términos: una
 * cláusula de más puede ser peor que no tener términos.
 *
 * LO QUE A PROPÓSITO NO DICEN. La Disposición 377/2026 actualizó el listado
 * de cláusulas abusivas de los contratos de consumo y apuntó especialmente a
 * la contratación digital. Por eso acá no hay ninguna cláusula que:
 *
 * - le dé al local el derecho exclusivo de interpretar los términos;
 * - lo autorice a modificarlos unilateralmente sin avisar;
 * - le permita rescindir sin causa mientras el cliente cumple;
 * - limite su responsabilidad por una prenda fallada;
 * - haga renunciar al cliente al arrepentimiento o a la garantía legal.
 *
 * Ninguna de esas cláusulas vale, y ponerlas igual es lo que convierte unos
 * términos en un problema.
 *
 * LOS DATOS SALEN DE LA CONFIGURACIÓN. Nombre, CUIT, domicilio y la tabla de
 * medidas los carga el dueño desde el panel. Si falta alguno, la página lo
 * dice en vez de inventarlo: un dato legal inventado es peor que uno vacío.
 */

function Pendiente({ children }: { children: ReactNode }) {
  return <span className="legal-pendiente">{children}</span>;
}

/** Quién vende, para el pie de cada página legal. */
function QuienVende({ settings }: { settings: Settings }) {
  const e = settings.empresa;
  const d = settings.direccion;
  return (
    <div className="legal-identidad">
      <h3>Quién vende</h3>
      <p>
        {e.razonSocial || <Pendiente>Falta cargar el nombre o razón social</Pendiente>}
        {e.cuit ? ` · CUIT ${cuitFormateado(e.cuit)}` : null}
        {!e.cuit && <Pendiente> · Falta cargar el CUIT</Pendiente>}
      </p>
      <p>
        {e.domicilioLegal ||
          `${d.calle}, ${d.ciudad}, ${d.provincia} (CP ${d.cp})`}
      </p>
      {(settings.whatsapp || e.emailContacto) && (
        <p>
          Consultas y reclamos:{" "}
          {settings.whatsapp && (
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
          {settings.whatsapp && e.emailContacto ? " · " : ""}
          {e.emailContacto && (
            <a href={`mailto:${e.emailContacto}`}>{e.emailContacto}</a>
          )}
        </p>
      )}
      <p className="legal-nota">
        Si no llegamos a un acuerdo, podés hacer el reclamo en la{" "}
        <a
          href="https://www.argentina.gob.ar/servicio/iniciar-un-reclamo-ante-defensa-del-consumidor"
          target="_blank"
          rel="noreferrer"
        >
          Ventanilla Federal Única de Defensa del Consumidor
        </a>
        .
      </p>
    </div>
  );
}

/**
 * El botón de arrepentimiento, en su propia página.
 *
 * La Disposición 954/2025 —que reemplazó a la Resolución 424/2020— pide que
 * el link esté **a simple vista, en lugar destacado y en el primer acceso**, y
 * que usarlo no obligue a registrarse ni a hacer ningún otro trámite. Por eso
 * esto es una página propia enlazada desde el pie de todas las pantallas, y
 * no un párrafo adentro de otra cosa.
 */
export function Arrepentimiento() {
  const { settings } = useStore();
  const dev = settings.devoluciones;
  const [quien, setQuien] = useState("");
  const [pedido, setPedido] = useState("");
  const [cuando, setCuando] = useState("");
  const mensaje = [
    "Hola, quiero ejercer el derecho de arrepentimiento de mi compra.",
    "",
    quien ? `Nombre: ${quien}` : "",
    pedido ? `Pedido: ${pedido}` : "",
    cuando ? `Fecha de la compra o de la entrega: ${cuando}` : "",
    "",
    `Dentro de los ${dev.dias} días corridos que da la ley.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
  return (
    <main className="section legal-page">
      <span className="eyebrow dark">BOTÓN DE ARREPENTIMIENTO</span>
      <h1>
        Te arrepentiste.
        <br />
        No hace falta explicar nada.
      </h1>

      <section className="legal-block legal-destacado">
        <p>
          Tenés <b>{dev.dias} días corridos</b> desde que recibís la compra o
          desde que la hacés, lo que pase último, para arrepentirte. No tenés
          que dar ningún motivo y te devolvemos todo lo que pagaste.
        </p>
        <p>
          <b>El costo de devolverla lo pagamos nosotros.</b> No hay monto
          mínimo, no hay condiciones y no se puede renunciar: es la Ley 24.240
          de Defensa del Consumidor.
        </p>
        <p className="legal-nota">
          Completá lo que sepas y se abre el mensaje listo para mandar. Te
          contestamos con un código de seguimiento dentro de las 24 horas.
        </p>
        <div className="legal-form">
          <label className="field">
            Tu nombre
            <input
              type="text"
              maxLength={60}
              value={quien}
              onChange={(e) => setQuien(e.target.value)}
            />
          </label>
          <label className="field">
            Número de pedido
            <input
              type="text"
              maxLength={20}
              placeholder="M-00001"
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
            />
          </label>
          <label className="field">
            Fecha de la compra o la entrega
            <input
              type="text"
              maxLength={30}
              placeholder="15/10/2026"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
            />
          </label>
        </div>
        <a
          className="button button-green"
          href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} />
          Enviar mi arrepentimiento
        </a>
        {settings.empresa.emailContacto && (
          <a
            className="text-link"
            href={`mailto:${settings.empresa.emailContacto}?subject=${encodeURIComponent(
              "Arrepentimiento de compra",
            )}&body=${encodeURIComponent(mensaje)}`}
          >
            O mandanos un mail
          </a>
        )}
      </section>

      <section className="legal-block">
        <h2>Qué pasa después</h2>
        <ol>
          <li>Te contestamos dentro de las 24 horas con un código.</li>
          <li>
            Coordinamos cómo devolver la prenda. <b>El envío lo pagamos
            nosotros</b>, así que no tenés que poner plata.
          </li>
          <li>
            Cuando la recibimos, te devolvemos lo que pagaste por el mismo
            medio por el que pagaste.
          </li>
        </ol>
        <p className="legal-nota">
          ¿Era un problema de talle y no te querés arrepentir?{" "}
          <Link className="text-link" to="/devoluciones">
            Mirá cambios y devoluciones
          </Link>
          .
        </p>
      </section>

      <QuienVende settings={settings} />
      <p className="legal-fuente">
        Ley 24.240, art. 34 · Disposición 954/2025 de la Subsecretaría de
        Defensa del Consumidor y Lealtad Comercial, que reemplazó a la
        Resolución 424/2020.
      </p>
    </main>
  );
}

/**
 * La tabla de medidas.
 *
 * La Ley 27.521 (SUNITI) obliga a los locales a exhibir la tabla de medidas
 * corporales normalizadas, y en las ventas electrónicas a tenerla **en un
 * lugar de fácil acceso y claramente identificable**. Las medidas las carga
 * el local desde el panel: acá no hay ninguna de fábrica porque inventar una
 * tabla de talles sería exactamente lo que la ley vino a evitar.
 */
export function Talles() {
  const { settings } = useStore();
  const filas = settings.talles.filas;
  return (
    <main className="section legal-page">
      <span className="eyebrow dark">TABLA DE TALLES</span>
      <h1>
        Tu talle,
        <br />
        en centímetros.
      </h1>
      <p className="legal-intro">
        Los talles de esta tienda se corresponden con estas medidas
        corporales. Medite con una cinta, sin apretar, y buscá la fila que te
        queda más cerca.
      </p>

      {filas.length ? (
        <>
          <div className="tabla-talles-marco">
            <table className="tabla-talles">
              <thead>
                <tr>
                  <th>TALLE</th>
                  <th>PECHO (cm)</th>
                  <th>CINTURA (cm)</th>
                  <th>CADERA (cm)</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.talle}>
                    <td>
                      <b>{f.talle}</b>
                    </td>
                    <td>{f.pecho || "—"}</td>
                    <td>{f.cintura || "—"}</td>
                    <td>{f.cadera || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {settings.talles.nota && (
            <p className="legal-nota">{settings.talles.nota}</p>
          )}
        </>
      ) : (
        <div className="legal-block legal-destacado">
          <p>
            <Pendiente>
              La tabla de medidas todavía no está cargada.
            </Pendiente>
          </p>
          <p>
            Hasta que esté, escribinos y te decimos las medidas de la prenda
            que te interesa. Si el talle no era, el cambio corre por nuestra
            cuenta dentro de los {settings.devoluciones.dias} días.
          </p>
          {settings.whatsapp && (
            <a
              className="button button-green"
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} /> Consultar medidas
            </a>
          )}
        </div>
      )}

      <section className="legal-block">
        <h2>Cómo medirte</h2>
        <ul>
          <li>
            <b>Pecho:</b> por la parte más ancha, con los brazos relajados.
          </li>
          <li>
            <b>Cintura:</b> por la parte más angosta, arriba del ombligo.
          </li>
          <li>
            <b>Cadera:</b> por la parte más ancha, con los pies juntos.
          </li>
        </ul>
        <p className="legal-nota">
          Si quedás entre dos talles, conviene el más grande. Y si no era,{" "}
          <Link className="text-link" to="/devoluciones">
            se cambia
          </Link>
          .
        </p>
      </section>

      <p className="legal-fuente">
        Ley 27.521, Sistema Único Normalizado de Identificación de Talles de
        Indumentaria (SUNITI), y su Decreto reglamentario 375/2021.
      </p>
    </main>
  );
}

/** Términos y condiciones de venta. */
export function Terminos() {
  const { settings } = useStore();
  const e = settings.empresa;
  const dev = settings.devoluciones;
  const zonas = settings.envio.zonas.map((z) => z.nombre).join(", ");
  const quien = e.razonSocial || "el local";
  const opciones = paymentOptions(settings);
  return (
    <main className="section legal-page">
      <span className="eyebrow dark">TÉRMINOS Y CONDICIONES</span>
      <h1>
        Las reglas,
        <br />
        en castellano.
      </h1>
      <p className="legal-intro">
        Esto es lo que vale cuando comprás en esta tienda. Está escrito para
        entenderse: si algo no se entiende, preguntá antes de comprar.
      </p>

      <section className="legal-block">
        <h2>1. Quién vende</h2>
        <p>
          Las ventas de este sitio las hace{" "}
          <b>
            {e.razonSocial || (
              <Pendiente>[falta cargar el nombre o razón social]</Pendiente>
            )}
          </b>
          {e.cuit ? (
            <>, CUIT {cuitFormateado(e.cuit)}</>
          ) : (
            <Pendiente>, [falta cargar el CUIT]</Pendiente>
          )}
          , con domicilio en{" "}
          {e.domicilioLegal ||
            `${settings.direccion.calle}, ${settings.direccion.ciudad}`}
          .
        </p>
      </section>

      <section className="legal-block">
        <h2>2. Precios</h2>
        <p>
          Los precios están en <b>pesos argentinos</b>, son finales e incluyen
          los impuestos. El precio que vale es el que figura al momento de
          cerrar el pedido.
        </p>
        <p>
          El costo del envío se muestra aparte antes de confirmar, y se suma
          al total. {zonas ? `Hacemos envíos a ${zonas}.` : ""}
        </p>
        {settings.pago.descuentoContado > 0 && (
          <p>
            El descuento del {settings.pago.descuentoContado}% por pago en
            efectivo o transferencia se aplica al cobrar. Pagando con tarjeta,
            el precio es el de lista: no cobramos recargo por pagar con
            tarjeta.
          </p>
        )}
        {settings.pago.credito && settings.pago.cuotasMaximas > 1 && (
          <p>
            Si pagás en cuotas, antes de cobrarte te informamos el precio de
            contado, la cantidad y el monto de cada cuota y el costo
            financiero total.
          </p>
        )}
      </section>

      <section className="legal-block">
        <h2>3. Stock, confirmación y cancelación</h2>
        <p>
          Cuando confirmás el pedido, las prendas quedan reservadas a tu
          nombre y el stock se descuenta en ese momento. Si una prenda no
          estuviera disponible, te avisamos y te devolvemos lo que hayas
          pagado por ella.
        </p>
        <p>
          El pedido queda registrado con un número, y te mandamos la
          confirmación por el medio que dejaste. Guardalo: es lo que usamos
          para encontrarlo.
        </p>
        <p>
          Podés <b>cancelar el pedido mientras no haya sido despachado</b>:
          escribinos con el número de pedido. Si ya lo habías pagado, te
          devolvemos el importe por el mismo medio. Una vez despachado, vale
          lo que dice la sección de arrepentimiento, cambios y garantía.
        </p>
      </section>

      <section className="legal-block">
        <h2>4. Formas de pago</h2>
        {opciones.length > 0 && (
          <p>
            Podés pagar con: <b>{opciones.map((o) => o.label).join(", ")}</b>.
            Todos los pagos están sujetos a que el importe se acredite y se
            verifique.
          </p>
        )}
        <p>
          El sitio no guarda datos de tu tarjeta. Si pagás online, el cobro lo
          procesa la plataforma de pagos y los datos de la tarjeta los
          maneja ella, no nosotros; si pagás en el local, es con el posnet o en
          efectivo al retirar. Lo que se coordina por WhatsApp o por
          transferencia se confirma con el comprobante. No somos responsables
          por las interrupciones del servicio de la plataforma de pagos, pero
          si te cobraron y el pedido no se pudo tomar, te devolvemos el
          importe.
        </p>
      </section>

      <section className="legal-block">
        <h2>5. Entregas y costo del envío</h2>
        <p>
          Podés <b>retirar en el local sin costo</b>, o pedir envío a las
          zonas que figuran en el checkout{zonas ? ` (${zonas})` : ""}. El
          costo del envío se calcula por zona y, cuando va por Correo
          Argentino, por el peso y el destino, y te lo mostramos{" "}
          <b>antes de confirmar la compra</b>.
        </p>
        <p>
          <b>El costo del envío lo paga quien compra</b>
          {settings.envio.envioGratisDesde > 0 ? (
            <>
              , salvo en compras de{" "}
              <b>{money(settings.envio.envioGratisDesde)} o más</b> (sin contar
              el envío), que lo pagamos nosotros
            </>
          ) : null}
          .
        </p>
        <p>
          Los plazos son estimados y dependen de la zona y, en Correo
          Argentino, de su servicio; se cuentan desde que despachamos el
          pedido. No se puede elegir el día ni la hora de entrega: podés dejar
          sugerencias al hacer el pedido, pero quedan sujetas a cómo trabaja
          el correo. Si retirás en el local, el día y la hora se acuerdan con
          vos.
        </p>
        <p>
          La dirección de entrega es la que vos indiques y puede ser distinta
          de tu domicilio. <b>Revisala con cuidado</b>: es tu responsabilidad
          que sea correcta para que el envío llegue bien y a tiempo. Cuando el
          pedido sale te mandamos el número de seguimiento para que lo veas en
          la página de Correo Argentino.
        </p>
      </section>

      <section className="legal-block">
        <h2>6. Arrepentimiento, cambios y garantía</h2>
        <p>
          Tenés <b>{dev.dias} días corridos</b> para arrepentirte de la compra
          sin dar motivo, y <b>el envío de vuelta lo pagamos nosotros</b>. Las
          prendas nuevas tienen <b>garantía legal de seis meses</b>: si viene
          fallada, la cambiamos o te devolvemos la plata, y el envío también
          corre por nuestra cuenta. Esto lo dice la Ley 24.240 y no depende de
          ninguna condición nuestra.
        </p>
        <p>
          El cambio por talle o color es otra cosa: es una cortesía nuestra, con
          sus condiciones y{" "}
          {dev.cambioGratisDesde > 0
            ? "el envío a cargo de quien compra salvo en compras grandes"
            : "el envío siempre a cargo de quien compra"}
          . Todo está en{" "}
          <Link className="text-link" to="/devoluciones">
            cambios y devoluciones
          </Link>
          .
        </p>
      </section>

      <section className="legal-block">
        <h2>7. Facturación</h2>
        <p>
          Con tu compra te damos el comprobante correspondiente, por el mail o
          el WhatsApp que nos hayas dejado.
        </p>
      </section>

      <section className="legal-block">
        <h2>8. Tus datos</h2>
        <p>
          Usamos tu nombre, tu contacto y la dirección de entrega sólo para
          hacerte llegar el pedido y responderte. El sitio usa conexión segura
          (HTTPS) para que lo que escribís viaje cifrado. Está todo explicado
          en la{" "}
          <Link className="text-link" to="/privacidad">
            política de privacidad
          </Link>
          , conforme a la Ley 25.326.
        </p>
      </section>

      <section className="legal-block">
        <h2>9. Marcas y fotos</h2>
        <p>
          Las marcas, fotos y descripciones de las prendas pertenecen a sus
          titulares (Mistral, Brooksfield y las demás marcas que vendemos). El
          diseño y los textos propios de esta tienda son de {quien}. No se
          pueden copiar ni usar sin permiso.
        </p>
      </section>

      <section className="legal-block">
        <h2>10. Si cambiamos algo</h2>
        <p>
          Si modificamos estos términos, la versión que vale para tu compra es
          la que estaba publicada cuando la hiciste. Un cambio posterior no te
          alcanza.
        </p>
      </section>

      <section className="legal-block">
        <h2>11. Reclamos</h2>
        <p>
          Lo primero es escribirnos: la mayoría de las cosas se resuelven en
          una conversación. Si aun así no llegamos a un acuerdo, podés
          reclamar ante Defensa del Consumidor. Nada de lo que dice esta
          página te hace renunciar a los derechos que te da la Ley 24.240.
        </p>
      </section>

      <QuienVende settings={settings} />
      <p className="legal-fuente">
        Ley 24.240 de Defensa del Consumidor · Código Civil y Comercial,
        contratos de consumo · Disposición 377/2026 sobre cláusulas abusivas.
        Esto es un resumen hecho sobre esas normas para que {quien} lo use como
        base, no asesoramiento legal: antes de abrir la tienda conviene que lo
        lea un abogado.
      </p>
    </main>
  );
}

/** Política de privacidad. */
export function Privacidad() {
  const { settings } = useStore();
  const e = settings.empresa;
  const contacto = e.emailContacto;
  return (
    <main className="section legal-page">
      <span className="eyebrow dark">PRIVACIDAD</span>
      <h1>
        Qué sabemos de vos
        <br />y para qué.
      </h1>
      <p className="legal-intro">
        Lo corto: te pedimos lo mínimo para entregarte lo que comprás, no lo
        vendemos a nadie, y podés pedirnos que lo borremos.
      </p>

      <section className="legal-block">
        <h2>Qué datos tomamos</h2>
        <ul>
          <li>
            <b>Tu nombre</b>, para saber de quién es el pedido.
          </li>
          <li>
            <b>Tu mail</b>, si lo dejás, para mandarte la confirmación.
          </li>
          <li>
            <b>La zona de envío</b> y, al coordinar, la dirección.
          </li>
          <li>
            <b>Qué compraste</b>, porque es el pedido.
          </li>
        </ul>
        <p>
          Como cualquier sitio, el servidor puede guardar datos técnicos de la
          visita (la dirección IP y las páginas que se piden) para que la tienda
          ande bien y para detectar problemas de seguridad. No los usamos para
          identificarte ni para hacerte publicidad.
        </p>
        <p className="legal-nota">
          No te pedimos DNI, ni fecha de nacimiento, ni datos de tarjeta. El
          sitio no guarda datos de tarjetas: de eso se encarga la plataforma
          de pagos.
        </p>
      </section>

      <section className="legal-block">
        <h2>Para qué los usamos</h2>
        <p>
          Para preparar y entregar tu pedido, responderte, y cumplir con lo
          que la ley nos obliga a conservar de una venta. Nada más.{" "}
          <b>No vendemos ni cedemos tus datos</b> a terceros con fines
          publicitarios.
        </p>
        <p>
          Los únicos que ven algo son los servicios que necesitamos para que
          la tienda funcione: donde está alojada la base de datos, la
          plataforma de pagos cuando pagás online, y el correo cuando te
          mandamos la confirmación. Cada uno ve sólo lo suyo.
        </p>
      </section>

      <section className="legal-block">
        <h2>Tus derechos</h2>
        <p>
          Podés pedirnos en cualquier momento que te digamos qué datos tuyos
          tenemos, que los corrijamos, los actualicemos o los borremos.
          {contacto ? (
            <>
              {" "}Escribinos a <b>{contacto}</b> con el asunto{" "}
              <b>"Acceso a datos personales"</b>.
            </>
          ) : (
            " Escribinos y lo hacemos."
          )}{" "}
          Podemos pedirte que te identifiques y que nos digas a qué datos te
          referís.
        </p>
        <p>
          Te respondemos <b>dentro de los 10 días corridos</b> y corregimos o
          borramos lo que corresponda <b>dentro de los 5 días hábiles</b>. El
          servicio es gratuito. Sólo conservamos lo que la ley nos obliga a
          guardar de una venta.
        </p>
        <p className="legal-nota">
          El titular de los datos personales tiene la facultad de ejercer el
          derecho de acceso a los mismos en forma gratuita a intervalos no
          inferiores a seis meses, salvo que se acredite un interés legítimo al
          efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley
          N° 25.326. La Agencia de Acceso a la Información Pública, en su
          carácter de órgano de control de la Ley N° 25.326, tiene la atribución
          de atender las denuncias y reclamos que interpongan quienes resulten
          afectados en sus derechos por incumplimiento de las normas vigentes
          en materia de protección de datos personales.
        </p>
      </section>

      <section className="legal-block">
        <h2>Cuánto los guardamos</h2>
        <p>
          Lo que haga falta para cumplir con el pedido y con los plazos que
          exige la ley para una venta. Después se borran.
        </p>
      </section>

      <section className="legal-block">
        <h2>Cookies</h2>
        <p>
          Este sitio no usa cookies de publicidad ni de seguimiento de
          terceros. Guarda en tu navegador lo que hace falta para que la
          tienda funcione —tu bolsa de compras y tus favoritos— y eso no sale
          de tu dispositivo.
        </p>
      </section>

      <section className="legal-block">
        <h2>Seguridad</h2>
        <p>
          Tomamos medidas razonables para proteger tus datos y que nadie sin
          autorización los vea, cambie o borre: el sitio usa conexión segura
          (HTTPS), el acceso al panel es sólo para quienes trabajan en el local
          y le pedimos lo mismo de los servicios que usamos. Ningún sistema de
          internet es infalible; si hubiera un problema que te afecte, te
          avisamos.
        </p>
      </section>

      <section className="legal-block">
        <h2>Menores de edad</h2>
        <p>
          La tienda es para quienes tienen edad legal para comprar. Si sos
          menor de 18 años, comprá con un adulto responsable y no nos dejes
          datos personales sin que lo sepa. Si sos madre, padre o tutor y creés
          que un menor nos dejó datos, escribinos y los borramos.
        </p>
      </section>

      <section className="legal-block">
        <h2>Si el negocio cambia o la ley lo exige</h2>
        <p>
          Si el negocio se transfiere, tus datos seguirán protegidos con lo que
          dice esta política. Sólo los damos a un juez o a un organismo del
          Estado cuando lo piden en la forma que corresponde, o cuando es
          necesario para cumplir una obligación legal o defender un derecho.
        </p>
      </section>

      <section className="legal-block">
        <h2>Si cambiamos esta política</h2>
        <p>
          Si la modificamos, publicamos la versión nueva acá. La que vale para
          tus datos es la que estaba publicada cuando los diste, y si el
          cambio es importante lo destacamos en esta página.
        </p>
      </section>

      <section className="legal-block">
        <h2>Contacto</h2>
        <p>
          Para cualquier duda sobre esta política o sobre tus datos:{" "}
          {contacto ? <b>{contacto}</b> : null}
          {contacto && settings.whatsapp ? " o " : ""}
          {settings.whatsapp ? (
            <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>
          ) : null}
          {!contacto && !settings.whatsapp && <Pendiente>Falta cargar un mail o WhatsApp de contacto.</Pendiente>}
          .
        </p>
      </section>

      <QuienVende settings={settings} />
      <p className="legal-fuente">
        Ley 25.326 de Protección de los Datos Personales y su Decreto
        reglamentario 1558/2001.{" "}
        {!e.razonSocial && (
          <Pendiente>
            Falta cargar quién es el responsable de los datos.
          </Pendiente>
        )}
      </p>
    </main>
  );
}

/** El bloque de links legales del pie, igual en todas las pantallas. */
export function LegalesDelPie() {
  return (
    <>
      <Link to="/terminos">Términos y condiciones</Link>
      <Link to="/privacidad">Política de privacidad</Link>
      <Link to="/devoluciones">Cambios y devoluciones</Link>
      <Link to="/talles">
        <Ruler size={13} /> Tabla de talles
      </Link>
      {/* La Disposición 954/2025 lo pide a simple vista y en el primer
          acceso: por eso está en el pie de todas las pantallas y se llama
          exactamente así. */}
      <Link className="pie-arrepentimiento" to="/arrepentimiento">
        <ShieldCheck size={13} /> Botón de arrepentimiento
      </Link>
      <a
        href="https://www.argentina.gob.ar/servicio/iniciar-un-reclamo-ante-defensa-del-consumidor"
        target="_blank"
        rel="noreferrer"
      >
        Defensa del Consumidor <ArrowRight size={12} />
      </a>
    </>
  );
}
