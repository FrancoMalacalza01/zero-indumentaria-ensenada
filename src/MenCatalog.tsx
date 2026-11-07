import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, MessageCircle, Ruler, X } from "lucide-react";
import { Link } from "./router";
import { useStore } from "./Store";
import { unirCatalogo } from "./importarCatalogo.mjs";
import { enlaceWhatsapp, mensajeConsultaPrenda } from "./whatsapp.mjs";
import { descuento } from "./priceTools.mjs";
import { ORDENES, ordenarProductos } from "./ordenProductos.mjs";
import catalog from "./men-catalog.json";
import medidasMistral from "./men-medidas.json";
import { tablaDeTalles } from "./tablasTalle.mjs";
import "./men-catalog.css";

type MenProduct = {
  id: string;
  brand: string;
  shopId?: string;
  category: string;
  name: string;
  reference?: string;
  priceARS: number;
  colors: string[];
  sizes: string[];
  url: string;
  images: string[];
  cover?: string;
  /** true cuando el local le puso su propio precio a la prenda. */
  precioZero?: boolean;
  /** Si está en oferta, el precio de antes (el que se muestra tachado). */
  precioAnterior?: number;
};

const catalogo = catalog.products as MenProduct[];
const pageSize = 48;
const priceStep = 5000;
/**
 * Lo que ve el cliente: las prendas que el local dio de baja no se muestran, y
 * las que tienen precio propio lo muestran en lugar del de la marca.
 */
function useProductosVisibles() {
  const { menOverrides, products, importadosOcultos } = useStore();
  return useMemo(() => unirCatalogo(catalogo, products, menOverrides, importadosOcultos) as MenProduct[], [products, menOverrides, importadosOcultos]);
}
const peso = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function colorSwatch(name: string) {
  const value = name.toLocaleLowerCase("es-AR");
  const colors: [string, string][] = [
    ["negro", "#222222"], ["blanco", "#f7f7f4"], ["marino", "#172b50"],
    ["azul", "#3164a5"], ["celeste", "#83b9d5"], ["verde", "#567b59"],
    ["oliva", "#687044"], ["rojo", "#b84343"], ["bordo", "#6f2937"],
    ["rosa", "#d991a5"], ["naranja", "#d77a35"], ["amarillo", "#e1c34b"],
    ["beige", "#c8b595"], ["arena", "#c8b58a"], ["marron", "#806044"],
    ["marrón", "#806044"], ["gris", "#92969b"], ["natural", "#e8dfce"],
    ["crudo", "#e8dfce"], ["lila", "#a28bb8"], ["violeta", "#765493"],
  ];
  return colors.find(([needle]) => value.includes(needle))?.[1] || "#b8bbc1";
}

/**
 * El enlace de WhatsApp para consultar por una prenda, con el mensaje ya escrito
 * (nombre, marca y el precio que ve el cliente). Es `null` mientras el local no
 * cargó su WhatsApp, y entonces el botón no se muestra: igual que los demás
 * botones de WhatsApp del sitio, que no se ofrecen sin un número al que escribir.
 */
function useConsulta() {
  const { settings } = useStore();
  return (p: MenProduct) =>
    enlaceWhatsapp(
      settings.whatsapp,
      mensajeConsultaPrenda({
        nombre: p.name,
        marca: p.brand,
        precio: peso.format(p.priceARS),
        // En oferta, el mensaje dice de cuánto era: quien atiende ve el descuento.
        ...(p.precioAnterior ? { antes: peso.format(p.precioAnterior) } : {}),
      }),
    );
}

/** El precio de una prenda: con el anterior tachado y el descuento si está en oferta. */
function Precio({ p }: { p: MenProduct }) {
  const pct = p.precioAnterior ? descuento(p.precioAnterior, p.priceARS) : 0;
  return (
    <>
      {p.precioAnterior && pct > 0 ? <del>{peso.format(p.precioAnterior)}</del> : null}
      {peso.format(p.priceARS)}
      {pct > 0 ? <em className="men-offer-badge">−{pct}%</em> : null}
    </>
  );
}

