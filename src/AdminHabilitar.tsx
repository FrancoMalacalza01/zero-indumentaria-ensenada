import { useMemo, useRef, useState } from "react";
import { PackageCheck } from "lucide-react";
import catalogoImportado from "./men-catalog.json";
import { fichasParaHabilitar, TOPE_UNIDADES_POR_TALLE } from "./importarCatalogo.mjs";
import type { AjustesHombre } from "./menOverrides.mjs";
import type { Panel } from "./useServerPanel";
import type { Product } from "./types";

type Resultado = { hechas: number; fallidas: { nombre: string; motivo: string }[]; detenido: boolean };

/**
 * Habilita la compra online de todas las prendas del catálogo importado de una vez.
 *
 * Las 961 prendas de Mistral y Brooksfield se ven en la tienda pero no se pueden comprar hasta que
 * tengan stock. Acá el local decide cuántas unidades por talle poner y las habilita todas; después
 * ajusta o saca de la venta las que no tenga, desde Precios o editándolas.
 *
 * Esto NO inventa stock por su cuenta: reparte lo que el local escribe, pide confirmarlo, y avisa lo
 * que implica: mientras esté así, cualquier cliente puede comprar esas unidades.
 */
export function AdminHabilitar({
  products,
  ajustes,
  panel,
  notify,
}: {
  products: Product[];
  ajustes: AjustesHombre;
  panel: Panel;
  notify: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [entiendo, setEntiendo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [avance, setAvance] = useState({ hechas: 0, total: 0 });
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const detener = useRef(false);

  const unidades = /^\d{1,3}$/.test(texto.trim()) ? Number(texto.trim()) : 0;
  const plan = useMemo(
    () =>
      fichasParaHabilitar({
        catalogo: catalogoImportado.products,
        productos: products,
        ajustes,
        unidades: unidades || 1,
      }),
    [products, ajustes, unidades],
  );
  const total = plan.fichas.length;
  const listo = panel.conectado && unidades >= 1 && unidades <= TOPE_UNIDADES_POR_TALLE && total > 0 && entiendo && !trabajando;

  async function habilitar() {
    if (!listo) return;
    setTrabajando(true);
    setResultado(null);
    detener.current = false;
    setAvance({ hechas: 0, total });
    const r = await panel.habilitarEnBloque(plan.fichas, products.length, (hechas, t) => setAvance({ hechas, total: t }), detener);
    setResultado(r);
    setTrabajando(false);
    notify(
      r.fallidas.length || r.detenido
        ? `Se habilitaron ${r.hechas} prendas; revisá el resultado`
        : `Se habilitaron ${r.hechas} prendas para la compra online`,
    );
  }

  return (
    <details className="admin-card admin-habilitar">
      <summary>
        <PackageCheck size={18} /> Habilitar la compra online de todo el catálogo
        {plan.fichas.length ? <span>{plan.fichas.length} prendas sin habilitar</span> : null}
      </summary>
      <div className="admin-habilitar-cuerpo">
        <p>
          Las prendas de Mistral y Brooksfield se ven en la tienda, pero <b>no se pueden comprar hasta que
          tengan stock</b>. Con esto las habilitás todas de una vez: elegís cuántas unidades por talle, y
          después sacás de la venta las que no tengas, desde la pestaña <i>Precios</i> o editándolas.
        </p>
        {!panel.conectado ? (
          <p className="admin-habilitar-aviso">Para habilitarlas hay que estar conectado al servidor (no en modo demo).</p>
        ) : total === 0 && !trabajando ? (
          <p>No quedan prendas por habilitar{plan.yaHabilitadas ? `: ya hay ${plan.yaHabilitadas} administradas` : ""}.</p>
        ) : (
          <>
            <label className="admin-field">
              Unidades por cada talle
              <input
                inputMode="numeric"
                placeholder="Por ejemplo 2"
                value={texto}
                disabled={trabajando}
                onChange={(e) => setTexto(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </label>
            <p className="admin-habilitar-detalle">
              {unidades >= 1 ? (
                <>
                  Se van a crear <b>{total}</b> prendas con <b>{unidades}</b> {unidades === 1 ? "unidad" : "unidades"} en cada
                  talle.
                </>
              ) : (
                <>Escribí cuántas unidades por talle querés poner (de 1 a {TOPE_UNIDADES_POR_TALLE}).</>
              )}{" "}
              {plan.dadasDeBaja ? `${plan.dadasDeBaja} dadas de baja quedan afuera. ` : ""}
              {plan.sinTalles ? `${plan.sinTalles} sin talles quedan afuera.` : ""}
            </p>
            <p className="admin-habilitar-aviso">
              <b>Ojo:</b> mientras estén así, cualquier cliente puede comprar esas unidades. Si no las tenés, vas a
              vender lo que no hay. Ponelas solo si podés conseguirlas o querés dejar el catálogo abierto.
            </p>
            <label className="config-switch">
              <input type="checkbox" checked={entiendo} disabled={trabajando} onChange={(e) => setEntiendo(e.target.checked)} />
              <span>Entiendo que se van a poder comprar online</span>
            </label>
            <div className="admin-habilitar-acciones">
              <button className="admin-button" disabled={!listo} onClick={habilitar}>
                {trabajando ? "Habilitando…" : `Habilitar ${total} prendas`}
              </button>
              {trabajando && (
                <button className="admin-button admin-button-outline" onClick={() => (detener.current = true)}>
                  Detener
                </button>
              )}
            </div>
            {trabajando && (
              <p role="status">
                {avance.hechas} de {avance.total}…
              </p>
            )}
          </>
        )}
        {resultado && (
          <div role="status" className="admin-habilitar-resultado">
            <p>
              <b>{resultado.hechas}</b> prendas habilitadas{resultado.detenido ? " (se detuvo antes de terminar)" : ""}.
              {resultado.fallidas.length ? ` ${resultado.fallidas.length} no se pudieron guardar.` : ""}
            </p>
            {resultado.fallidas.length > 0 && (
              <ul>
                {resultado.fallidas.slice(0, 5).map((f) => (
                  <li key={f.nombre}>
                    {f.nombre}: {f.motivo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
