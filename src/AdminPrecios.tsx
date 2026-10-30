import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Download,
  Pencil,
  Redo2,
  Tag,
  Search,
  SlidersHorizontal,
  Undo2,
  X,
} from "lucide-react";
import catalog from "./men-catalog.json";
import { money } from "./Store";
import { avisoDeCambio, leerPrecio } from "./menOverrides.mjs";
import type { AjustesHombre } from "./menOverrides.mjs";
import {
  OPERACIONES,
  REDONDEOS,
  anotar,
  aplicarCambios,
  aplicarFoto,
  capturar,
  deshacer,
  descuento,
  filasACsv,
  historialVacio,
  leerRegla,
  rehacer,
  variacion,

} from "./priceTools.mjs";
import { delMismoModelo, ofertasDelModelo, vistaPorModelo } from "./modelos.mjs";
import type {
  CambioArticulo,
  Historial,
  Operacion,
  Redondeo,
} from "./priceTools.mjs";
import type { Product } from "./types";

/**
 * Precios de todos los artículos, en una sola tabla.
 *
 * Reúne los productos de la tienda y el catálogo de hombre, que viven en
 * lugares distintos, para poder cambiarlos igual. Se trabaja como en una
 * planilla: se hace clic en un precio, se escribe, y Enter guarda y baja a la
 * fila siguiente. Para cambiar muchos de una vez se eligen y se aplica una
 * regla (subir un 10%, restar $2.000, fijar un precio) con redondeo, viendo
 * antes cómo queda cada uno. Todo se puede deshacer.
 *
 * Sacar de la venta no borra: el artículo deja de verse en la tienda y se
 * repone cuando vuelva. Borrar de verdad un producto de la tienda se hace
 * desde su editor, en *Productos y stock*.
 */
type Fuente = "db" | "men";
type Mover = -1 | 0 | 1;

type Articulo = {
  key: string;
  fuente: Fuente;
  id: string;
  nombre: string;
  marca: string;
  seccion: string;
  detalle: string;
  imagen: string;
  precio: number;
  /** Sólo hombre: lo que publica la marca. */
  precioMarca: number | null;
  /**
   * El precio anterior, el que se muestra tachado. Si existe, el artículo está
   * en oferta. Es el precio de partida del descuento.
   */
  antes?: number;
  /** Hombre con precio propio puesto por el local. */
  propio: boolean;
  activo: boolean;
};

type PrendaHombre = {
  id: string;
  brand: string;
  category: string;
  name: string;
  reference?: string;
  priceARS: number;
  images: string[];
  cover?: string;
};

const prendasHombre = catalog.products as PrendaHombre[];
const POR_PAGINA = 50;
const AVISO_RESALTADO = 1600;

type EstadoFiltro = "todos" | "venta" | "fuera" | "propio" | "oferta" | "tocados";
type Orden = { por: "nombre" | "marca" | "precio"; dir: 1 | -1 } | null;

function articulosDe(productos: Product[], ajustes: AjustesHombre): Articulo[] {
  const tienda = productos.map<Articulo>((p) => ({
    key: `db:${p.id}`,
    fuente: "db",
    id: p.id,
    nombre: p.name,
    marca: p.brand || "Zero",
    seccion: p.type,
    detalle: `${p.category} · ${p.color}`,
    imagen: p.image,
    precio: p.price,
    precioMarca: null,
    antes: p.oldPrice && p.oldPrice > p.price ? p.oldPrice : undefined,
    propio: false,
    activo: p.active,
  }));
  const importados = new Set(productos.map((p) => p.sourceCatalogId).filter(Boolean));
  const hombre = prendasHombre.filter((m) => !importados.has(m.id)).map<Articulo>((m) => {
    const a = ajustes[m.id];
    return {
      key: `men:${m.id}`,
      fuente: "men",
      id: m.id,
      nombre: m.name,
      marca: m.brand,
      seccion: m.category,
      detalle: m.reference || "",
      imagen: m.cover || m.images[0],
      precio: a?.price ?? m.priceARS,
      precioMarca: m.priceARS,
      antes: a?.price != null && a.old && a.old > a.price ? a.old : undefined,
      propio: a?.price != null,
      activo: a?.active !== false,
    };
  });
  return [...tienda, ...hombre];
}

/** Un cambio de precio para una celda: lo que lleva depende de qué artículo es. */
function cambioDePrecio(a: Articulo, precio: number | null): CambioArticulo {
  return a.fuente === "men"
    ? { fuente: "men", id: a.id, precio, precioMarca: a.precioMarca ?? undefined }
    : { fuente: "db", id: a.id, precio: precio ?? a.precio };
}

