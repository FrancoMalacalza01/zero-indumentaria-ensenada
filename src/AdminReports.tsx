import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CircleHelp, Package, TrendingUp } from "lucide-react";
import type { Movement, Order, Product } from "./types";
import { reporte } from "./reportes.mjs";

/**
 * Los números del negocio.
 *
 * LA CUENTA NO ESTÁ ACÁ: está en `reportes.mjs`, que se puede probar sin
 * navegador. Un reporte que suma mal es peor que no tener reporte, porque el
 * dueño decide con eso qué comprar.
 *
 * LO QUE NO SE MEZCLA. "Unidades vendidas" incluye el mostrador; "facturado"
 * no, porque la venta del mostrador se carga para saber el stock y no tiene
 * importe. Están separados a propósito en vez de juntos en un número lindo y
 * falso. Y "facturado" no es "cobrado": lo segundo es sólo lo que Mercado
 * Pago confirmó.
 */

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const PERIODOS = [
  { dias: 7, nombre: "7 días" },
  { dias: 30, nombre: "30 días" },
  { dias: 90, nombre: "90 días" },
] as const;

const diaCorto = (dia: string) => {
  // El día ya viene como "2026-10-15" en hora argentina: se arma al mediodía
  // para que ningún uso horario lo corra de día al formatearlo.
  const d = new Date(`${dia}T12:00:00`);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};
const diaLargo = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

function Tarjeta({
  titulo,
  valor,
  pie,
}: {
  titulo: string;
  valor: ReactNode;
  pie: string;
}) {
  return (
    <div className="reporte-tarjeta">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{pie}</small>
    </div>
  );
}

/**
 * Unidades por día.
 *
 * Una sola serie, así que un solo color y sin leyenda: el título dice qué es.
 * No se pone el número arriba de cada barra —serían treinta números y ninguno
 * se leería—: se marcan el día más alto y el de hoy, y el resto sale al pasar
 * el mouse. Cada barra lleva su texto para quien no ve el gráfico.
 */