/** Cómo se llama el precio que se muestra: oferta, precio propio del local o el de la marca. */
function etiquetaPrecio(p: MenProduct) {
  return p.precioAnterior ? "Oferta" : p.precioZero ? "Precio Zero" : "Precio publicado por la marca";
}

/** La tabla de talles que publica la marca para esta prenda, si la publicó. */
function TablaDeTalles({ product }: { product: MenProduct }) {
  const tabla = tablaDeTalles(product, medidasMistral as Record<string, { nota?: string; filas?: { talle: string; medidas: string }[] }>);
  if (!tabla) return null;
  return (
    <details className="men-talles">
      <summary><Ruler size={16} /> Tabla de talles</summary>
      {tabla.tipo === "filas" ? (
        <>
          <p>Medidas en cm{tabla.nota ? ` (${tabla.nota.toLowerCase()})` : ""}. Pueden variar mínimamente según la producción.</p>
          <table>
            <tbody>
              {tabla.filas.map((f) => <tr key={f.talle}><th scope="row">{f.talle}</th><td>{f.medidas}</td></tr>)}
            </tbody>
          </table>
        </>
      ) : (
        <a href={tabla.src} target="_blank" rel="noreferrer noopener" title="Abrir la tabla en grande">
          <img src={tabla.src} alt={tabla.alt} loading="lazy" />
        </a>
      )}
      <small>Tabla de {tabla.marca}.</small>
    </details>
  );
}

