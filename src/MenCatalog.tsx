import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Link } from "./router";
import catalog from "./men-catalog.json";
import "./men-catalog.css";

type MenProduct = {
  id: string;
  brand: "Mistral" | "Brooksfield";
  category: string;
  name: string;
  reference?: string;
  priceARS: number;
  url: string;
  images: string[];
  cover?: string;
};

const products = catalog.products as MenProduct[];
const pageSize = 48;
const peso = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function ProductGallery({ product, close }: { product: MenProduct; close: () => void }) {
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
          <p>Precio publicado por la marca: {peso.format(product.priceARS)}</p>
          <p>{photo + 1} de {product.images.length} fotos</p>
          <Link to="/sucursales">Consultar en Zero <ArrowRight size={16} /></Link>
        </div>
        {product.images.length > 1 && <div className="men-gallery-thumbs">
          {product.images.map((src, index) => <button key={`${src}-${index}`} className={index === photo ? "active" : ""} onClick={() => setPhoto(index)} aria-label={`Ver foto ${index + 1}`}><img src={src} alt="" loading="lazy" /></button>)}
        </div>}
      </div>
    </div>
  );
}

export default function MenCatalog() {
  const initialCategory = new URLSearchParams(location.search).get("categoria") || "Todas";
  const [brand, setBrand] = useState("Todas");
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(pageSize);
  const [selected, setSelected] = useState<MenProduct | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
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
    products.filter((p) => brand === "Todas" || p.brand === brand).forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    const preferred = ["Remeras", "Polos", "Sweaters", "Camisas", "Buzos", "Camperas", "Jeans y pantalones", "Pantalones", "Joggings", "Bermudas", "Bermudas y shorts", "Shorts de baño", "Accesorios"];
    return [...counts].sort(([a], [b]) => {
      const aIndex = preferred.indexOf(a);
      const bIndex = preferred.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, "es-AR");
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [brand]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-AR");
    return products.filter((p) =>
      (brand === "Todas" || p.brand === brand) &&
      (category === "Todas" || p.category === category) &&
      (!term || `${p.name} ${p.reference || ""} ${p.category} ${p.brand}`.toLocaleLowerCase("es-AR").includes(term)),
    );
  }, [brand, category, query]);
  useEffect(() => setVisible(pageSize), [category, brand]);
  const chooseBrand = (next: string) => { setBrand(next); setCategory("Todas"); setVisible(pageSize); };
  const chooseCategory = (next: string) => { setCategory(next); setVisible(pageSize); };
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 13);

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
            <button className={category === "Todas" ? "active" : ""} onClick={() => chooseCategory("Todas")} aria-pressed={category === "Todas"}>Ver todo <span>{products.filter((p) => brand === "Todas" || p.brand === brand).length}</span></button>
            {visibleCategories.map(([name, count]) => <button key={name} className={category === name ? "active" : ""} onClick={() => chooseCategory(name)} aria-pressed={category === name}>{name}<span>{count}</span></button>)}
          </div>
          {categories.length > 13 && <button className="men-show-categories" onClick={() => setShowAllCategories((shown) => !shown)}>{showAllCategories ? "Ver menos" : "Ver más categorías"}<ChevronDown size={15} className={showAllCategories ? "rotated" : ""} /></button>}
        </div>
        <div className="men-sidebar-group">
          <h2>Marca</h2>
          <div className="men-sidebar-links" role="group" aria-label="Filtrar por marca">
            {(["Todas", "Mistral", "Brooksfield"] as const).map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => chooseBrand(item)} aria-pressed={brand === item}>{item === "Todas" ? "Todas las marcas" : item}<span>{item === "Todas" ? products.length : products.filter((p) => p.brand === item).length}</span></button>)}
          </div>
        </div>
        <div className="men-sidebar-group men-search-group">
          <h2>Buscar</h2>
          <label className="men-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(pageSize); }} placeholder="Prenda o código" aria-label="Buscar productos de hombre" /></label>
        </div>
        {(category !== "Todas" || brand !== "Todas" || query) && <button className="men-clear-filters" onClick={() => { chooseBrand("Todas"); setQuery(""); setShowAllCategories(false); }}>Limpiar filtros <X size={15} /></button>}
      </aside>
      <section className="men-results" aria-label="Productos de hombre">
        <div className="men-section-head"><div><span className="eyebrow dark">{brand === "Todas" ? "MISTRAL + BROOKSFIELD" : brand.toUpperCase()}</span><h2>{category === "Todas" ? "Todas las secciones" : category}</h2></div><Link to="/sucursales">Consultar disponibilidad <ArrowRight size={17} /></Link></div>
        <div className="men-toolbar"><span>{filtered.length} productos</span>{query && <span className="men-search-summary">Búsqueda: “{query}”</span>}</div>
        {filtered.length ? <><div className="men-grid">{filtered.slice(0, visible).map((product) => <article className="men-card" key={product.id}><button className="men-card-image" onClick={() => setSelected(product)} aria-label={`Ver fotos de ${product.name}`}><img src={product.cover || product.images[0]} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/product-fallback.svg"; }} /><span>Ver {product.images.length} {product.images.length === 1 ? "foto" : "fotos"}</span></button><div className="men-card-body"><span>{product.brand} / {product.category}</span><button onClick={() => setSelected(product)}>{product.name}</button><p>{peso.format(product.priceARS)}</p><small>Precio publicado por la marca</small></div></article>)}</div>{visible < filtered.length && <button className="men-more" onClick={() => setVisible((n) => n + pageSize)}>Mostrar más productos <ArrowRight size={18} /></button>}</> : <div className="men-empty"><h3>No encontramos productos.</h3><p>Probá otra búsqueda o sección.</p></div>}
      </section>
      <p className="men-source-note">Catálogo de marcas relevado el {new Date(`${catalog.capturedAt}T12:00:00`).toLocaleDateString("es-AR")}. Fotos y precios publicados por <a href="https://www.mistral.com.ar/hombre/" target="_blank" rel="noopener noreferrer">Mistral</a> y <a href="https://www.brooksfieldstore.com/3-hombre-brooksfield" target="_blank" rel="noopener noreferrer">Brooksfield</a>. Consultá el precio final y la disponibilidad en Zero Indumentaria.</p>
    </div>
    {selected && <ProductGallery key={selected.id} product={selected} close={() => setSelected(null)} />}
  </main>;
}