function Barras({ datos }: { datos: { dia: string; unidades: number }[] }) {
  const tope = Math.max(1, ...datos.map((d) => d.unidades));
  const maximo = datos.reduce(
    (mejor, d) => (d.unidades > mejor.unidades ? d : mejor),
    datos[0] || { dia: "", unidades: 0 },
  );
  const hoy = datos[datos.length - 1];
  return (
    <div className="reporte-barras" role="img"
      aria-label={`Unidades vendidas por día: ${datos
        .map((d) => `${diaCorto(d.dia)}, ${d.unidades}`)
        .join("; ")}`}
    >
      {datos.map((d) => {
        const alto = d.unidades === 0 ? 0 : (d.unidades / tope) * 100;
        const destacado =
          d.unidades > 0 && (d.dia === maximo.dia || d.dia === hoy?.dia);
        return (
          <div className="reporte-barra" key={d.dia}>
            <div className="reporte-barra-pista">
              <div
                className="reporte-barra-fill"
                style={{ height: `${alto}%` }}
              >
                {/* El número va pegado a su barra, no arriba de la columna:
                    si no, el valor de un día flojo queda flotando al tope y
                    parece de otro día. */}
                {destacado && (
                  <span className="reporte-barra-valor">{d.unidades}</span>
                )}
              </div>
            </div>
            <span className="reporte-barra-dia">{diaCorto(d.dia)}</span>
            <span className="reporte-barra-globo">
              {diaLargo(d.dia)}: {d.unidades}{" "}
              {d.unidades === 1 ? "unidad" : "unidades"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminReports({
  products,
  movements,
  orders,
}: {
  products: Product[];
  movements: Movement[];
  orders: Order[];
}) {
  const [dias, setDias] = useState<number>(30);
  const r = useMemo(
    () => reporte(products, movements, orders, dias),
    [products, movements, orders, dias],
  );
  const hayDatos = r.unidades > 0 || r.pedidos > 0;

  return (
    <section className="admin-reportes">
      <div className="admin-filters reporte-filtros">
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            className={`admin-chip ${dias === p.dias ? "is-active" : ""}`}
            onClick={() => setDias(p.dias)}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="reporte-tarjetas">
        <Tarjeta
          titulo="Unidades vendidas"
          valor={r.unidades}
          pie={
            r.devueltas
              ? `${r.vendidasBrutas} vendidas menos ${r.devueltas} que volvieron`
              : `${r.unidadesMostrador} por mostrador · ${r.unidadesWeb} por la web`
          }
        />
        <Tarjeta
          titulo="Pedidos de la web"
          valor={r.pedidos}
          pie={r.pedidos ? `Ticket promedio ${money(r.ticket)}` : "Todavía ninguno"}
        />
        <Tarjeta
          titulo="Facturado por la web"
          valor={money(r.facturado)}
          pie={
            r.cobrado
              ? `${money(r.cobrado)} cobrado y confirmado`
              : "El mostrador no suma acá: se carga sin precio"
          }
        />
        <Tarjeta
          titulo="Plata en el perchero"
          valor={money(r.valorInventario)}
          pie="Lo publicado, a precio de venta"
        />
      </div>

      {!hayDatos ? (
        <div className="admin-card admin-empty">
          <Package size={28} />
          <h3>Todavía no hay ventas en este período</h3>
          <p>
            Cuando empiecen a entrar ventas del mostrador o pedidos de la web,
            los números aparecen acá solos.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-card reporte-card">
            <h2>Unidades por día</h2>
            <p className="reporte-nota">
              Mostrador y web juntos, tal como salieron ese día. Las
              devoluciones no le restan al día de la venta —no cambian lo que
              pasó el martes—, pero sí al total de arriba.
            </p>
            <Barras datos={r.porDia} />
          </div>

          <div className="reporte-grid">
            <div className="admin-card reporte-card">
              <h2>Lo que más se vende</h2>
              <table className="reporte-tabla">
                <thead>
                  <tr>
                    <th>PRENDA</th>
                    <th>VENDIDAS</th>
                    <th>QUEDAN</th>
                    <th>VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {r.masVendidos.slice(0, 10).map((p) => (
                    <tr key={p.productId}>
                      <td>{p.nombre}</td>
                      <td>
                        <strong>{p.unidades}</strong>
                      </td>
                      <td className={p.stockHoy <= 5 ? "reporte-poco" : ""}>
                        {p.stockHoy}
                      </td>
                      <td>{money(p.valorHoy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="reporte-nota">
                <CircleHelp size={13} /> "Valor" es lo vendido al precio de hoy.
                El historial no guarda a cuánto estaba cada prenda cuando se
                vendió, así que es una referencia y no la facturación.
              </p>
            </div>

            <div className="admin-card reporte-card">
              <h2>Talles que salen</h2>
              <ul className="reporte-talles">
                {r.talles.map((t) => (
                  <li key={t.talle}>
                    <b>{t.talle}</b>
                    <span>
                      {t.unidades} {t.unidades === 1 ? "unidad" : "unidades"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="reporte-grid">
            {r.porReponer.length > 0 && (
              <div className="admin-card reporte-card">
                <h2>
                  <TrendingUp size={17} /> Conviene reponer
                </h2>
                <p className="reporte-nota">
                  Se vendieron en el período y quedan 5 o menos. Es donde la
                  próxima compra al proveedor rinde más.
                </p>
                <ul className="reporte-lista">
                  {r.porReponer.map((p) => (
                    <li key={p.productId}>
                      <b>{p.nombre}</b>
                      <span>
                        vendió {p.unidades} · quedan{" "}
                        <strong className="reporte-poco">{p.stockHoy}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.quietos.length > 0 && (
              <div className="admin-card reporte-card">
                <h2>Lo que no se movió</h2>
                <p className="reporte-nota">
                  Publicado, con stock, y sin una sola venta en el período.
                  Ordenado por cuánta plata tiene parada.
                </p>
                <ul className="reporte-lista">
                  {r.quietos.slice(0, 10).map((p) => (
                    <li key={p.id}>
                      <b>{p.nombre}</b>
                      <span>
                        {p.stock} en stock · {money(p.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