function ProductGallery({ product, close, consulta }: { product: MenProduct; close: () => void; consulta: string | null }) {
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") setPhoto((i) => (i - 1 + product.images.length) % product.images.length);
      if (event.key === "ArrowRight") setPhoto((i) => (i + 1) % product.images.length);
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", keydown);
    };
  }, [close, product.images.length]);
  return (
    <div className="men-gallery-backdrop" onClick={close}>
      <div className="men-gallery" role="dialog" aria-modal="true" aria-label={`Fotos de ${product.name}`} onClick={(event) => event.stopPropagation()}>
        <button className="men-gallery-close" onClick={close} aria-label="Cerrar galería"><X size={24} /></button>
        <div className="men-gallery-main">
          {product.images.length > 1 && <button onClick={() => setPhoto((i) => (i - 1 + product.images.length) % product.images.length)} aria-label="Foto anterior"><ChevronLeft /></button>}
          <img src={product.images[photo]} alt={`${product.name}, foto ${photo + 1}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = product.cover || "/images/product-fallback.svg"; }} />
          {product.images.length > 1 && <button onClick={() => setPhoto((i) => (i + 1) % product.images.length)} aria-label="Foto siguiente"><ChevronRight /></button>}
        </div>
        <div className="men-gallery-details">
          <span>{product.brand} / {product.category}</span>
          <h2>{product.name}</h2>
          <p>{etiquetaPrecio(product)}: <Precio p={product} /></p>
          <p>{photo + 1} de {product.images.length} fotos</p>
          <TablaDeTalles product={product} />
          {product.shopId && product.sizes.length > 0 && <Link className="button button-green" to={`/producto/${encodeURIComponent(product.shopId)}`}>Elegir talle y comprar</Link>}
          {consulta && <a className="button button-green men-whatsapp" href={consulta} target="_blank" rel="noreferrer noopener"><MessageCircle size={18} /> Consultar por WhatsApp</a>}
          <Link to="/sucursales">{consulta ? "Ver cómo llegar a Zero" : "Consultar en Zero"} <ArrowRight size={16} /></Link>
        </div>
        {product.images.length > 1 && <div className="men-gallery-thumbs">
          {product.images.map((src, index) => <button key={`${src}-${index}`} className={index === photo ? "active" : ""} onClick={() => setPhoto(index)} aria-label={`Ver foto ${index + 1}`}><img src={src} alt="" loading="lazy" /></button>)}
        </div>}
      </div>
    </div>
  );
}

export function HomeBrandCatalog() {
  const products = useProductosVisibles();
  const consultaDe = useConsulta();
  const [brand, setBrand] = useState("Todas");
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].filter(Boolean).sort((a, b) => a.localeCompare(b, "es-AR")), [products]);
  const [category, setCategory] = useState("Todas");
  const [orden, setOrden] = useState("destacados");
  const [visible, setVisible] = useState(12);
  const [selected, setSelected] = useState<MenProduct | null>(null);
  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "es-AR")), [products]);
  const filtered = useMemo(() => ordenarProductos(products.filter((product) =>
    (brand === "Todas" || product.brand === brand) &&
    (category === "Todas" || product.category === category),
  ), orden), [products, brand, category, orden]);
  const changeBrand = (next: string) => { setBrand(next); setVisible(12); };
  const changeCategory = (next: string) => { setCategory(next); setVisible(12); };
  const changeOrden = (next: string) => { setOrden(next); setVisible(12); };

  return <section className="section new-section home-brand-catalog" id="novedades">
    <div className="section-heading">
      <div>
        <span className="eyebrow dark">MISTRAL + BROOKSFIELD</span>
        <h2>La colección completa.</h2>
      </div>
      <span className="home-brand-count">{filtered.length} productos</span>
    </div>
    <div className="home-brand-controls">
      <div className="home-brand-tabs" role="group" aria-label="Filtrar productos por marca">
        {(["Todas", ...brands]).map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => changeBrand(item)} aria-pressed={brand === item}>{item}<small>{item === "Todas" ? products.length : products.filter((product) => product.brand === item).length}</small></button>)}
      </div>
      <label className="home-brand-category">
        <span>Sección</span>
        <select value={category} onChange={(event) => changeCategory(event.target.value)}>
          <option value="Todas">Todas las prendas</option>
          {categories.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <ChevronDown size={15} />
      </label>
      <label className="home-brand-category">
        <span>Ordenar</span>
        <select value={orden} onChange={(event) => changeOrden(event.target.value)} aria-label="Ordenar productos">
          {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
        </select>
        <ChevronDown size={15} />
      </label>
    </div>
    {filtered.length ? <>
      <div className="home-brand-grid">
        {filtered.slice(0, visible).map((product) => <article className="men-card home-brand-card" key={product.id}>
          <button className="men-card-image" onClick={() => setSelected(product)} aria-label={`Ver fotos de ${product.name}`}>
            <img src={product.cover || product.images[0]} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/product-fallback.svg"; }} />
            <span>Ver {product.images.length} {product.images.length === 1 ? "foto" : "fotos"}</span>
          </button>
          <div className="men-card-body">
            <span>{product.brand} / {product.category}</span>
            <button onClick={() => setSelected(product)}>{product.name}</button>
            <p><Precio p={product} /></p>
            {consultaDe(product) && <a className="men-card-consult" href={consultaDe(product)!} target="_blank" rel="noreferrer noopener" aria-label={`Consultar por WhatsApp: ${product.name}`}><MessageCircle size={14} /> Consultar por WhatsApp</a>}
          </div>
        </article>)}
      </div>
      {visible < filtered.length && <button className="home-brand-more" onClick={() => setVisible((count) => count + 12)}>Mostrar más productos <span>{Math.min(12, filtered.length - visible)} más</span><ArrowRight size={17} /></button>}
      <p className="home-brand-note">Mostrando {Math.min(visible, filtered.length)} de {filtered.length} productos. Elegí una marca o sección para explorar.</p>
    </> : <div className="men-empty"><h3>No encontramos productos.</h3><p>Probá con otra marca o sección.</p></div>}
    {selected && <ProductGallery key={selected.id} product={selected} close={() => setSelected(null)} consulta={consultaDe(selected)} />}
  </section>;
}

export default function MenCatalog() {
  const products = useProductosVisibles();
  const consultaDe = useConsulta();
  // El rango del filtro de precio sale de lo que se muestra, no del catálogo de
  // fábrica: una prenda con precio propio fuera de ese rango quedaría oculta.
  const rango = products.length ? products : catalogo;
  const priceFloor = Math.floor(Math.min(...rango.map((p) => p.priceARS)) / priceStep) * priceStep;
  const priceCeiling = Math.ceil(Math.max(...rango.map((p) => p.priceARS)) / priceStep) * priceStep;
  const initialCategory = new URLSearchParams(location.search).get("categoria") || "Todas";
  const [category, setCategory] = useState(initialCategory);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  // `null` = sin tope en ese extremo: así el rango sigue al catálogo aunque los
  // ajustes lleguen del servidor después de abrir la página.
  const [minPick, setMinPick] = useState<number | null>(null);
  const [maxPick, setMaxPick] = useState<number | null>(null);
  const minPrice = minPick ?? priceFloor;
  const maxPrice = maxPick ?? priceCeiling;
  const setMinPrice = (value: number) => setMinPick(value <= priceFloor ? null : value);
  const setMaxPrice = (value: number) => setMaxPick(value >= priceCeiling ? null : value);
  const [orden, setOrden] = useState("destacados");
  const [visible, setVisible] = useState(pageSize);
  const [selected, setSelected] = useState<MenProduct | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  useEffect(() => {
    const syncCategory = () => {
      const nextSearch = location.search;
      setCategory(new URLSearchParams(nextSearch).get("categoria") || "Todas");
      setVisible(pageSize);
    };
    window.addEventListener("popstate", syncCategory);
    return () => window.removeEventListener("popstate", syncCategory);
  }, []);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    const preferred = ["Remeras", "Polos", "Sweaters", "Camisas", "Buzos", "Camperas", "Jeans y pantalones", "Pantalones", "Joggings", "Bermudas", "Bermudas y shorts", "Shorts de baño", "Accesorios"];
    return [...counts].sort(([a], [b]) => {
      const aIndex = preferred.indexOf(a);
      const bIndex = preferred.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, "es-AR");
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [products]);
  const facetProducts = useMemo(() => products.filter((product) =>
    category === "Todas" || product.category === category,
  ), [products, category]);
  const colorFacets = useMemo(() => {
    const counts = new Map<string, number>();
    facetProducts.forEach((product) => (product.colors || []).forEach((color) => counts.set(color, (counts.get(color) || 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es-AR"));
  }, [facetProducts]);
  const sizeFacets = useMemo(() => {
    const counts = new Map<string, number>();
    facetProducts.forEach((product) => (product.sizes || []).forEach((size) => counts.set(size, (counts.get(size) || 0) + 1)));
    const commonSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "Único", "Unico"];
    return [...counts].sort(([a], [b]) => {
      const aIndex = commonSizes.indexOf(a);
      const bIndex = commonSizes.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      const aNumber = Number(a);
      const bNumber = Number(b);
      return Number.isFinite(aNumber) && Number.isFinite(bNumber) ? aNumber - bNumber : a.localeCompare(b, "es-AR");
    });
  }, [facetProducts]);
  const filtered = useMemo(() => {
    return ordenarProductos(products.filter((p) =>
      (category === "Todas" || p.category === category) &&
      (!selectedSizes.length || selectedSizes.some((size) => (p.sizes || []).includes(size))) &&
      (!selectedColors.length || selectedColors.some((color) => (p.colors || []).includes(color))) &&
      p.priceARS >= minPrice && p.priceARS <= maxPrice,
    ), orden);
  }, [products, category, selectedSizes, selectedColors, minPrice, maxPrice, orden]);
  useEffect(() => setVisible(pageSize), [category, selectedSizes, selectedColors, minPrice, maxPrice, orden]);
  const chooseCategory = (next: string) => { setCategory(next); setVisible(pageSize); };
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 13);
  const toggleSize = (size: string) => setSelectedSizes((current) => current.includes(size) ? current.filter((item) => item !== size) : [...current, size]);
  const toggleColor = (color: string) => setSelectedColors((current) => current.includes(color) ? current.filter((item) => item !== color) : [...current, color]);
  const clearFilters = () => {
    setCategory("Todas"); setSelectedSizes([]); setSelectedColors([]);
    setMinPick(null); setMaxPick(null); setShowAllCategories(false);
    setShowAllSizes(false); setShowAllColors(false);
  };

  return <main className="men-page">
    <div className="men-intro">
      <div className="men-intro-inner">
        <div className="breadcrumb"><Link to="/">Inicio</Link><ChevronRight size={13} /><span>Hombre</span></div>
        <span className="eyebrow">ZERO INDUMENTARIA · COLECCIÓN HOMBRE</span>
        <h1>Hombre, sección por sección.</h1>
        <p>Explorá los modelos de Mistral y Brooksfield, las marcas que trabajamos. Consultá en Zero Indumentaria los talles, precios y modelos disponibles para comprar.</p>
        <div className="men-intro-stats"><strong>{products.length}</strong> productos <span>·</span> <strong>{products.reduce((n, p) => n + p.images.length, 0)}</strong> fotos</div>
      </div>
    </div>
    <div className="section men-content">
      <aside className="men-sidebar" aria-label="Filtros de productos">
        <div className="men-sidebar-group">
          <h2>Secciones</h2>
          <div className="men-sidebar-links" role="group" aria-label="Filtrar por sección">
            <button className={category === "Todas" ? "active" : ""} onClick={() => chooseCategory("Todas")} aria-pressed={category === "Todas"}>Ver todo <span>{products.length}</span></button>
            {visibleCategories.map(([name, count]) => <button key={name} className={category === name ? "active" : ""} onClick={() => chooseCategory(name)} aria-pressed={category === name}>{name}<span>{count}</span></button>)}
          </div>
          {categories.length > 13 && <button className="men-show-categories" onClick={() => setShowAllCategories((shown) => !shown)}>{showAllCategories ? "Ver menos" : "Ver más categorías"}<ChevronDown size={15} className={showAllCategories ? "rotated" : ""} /></button>}
        </div>
        <div className="men-sidebar-group men-filters-intro">
          <h2>Filtrar por</h2>
        </div>
        <div className="men-sidebar-group men-facet-group">
          <h2>Color</h2>
          <div className={`men-facet-list ${showAllColors ? "expanded" : ""}`} role="group" aria-label="Filtrar por color">
            {(showAllColors ? colorFacets : colorFacets.slice(0, 8)).map(([color, count]) => <label className="men-facet-option" key={color}>
              <input type="checkbox" checked={selectedColors.includes(color)} onChange={() => toggleColor(color)} />
              <span className="men-color-swatch" style={{ backgroundColor: colorSwatch(color) }} />
              <span className="men-facet-name">{color}</span><small>{count}</small>
            </label>)}
          </div>
          {colorFacets.length > 8 && <button className="men-show-categories" onClick={() => setShowAllColors((shown) => !shown)}>{showAllColors ? "Ver menos" : "Ver todos"}<ChevronDown size={15} className={showAllColors ? "rotated" : ""} /></button>}
        </div>
        <div className="men-sidebar-group men-facet-group">
          <h2>Talle</h2>
          <div className={`men-facet-list ${showAllSizes ? "expanded" : ""}`} role="group" aria-label="Filtrar por talle">
            {(showAllSizes ? sizeFacets : sizeFacets.slice(0, 8)).map(([size, count]) => <label className="men-facet-option" key={size}>
              <input type="checkbox" checked={selectedSizes.includes(size)} onChange={() => toggleSize(size)} />
              <span className="men-facet-name">{size}</span><small>{count}</small>
            </label>)}
          </div>
          {sizeFacets.length > 8 && <button className="men-show-categories" onClick={() => setShowAllSizes((shown) => !shown)}>{showAllSizes ? "Ver menos" : "Ver más talles"}<ChevronDown size={15} className={showAllSizes ? "rotated" : ""} /></button>}
        </div>
        <div className="men-sidebar-group men-price-group">
          <h2>Precio</h2>
          <div className="men-price-values"><span>{peso.format(minPrice)}</span><span>{peso.format(maxPrice)}</span></div>
          <div className="men-price-range" aria-label="Elegir rango de precios">
            <input type="range" min={priceFloor} max={priceCeiling} step={priceStep} value={minPrice} aria-label="Precio mínimo" onChange={(event) => setMinPrice(Math.min(Number(event.target.value), maxPrice - priceStep))} />
            <input type="range" min={priceFloor} max={priceCeiling} step={priceStep} value={maxPrice} aria-label="Precio máximo" onChange={(event) => setMaxPrice(Math.max(Number(event.target.value), minPrice + priceStep))} />
          </div>
        </div>
        {(category !== "Todas" || selectedSizes.length > 0 || selectedColors.length > 0 || minPrice !== priceFloor || maxPrice !== priceCeiling) && <button className="men-clear-filters" onClick={clearFilters}>Limpiar filtros <X size={15} /></button>}
      </aside>
      <section className="men-results" aria-label="Productos de hombre">
        <div className="men-section-head"><div><span className="eyebrow dark">MISTRAL + BROOKSFIELD</span><h2>{category === "Todas" ? "Todas las secciones" : category}</h2></div><Link to="/sucursales">Consultar disponibilidad <ArrowRight size={17} /></Link></div>
        <div className="men-toolbar"><span>{filtered.length} productos</span><label className="men-sort"><span>Ordenar</span><select value={orden} onChange={(event) => setOrden(event.target.value)} aria-label="Ordenar productos">{ORDENES.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}</select></label></div>
        {filtered.length ? <><div className="men-grid">{filtered.slice(0, visible).map((product) => <article className="men-card" key={product.id}><button className="men-card-image" onClick={() => setSelected(product)} aria-label={`Ver fotos de ${product.name}`}><img src={product.cover || product.images[0]} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/product-fallback.svg"; }} /><span>Ver {product.images.length} {product.images.length === 1 ? "foto" : "fotos"}</span></button><div className="men-card-body"><span>{product.brand} / {product.category}</span><button onClick={() => setSelected(product)}>{product.name}</button><p><Precio p={product} /></p><small>{etiquetaPrecio(product)}</small>{consultaDe(product) && <a className="men-card-consult" href={consultaDe(product)!} target="_blank" rel="noreferrer noopener" aria-label={`Consultar por WhatsApp: ${product.name}`}><MessageCircle size={14} /> Consultar por WhatsApp</a>}</div></article>)}</div>{visible < filtered.length && <button className="men-more" onClick={() => setVisible((n) => n + pageSize)}>Mostrar más productos <ArrowRight size={18} /></button>}</> : <div className="men-empty"><h3>No encontramos productos.</h3><p>Probá otra búsqueda o sección.</p></div>}
      </section>
      <p className="men-source-note">Catálogo de marcas relevado el {new Date(`${catalog.capturedAt}T12:00:00`).toLocaleDateString("es-AR")}. Fotos publicadas por <a href="https://www.mistral.com.ar/hombre/" target="_blank" rel="noopener noreferrer">Mistral</a> y <a href="https://www.brooksfieldstore.com/3-hombre-brooksfield" target="_blank" rel="noopener noreferrer">Brooksfield</a>. Los precios son los de la marca, salvo los que Zero ajustó. Consultá la disponibilidad en Zero Indumentaria.</p>
    </div>
    {selected && <ProductGallery key={selected.id} product={selected} close={() => setSelected(null)} consulta={consultaDe(selected)} />}
  </main>;
}