/** Cuánto cambió un precio, como una etiqueta: ▲ 10% / ▼ 8%. */
function Variacion({ antes, despues }: { antes: number; despues: number }) {
  const v = variacion(antes, despues);
  if (!v) return null;
  return (
    <span className={`admin-precios-var ${v > 0 ? "is-up" : "is-down"}`}>
      {v > 0 ? "▲" : "▼"} {Math.abs(v)}%
    </span>
  );
}

/** El precio mientras se escribe. Enter guarda y baja, Esc cancela. */
function EditorPrecio({
  art,
  onGuardar,
  onCancelar,
}: {
  art: Articulo;
  /** Devuelve false si el cambio no se hizo (por ejemplo, si no se confirmó). */
  onGuardar: (valor: number, mover: Mover) => boolean;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(String(art.precio));
  const [error, setError] = useState("");
  // Una vez que se guardó o se canceló, el blur que viene después (porque la
  // fila se cierra) no tiene que volver a guardar.
  const terminado = useRef(false);
  const lectura = leerPrecio(texto);

  function guardar(mover: Mover) {
    if (terminado.current) return;
    const r = leerPrecio(texto);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    terminado.current = true;
    if (!onGuardar(r.value, mover)) terminado.current = false;
  }
  function cancelar() {
    if (terminado.current) return;
    terminado.current = true;
    onCancelar();
  }

  return (
    <div className="admin-precios-celda is-editando">
      <div className="admin-precios-edicion">
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`Precio de ${art.nombre}`}
          aria-invalid={Boolean(error)}
          value={texto}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setTexto(e.target.value);
            setError("");
          }}
          onBlur={() => {
            // Hacer clic afuera guarda lo escrito si es un precio válido y
            // distinto; si no, vuelve atrás sin ruido.
            if (terminado.current) return;
            if (lectura.ok && lectura.value !== art.precio) guardar(0);
            else cancelar();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar(e.shiftKey ? -1 : 1);
            } else if (e.key === "Tab") {
              e.preventDefault();
              guardar(e.shiftKey ? -1 : 1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              guardar(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              guardar(-1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelar();
            }
          }}
        />
        <button
          className="admin-precios-icono is-ok"
          // Sin esto, el clic le saca el foco al campo y el blur guarda antes.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => guardar(0)}
          aria-label="Guardar precio"
        >
          <Check size={15} />
        </button>
        <button
          className="admin-precios-icono"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelar}
          aria-label="Cancelar"
        >
          <X size={15} />
        </button>
      </div>
      {error ? (
        <span className="admin-precios-error" role="alert">
          {error}
        </span>
      ) : lectura.ok && lectura.value !== art.precio ? (
        <span className="admin-precios-vivo">
          <Variacion antes={art.precio} despues={lectura.value} /> sobre{" "}
          {money(art.precio)}
        </span>
      ) : (
        <span className="admin-precios-ayuda">Enter guarda y baja · Esc cancela</span>
      )}
    </div>
  );
}

export default function AdminPrecios({
  productos,
  ajustes,
  conectado,
  onAplicar,
  notify,
}: {
  productos: Product[];
  ajustes: AjustesHombre;
  /** Con servidor se publica; sin él queda sólo en este navegador. */
  conectado: boolean;
  /**
   * Pone el estado nuevo en pantalla y lo manda al servidor. `tocados` son los
   * artículos que cambiaron, para mandar sólo esos.
   */
  onAplicar: (
    siguiente: { ajustes: AjustesHombre; productos: Product[] },
    tocados: { men: string[]; db: string[] },
  ) => void;
  notify: (texto: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fuente, setFuente] = useState<"todos" | Fuente>("todos");
  const [marca, setMarca] = useState("Todas");
  const [seccion, setSeccion] = useState("Todas");
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<Orden>(null);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Historial>(historialVacio);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [resaltados, setResaltados] = useState<Set<string>>(new Set());
  const [op, setOp] = useState<Operacion>("subir");
  const [valorTxt, setValorTxt] = useState("");
  const [redondeo, setRedondeo] = useState<Redondeo>("ninguno");
  // "poner en oferta" en una fila arma la regla y lleva el cursor al porcentaje.
  const [pedirFoco, setPedirFoco] = useState(false);
  // Una prenda está en la tienda y en el catálogo de hombre (una vez por color):
  // con esto prendido, un precio nuevo llega a todas sus versiones.
  const [propagar, setPropagar] = useState(true);
  const valorRef = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const articulos = useMemo(() => articulosDe(productos, ajustes), [productos, ajustes]);
  const porClave = useMemo(() => new Map(articulos.map((a) => [a.key, a])), [articulos]);
  const marcas = useMemo(() => [...new Set(articulos.map((a) => a.marca))].sort(), [articulos]);
  const secciones = useMemo(
    () => [...new Set(articulos.map((a) => a.seccion).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [articulos],
  );

  const resumen = useMemo(() => {
    let venta = 0;
    let propios = 0;
    let ofertas = 0;
    let min = Infinity;
    let max = 0;
    for (const a of articulos) {
      if (a.activo) venta++;
      if (a.propio) propios++;
      if (a.antes) ofertas++;
      if (a.precio < min) min = a.precio;
      if (a.precio > max) max = a.precio;
    }
    return { total: articulos.length, venta, fuera: articulos.length - venta, propios, ofertas, min, max };
  }, [articulos]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLocaleLowerCase("es-AR");
    const min = desde.trim() ? leerPrecio(desde) : null;
    const max = hasta.trim() ? leerPrecio(hasta) : null;
    return articulos.filter((a) => {
      if (fuente !== "todos" && a.fuente !== fuente) return false;
      if (marca !== "Todas" && a.marca !== marca) return false;
      if (seccion !== "Todas" && a.seccion !== seccion) return false;
      if (estado === "venta" && !a.activo) return false;
      if (estado === "fuera" && a.activo) return false;
      if (estado === "propio" && !a.propio) return false;
      if (estado === "oferta" && !a.antes) return false;
      if (estado === "tocados" && !tocados.has(a.key)) return false;
      if (min?.ok && a.precio < min.value) return false;
      if (max?.ok && a.precio > max.value) return false;
      return (
        !t ||
        `${a.nombre} ${a.detalle} ${a.seccion} ${a.marca}`
          .toLocaleLowerCase("es-AR")
          .includes(t)
      );
    });
  }, [articulos, busqueda, fuente, marca, seccion, estado, desde, hasta, tocados]);

  const ordenadas = useMemo(() => {
    if (!orden) return filtradas;
    const { por, dir } = orden;
    return [...filtradas].sort((a, b) => {
      if (por === "precio") return (a.precio - b.precio) * dir || a.nombre.localeCompare(b.nombre, "es");
      if (por === "marca")
        return a.marca.localeCompare(b.marca, "es") * dir || a.nombre.localeCompare(b.nombre, "es");
      return a.nombre.localeCompare(b.nombre, "es") * dir;
    });
  }, [filtradas, orden]);

  const pagina = ordenadas.slice(0, visibles);
  const sinTocar = () => setVisibles(POR_PAGINA);
  const todasLaPagina = pagina.length > 0 && pagina.every((a) => elegidas.has(a.key));

  // --- Aplicar, deshacer, rehacer -------------------------------------------

  function resaltar(claves: string[]) {
    clearTimeout(temporizador.current);
    setResaltados(new Set(claves));
    temporizador.current = setTimeout(() => setResaltados(new Set()), AVISO_RESALTADO);
  }

  function sufijoDemo(texto: string) {
    return conectado ? texto : `${texto} (sólo en este navegador: modo demo)`;
  }

  /** Hace un cambio, lo anota para poder deshacerlo y lo manda al servidor. */
  /**
   * Suma a los cambios de precio las otras versiones del mismo modelo, con el
   * mismo precio (y el mismo "antes", si es una oferta). Las que ya estaban en
   * los cambios no se tocan dos veces.
   */
  function conModelo(cambios: CambioArticulo[]): CambioArticulo[] {
    if (!propagar) return cambios;
    const yaEstan = new Set(cambios.map((c) => `${c.fuente}:${c.id}`));
    const extra: CambioArticulo[] = [];
    for (const c of cambios) {
      if (!("precio" in c)) continue;
      const a = porClave.get(`${c.fuente}:${c.id}`);
      if (!a) continue;
      for (const h of delMismoModelo(a, articulos)) {
        if (yaEstan.has(h.key)) continue;
        yaEstan.add(h.key);
        const hc = cambioDePrecio(h, c.precio ?? null);
        extra.push("antes" in c ? { ...hc, antes: c.antes } : hc);
      }
    }
    return [...cambios, ...extra];
  }

  function ejecutar(cambios: CambioArticulo[], etiqueta: string, aviso: string) {
    if (!cambios.length) return;
    const idsMen = cambios.filter((c) => c.fuente === "men").map((c) => c.id);
    const idsDb = cambios.filter((c) => c.fuente === "db").map((c) => c.id);
    const antes = capturar(ajustes, productos, idsMen, idsDb);
    const siguiente = aplicarCambios(ajustes, productos, cambios);
    const despues = capturar(siguiente.ajustes, siguiente.productos, idsMen, idsDb);
    setHistorial((h) => anotar(h, { etiqueta, antes, despues }));
    const claves = [...idsMen.map((i) => `men:${i}`), ...idsDb.map((i) => `db:${i}`)];
    setTocados((t) => new Set([...t, ...claves]));
    resaltar(claves);
    onAplicar(siguiente, { men: idsMen, db: idsDb });
    notify(sufijoDemo(aviso));
  }

  function volverAtras() {
    const r = deshacer(historial);
    if (!r.entrada) return;
    const siguiente = aplicarFoto(ajustes, productos, r.entrada.antes);
    setHistorial(r.historial);
    resaltar([
      ...Object.keys(r.entrada.antes.men).map((i) => `men:${i}`),
      ...Object.keys(r.entrada.antes.db).map((i) => `db:${i}`),
    ]);
    onAplicar(siguiente, {
      men: Object.keys(r.entrada.antes.men),
      db: Object.keys(r.entrada.antes.db),
    });
    notify(sufijoDemo(`Deshecho: ${r.entrada.etiqueta}`));
  }

  function volverAHacer() {
    const r = rehacer(historial);
    if (!r.entrada) return;
    const siguiente = aplicarFoto(ajustes, productos, r.entrada.despues);
    setHistorial(r.historial);
    resaltar([
      ...Object.keys(r.entrada.despues.men).map((i) => `men:${i}`),
      ...Object.keys(r.entrada.despues.db).map((i) => `db:${i}`),
    ]);
    onAplicar(siguiente, {
      men: Object.keys(r.entrada.despues.men),
      db: Object.keys(r.entrada.despues.db),
    });
    notify(sufijoDemo(`Rehecho: ${r.entrada.etiqueta}`));
  }

  // Ctrl+Z deshace y Ctrl+Mayús+Z (o Ctrl+Y) rehace, salvo mientras se escribe en
  // un campo: ahí Ctrl+Z es del campo. Se vuelve a enganchar en cada render para
  // no usar un estado viejo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        volverAtras();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        volverAHacer();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  // --- Edición en la celda ---------------------------------------------------

  function guardarPrecio(a: Articulo, valor: number, mover: Mover): boolean {
    // El vecino se elige antes de aplicar: si la tabla está ordenada por precio,
    // la fila se va a mover y "la de abajo" es la que se veía.
    const i = pagina.findIndex((x) => x.key === a.key);
    const vecino = mover ? pagina[i + mover] : undefined;
    if (valor !== a.precio) {
      const aviso = avisoDeCambio(a.precio, valor);
      if (aviso && !confirm(`${a.nombre}\n\n${aviso}`)) return false;
      const cambios = conModelo([cambioDePrecio(a, valor)]);
      const otras = cambios.length - 1;
      ejecutar(
        cambios,
        `Precio de ${a.nombre}${otras ? ` y ${otras} versiones` : ""}`,
        `${a.nombre}: ${money(valor)}${otras ? ` · y ${otras} versiones más del modelo` : ""}`,
      );
    }
    setEditando(vecino ? vecino.key : null);
    return true;
  }

  function alternarVenta(a: Articulo) {
    ejecutar(
      [{ fuente: a.fuente, id: a.id, activo: !a.activo }],
      `${a.activo ? "Sacar de la venta" : "Poner a la venta"}: ${a.nombre}`,
      `${a.nombre}: ${a.activo ? "fuera de venta" : "a la venta"}`,
    );
  }

  // --- Cambios en bloque -----------------------------------------------------

  const seleccion = useMemo(
    () => articulos.filter((a) => elegidas.has(a.key)),
    [articulos, elegidas],
  );
  const regla = useMemo(() => leerRegla(op, valorTxt), [op, valorTxt]);
  const vista = useMemo(
    () =>
      regla.ok
        ? vistaPorModelo(seleccion, articulos, op, regla.value, redondeo, propagar)
        : null,
    [regla, seleccion, articulos, op, redondeo, propagar],
  );
  const unidad = OPERACIONES.find((o) => o.id === op)?.unidad ?? "";
  useEffect(() => {
    if (pedirFoco && valorRef.current) {
      valorRef.current.focus();
      valorRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      setPedirFoco(false);
    }
  }, [pedirFoco, seleccion.length]);
  const hayPropios = seleccion.some((a) => a.fuente === "men" && a.propio);
  const hayOfertas = seleccion.some((a) => a.antes);
  const hayEnVenta = seleccion.some((a) => a.activo);
  const hayFuera = seleccion.some((a) => !a.activo);

  function aplicarRegla() {
    if (!vista || !regla.ok) return;
    const esOferta = op === "oferta";
    const cambios = vista.filas
      .filter((f) => f.estado === "cambia")
      .map((f) => {
          const c = cambioDePrecio(porClave.get(f.key)!, f.despues);
          // La oferta guarda el precio de partida como el anterior: es el tachado.
          return esOferta ? { ...c, antes: f.base } : c;
        });
    const etiqueta = OPERACIONES.find((o) => o.id === op)!.etiqueta;
    const n = cambios.length;
    ejecutar(
      cambios,
      `${etiqueta} ${regla.value}${unidad} a ${n} artículos`,
      esOferta
        ? `${n} ${n === 1 ? "artículo en oferta" : "artículos en oferta"}`
        : `${n} ${n === 1 ? "precio cambiado" : "precios cambiados"}`,
    );
  }

  /** Vuelve los artículos al precio anterior y saca el tachado. */
  function terminarOfertas(objetivo: Articulo[]) {
    const ofertas = ofertasDelModelo(objetivo, articulos, propagar);
    if (!ofertas.length) return;
    const n = ofertas.length;
    ejecutar(
      ofertas.map((a) => ({ ...cambioDePrecio(a, a.antes!), antes: null })),
      n === 1 ? `Terminar la oferta: ${ofertas[0].nombre}` : `Terminar la oferta de ${n} artículos`,
      n === 1
        ? `${ofertas[0].nombre}: oferta terminada, vuelve a ${money(ofertas[0].antes!)}`
        : `${n} ofertas terminadas`,
    );
  }

  function ofertaRapida(a: Articulo) {
    setElegidas(new Set([a.key]));
    setOp("oferta");
    setValorTxt("");
    setPedirFoco(true);
  }

  function cambiarEstadoDeLaSeleccion(activo: boolean) {
    const objetivo = seleccion.filter((a) => a.activo !== activo);
    if (!objetivo.length) return;
    const n = objetivo.length;
    const cosa = `${n} ${n === 1 ? "artículo" : "artículos"}`;
    if (
      !activo &&
      !confirm(
        `¿Sacar de la venta ${cosa}?\n\nDejan de verse en la tienda. No se borran: se pueden poner a la venta de nuevo, y también deshacer desde acá.`,
      )
    )
      return;
    ejecutar(
      objetivo.map((a) => ({ fuente: a.fuente, id: a.id, activo })),
      `${activo ? "Poner a la venta" : "Sacar de la venta"} ${cosa}`,
      `${cosa}: ${activo ? "a la venta" : "fuera de venta"}`,
    );
  }

  function volverAlPrecioDeLaMarca() {
    const objetivo = seleccion.filter((a) => a.fuente === "men" && a.propio);
    if (!objetivo.length) return;
    ejecutar(
      objetivo.map((a) => cambioDePrecio(a, null)),
      `Volver al precio de la marca en ${objetivo.length} artículos`,
      `${objetivo.length} ${objetivo.length === 1 ? "artículo vuelve" : "artículos vuelven"} al precio de la marca`,
    );
  }

  // --- Orden, selección, exportar ---------------------------------------------

  function ordenarPor(por: "nombre" | "marca" | "precio") {
    setOrden((o) =>
      !o || o.por !== por ? { por, dir: 1 } : o.dir === 1 ? { por, dir: -1 } : null,
    );
    sinTocar();
  }
  const flecha = (por: string) =>
    orden?.por !== por ? <ArrowUpDown size={13} /> : orden.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  const ariaOrden = (por: string) =>
    orden?.por !== por ? "none" : orden.dir === 1 ? "ascending" : "descending";

  function alternar(clave: string) {
    const siguiente = new Set(elegidas);
    if (siguiente.has(clave)) siguiente.delete(clave);
    else siguiente.add(clave);
    setElegidas(siguiente);
  }

  function exportar() {
    const filas: string[][] = [
      ["Origen", "Artículo", "Marca", "Sección", "Código", "Precio marca", "Precio actual", "Precio anterior", "Estado"],
      ...ordenadas.map((a) => [
        a.fuente === "db" ? "Tienda" : "Hombre",
        a.nombre,
        a.marca,
        a.seccion,
        a.detalle,
        a.precioMarca === null ? "" : String(a.precioMarca),
        String(a.precio),
        a.antes ? String(a.antes) : "",
        a.activo ? "A la venta" : "Fuera de venta",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([filasACsv(filas)], { type: "text/csv;charset=utf-8;" }),
    );
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "zero-precios.csv";
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`${ordenadas.length} artículos exportados`);
  }

  const ultimo = historial.pasado[historial.pasado.length - 1];
  const proximo = historial.futuro[historial.futuro.length - 1];
  const filtrosActivos =
    busqueda || fuente !== "todos" || marca !== "Todas" || seccion !== "Todas" || estado !== "todos" || desde || hasta;

  return (
    <section className="admin-card admin-inventory-card admin-precios">
      <div className="admin-inventory-heading">
        <div>
          <h2>
            Precios <span>{resumen.total}</span>
          </h2>
          <p>
            Clic en un precio para cambiarlo: <b>Enter</b> guarda y baja a la
            siguiente. Para muchos a la vez, elegilos y aplicá una regla.
          </p>
          <p className="admin-precios-resumen">
            <b>{resumen.venta}</b> a la venta · <b>{resumen.fuera}</b> fuera de
            venta · <b>{resumen.propios}</b> con precio propio ·{" "}
            <b>{resumen.ofertas}</b> en oferta · de{" "}
            <b>{money(resumen.min)}</b> a <b>{money(resumen.max)}</b>
          </p>
        </div>
        <div className="admin-precios-acciones">
          <button
            className="admin-button admin-button-outline"
            onClick={volverAtras}
            disabled={!ultimo}
            title={ultimo ? `Deshacer: ${ultimo.etiqueta} (Ctrl+Z)` : "No hay nada para deshacer"}
          >
            <Undo2 size={16} /> Deshacer
          </button>
          <button
            className="admin-button admin-button-outline"
            onClick={volverAHacer}
            disabled={!proximo}
            title={proximo ? `Rehacer: ${proximo.etiqueta} (Ctrl+Mayús+Z)` : "No hay nada para rehacer"}
          >
            <Redo2 size={16} /> Rehacer
          </button>
          <button className="admin-button admin-button-outline" onClick={exportar}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>
      <label className="admin-precios-propagar">
        <input
          type="checkbox"
          checked={propagar}
          onChange={(e) => setPropagar(e.target.checked)}
        />
        <span>
          <b>Cambiar todas las versiones del modelo.</b> Un precio u oferta nuevo
          se aplica también a las demás prendas con el mismo nombre (por ejemplo,
          los colores de la <i>Remera Blank MC</i> en la tienda y en hombre). En cambios
          en bloque, si elegís varias versiones del mismo modelo, se usa como
          referencia la primera de la lista completa.
        </span>
      </label>

      <div className="admin-filters">
        <label className="admin-search">
          <Search size={18} />
          <input
            aria-label="Buscar artículos"
            placeholder="Buscar por nombre, código o sección…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              sinTocar();
            }}
          />
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por origen"
            value={fuente}
            onChange={(e) => {
              setFuente(e.target.value as "todos" | Fuente);
              sinTocar();
            }}
          >
            <option value="todos">Tienda y hombre</option>
            <option value="db">Sólo tienda</option>
            <option value="men">Sólo hombre</option>
          </select>
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por marca"
            value={marca}
            onChange={(e) => {
              setMarca(e.target.value);
              sinTocar();
            }}
          >
            <option>Todas</option>
            {marcas.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por sección"
            value={seccion}
            onChange={(e) => {
              setSeccion(e.target.value);
              sinTocar();
            }}
          >
            <option value="Todas">Todas las secciones</option>
            {secciones.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="admin-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoFiltro);
              sinTocar();
            }}
          >
            <option value="todos">Todos los estados</option>
            <option value="venta">A la venta</option>
            <option value="fuera">Fuera de venta</option>
            <option value="propio">Con precio propio</option>
            <option value="oferta">En oferta</option>
            <option value="tocados">Tocados en esta sesión</option>
          </select>
        </label>
        <div className="admin-precios-rango" role="group" aria-label="Filtrar por precio">
          <input
            inputMode="numeric"
            placeholder="Desde $"
            aria-label="Precio desde"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              sinTocar();
            }}
          />
          <span>a</span>
          <input
            inputMode="numeric"
            placeholder="Hasta $"
            aria-label="Precio hasta"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              sinTocar();
            }}
          />
        </div>
      </div>

      {seleccion.length > 0 && (
        <div className="admin-precios-masivo" role="region" aria-label="Cambios en bloque">
          <div className="admin-precios-masivo-cabeza">
            <strong>
              {seleccion.length} {seleccion.length === 1 ? "seleccionado" : "seleccionados"}
            </strong>
            <button className="admin-text-button" onClick={() => setElegidas(new Set())}>
              Limpiar selección
            </button>
          </div>
          <div className="admin-precios-regla">
            <label className="admin-field">
              Qué hacer
              <select
                aria-label="Operación"
                value={op}
                onChange={(e) => setOp(e.target.value as Operacion)}
              >
                {OPERACIONES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              {unidad === "%" ? "Porcentaje" : "Monto ($)"}
              <input
                ref={valorRef}
                aria-label="Valor de la regla"
                inputMode="decimal"
                placeholder={unidad === "%" ? "ej. 10" : "ej. 2000"}
                value={valorTxt}
                onChange={(e) => setValorTxt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && vista && vista.cambian) aplicarRegla();
                }}
              />
            </label>
            <label className="admin-field">
              Redondeo
              <select
                aria-label="Redondeo"
                value={redondeo}
                onChange={(e) => setRedondeo(e.target.value as Redondeo)}
              >
                {REDONDEOS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="admin-button admin-button-primary"
              disabled={!vista || vista.cambian === 0}
              onClick={aplicarRegla}
            >
              <Check size={16} />
              {vista && vista.cambian
                ? op === "oferta"
                  ? `Poner en oferta ${vista.cambian}`
                  : `Aplicar a ${vista.cambian}`
                : "Aplicar"}
            </button>
          </div>

          {valorTxt.trim() && !regla.ok && (
            <p className="admin-precios-error" role="alert">
              {regla.error}
            </p>
          )}
          {vista && (
            <div className="admin-precios-vista" aria-live="polite">
              <p>
                <b>{vista.cambian}</b> {vista.cambian === 1 ? "cambia" : "cambian"}
                {vista.cambian > 0 && (
                  <>
                    {" "}
                    (en promedio {vista.promedioPct > 0 ? "+" : ""}
                    {String(vista.promedioPct).replace(".", ",")}%)
                  </>
                )}
                {vista.iguales > 0 && <> · {vista.iguales} quedan igual</>}
                {vista.errores > 0 && (
                  <>
                    {" "}
                    · <span className="admin-precios-error">{vista.errores} no se pueden cambiar</span>
                  </>
                )}
              </p>
              <ul>
                {vista.filas.slice(0, 5).map((f) => {
                  const a = porClave.get(f.key)!;
                  return (
                    <li key={f.key} className={`is-${f.estado}`}>
                      <span>{a.nombre}</span>
                      <span>
                        {f.base !== undefined ? <s>{money(f.base)}</s> : money(f.antes)}
                        {f.despues !== null && (
                          <>
                            {" → "}
                            <b>{money(f.despues)}</b>{" "}
                            <Variacion antes={f.base ?? f.antes} despues={f.despues} />
                          </>
                        )}
                        {f.estado === "error" && <em> {f.error}</em>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {vista.filas.length > 5 && (
                <small>…y {vista.filas.length - 5} más</small>
              )}
            </div>
          )}

          <div className="admin-precios-masivo-otras">
            {hayEnVenta && (
              <button className="admin-button admin-button-outline" onClick={() => cambiarEstadoDeLaSeleccion(false)}>
                Sacar de la venta
              </button>
            )}
            {hayFuera && (
              <button className="admin-button admin-button-outline" onClick={() => cambiarEstadoDeLaSeleccion(true)}>
                Poner a la venta
              </button>
            )}
            {hayOfertas && (
              <button className="admin-button admin-button-outline" onClick={() => terminarOfertas(seleccion)}>
                Terminar la oferta
              </button>
            )}
            {hayPropios && (
              <button className="admin-button admin-button-outline" onClick={volverAlPrecioDeLaMarca}>
                Volver al precio de la marca
              </button>
            )}
          </div>
        </div>
      )}

      <div className="admin-table-wrap" role="region" aria-label="Precios de todos los artículos" tabIndex={0}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Elegir los artículos que se ven en esta lista"
                  checked={todasLaPagina}
                  onChange={() => {
                    const siguiente = new Set(elegidas);
                    for (const a of pagina)
                      if (todasLaPagina) siguiente.delete(a.key);
                      else siguiente.add(a.key);
                    setElegidas(siguiente);
                  }}
                />
              </th>
              <th aria-sort={ariaOrden("nombre")}>
                <button className="admin-precios-orden" onClick={() => ordenarPor("nombre")}>
                  ARTÍCULO {flecha("nombre")}
                </button>
              </th>
              <th aria-sort={ariaOrden("marca")}>
                <button className="admin-precios-orden" onClick={() => ordenarPor("marca")}>
                  MARCA {flecha("marca")}
                </button>
              </th>
              <th aria-sort={ariaOrden("precio")}>
                <button className="admin-precios-orden" onClick={() => ordenarPor("precio")}>
                  PRECIO {flecha("precio")}
                </button>
              </th>
              <th>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {pagina.map((a) => (
              <tr
                key={a.key}
                className={[
                  a.activo ? "" : "admin-precios-fuera",
                  resaltados.has(a.key) ? "admin-precios-flash" : "",
                ].join(" ")}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Elegir ${a.nombre}`}
                    checked={elegidas.has(a.key)}
                    onChange={() => alternar(a.key)}
                  />
                </td>
                <td>
                  <div className="admin-product-cell">
                    <img
                      src={a.imagen}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/images/product-fallback.svg";
                      }}
                    />
                    <div>
                      <strong>{a.nombre}</strong>
                      <span>
                        {/* La marca tiene su columna; en el celular se ve acá. */}
                        <span className="admin-precios-marca-movil">{a.marca} · </span>
                        {a.seccion}
                        {a.detalle ? ` · ${a.detalle}` : ""}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="admin-precios-marca">{a.marca}</td>
                <td>
                  {editando === a.key ? (
                    <EditorPrecio
                      art={a}
                      onGuardar={(valor, mover) => guardarPrecio(a, valor, mover)}
                      onCancelar={() => setEditando(null)}
                    />
                  ) : (
                    <div className="admin-precios-celda">
                      <button
                        className={`admin-precios-valor ${a.fuente === "men" && !a.propio ? "is-marca" : ""}`}
                        onClick={() => setEditando(a.key)}
                        aria-label={`Cambiar el precio de ${a.nombre}, ahora ${money(a.precio)}`}
                        title="Clic para cambiar el precio"
                      >
                        {a.antes ? <s>{money(a.antes)}</s> : null}
                        <strong>{money(a.precio)}</strong>
                        <Pencil size={12} aria-hidden />
                      </button>
                      {a.antes ? (
                        <span className="admin-precios-sub">
                          <span className="admin-precios-oferta">
                            <Tag size={11} aria-hidden /> Oferta −{descuento(a.antes, a.precio)}%
                          </span>{" "}
                          <button
                            className="admin-precios-quitar"
                            onClick={() => terminarOfertas([a])}
                            aria-label={`Terminar la oferta de ${a.nombre}`}
                          >
                            terminar
                          </button>
                        </span>
                      ) : (
                        <button
                          className="admin-precios-ofertar"
                          onClick={() => ofertaRapida(a)}
                          aria-label={`Poner en oferta ${a.nombre}`}
                        >
                          <Tag size={11} aria-hidden /> poner en oferta
                        </button>
                      )}
                      {a.propio && a.precioMarca !== null && (
                        <span className="admin-precios-sub">
                          Marca {money(a.precioMarca)}{" "}
                          <Variacion antes={a.precioMarca} despues={a.precio} />{" "}
                          <button
                            className="admin-precios-quitar"
                            onClick={() =>
                              ejecutar(
                                [cambioDePrecio(a, null)],
                                `Precio de la marca: ${a.nombre}`,
                                `${a.nombre}: vuelve al precio de la marca`,
                              )
                            }
                            aria-label={`Volver al precio de la marca para ${a.nombre}`}
                          >
                            volver
                          </button>
                        </span>
                      )}
                      {a.fuente === "men" && !a.propio && (
                        <span className="admin-precios-sub">Precio de la marca</span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <button
                    className={`admin-publish-status ${a.activo ? "is-published" : ""}`}
                    onClick={() => alternarVenta(a)}
                    title={a.activo ? "Sacar de la venta: no se ve en la tienda" : "Poner a la venta"}
                    aria-label={`${a.activo ? "Sacar de la venta" : "Poner a la venta"} ${a.nombre}`}
                  >
                    <span />
                    {a.activo ? "A la venta" : "Fuera de venta"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtradas.length === 0 && (
        <p className="admin-precios-vacio">
          No hay artículos con esos filtros.{" "}
          {filtrosActivos && (
            <button
              className="admin-text-button"
              onClick={() => {
                setBusqueda("");
                setFuente("todos");
                setMarca("Todas");
                setSeccion("Todas");
                setEstado("todos");
                setDesde("");
                setHasta("");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </p>
      )}

      <div className="admin-table-footer">
        <span>
          {pagina.length} de {ordenadas.length} artículos
          {ordenadas.length > pagina.length && (
            <>
              {" · "}
              <button className="admin-text-button" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
                Mostrar más
              </button>
              {" · "}
              <button
                className="admin-text-button"
                onClick={() => setElegidas(new Set(ordenadas.map((a) => a.key)))}
              >
                Elegir los {ordenadas.length}
              </button>
            </>
          )}
        </span>
        <span>Ctrl+Z deshace · Ctrl+Mayús+Z rehace</span>
      </div>
    </section>
  );
}
