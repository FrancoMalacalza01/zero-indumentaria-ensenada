import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Heart,
  Instagram,
  Landmark,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Store,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { money, useStore } from "./Store";
import type { PaymentMethodId, Product, Order } from "./types";
import { cartKey } from "./commerce.mjs";
import {
  chargesRealMoney,
  paymentLabel,
  paymentOptions,
  type PaymentOption,
} from "./payment";
import {
  deliveryAvailable,
  deliveryZones,
  zoneByName,
  zoneCostLabel,
} from "./delivery";
const Admin = lazy(() => import("./Admin"));
const AdminGate = lazy(() => import("./AdminGate"));
const instagram = "https://www.instagram.com/mistral.zero.indumentaria/";
// WhatsApp del local, en formato internacional y sin el "+" (por ejemplo
// "5492211234567"). Mientras quede vacío, el pedido se abre en WhatsApp con el
// mensaje escrito y la persona elige el contacto a mano.
// Las formas de pago se configuran aparte, en src/payment.ts, y las zonas de
// envío en src/delivery.ts.
// Dirección del local. Los horarios quedan sin completar a propósito: no se
// inventan, se ponen cuando el dueño los confirme.
const localAddress = {
  street: "La Merced 327",
  city: "Ensenada",
  region: "Buenos Aires",
  postalCode: "1925",
  hours: "",
};
const whatsappNumber = "";
function whatsappOrderUrl(order: Order) {
  const text = [
    `Hola Mistral, quiero hacer este pedido:`,
    "",
    ...order.items.map(
      (i) =>
        `• ${i.name} — Talle ${i.size} × ${i.quantity} — ${money(i.price * i.quantity)}`,
    ),
    "",
    `Total: ${money(order.total)}`,
    order.delivery === "shipping"
      ? `Envío a: ${order.zone}`
      : `Retiro en: ${localAddress.street}, ${localAddress.city}`,
    `Pedido: ${order.id}`,
    ...(order.payment ? [`Pago: ${paymentLabel(order.payment)}`] : []),
    ...(paymentOptions().find((o) => o.id === order.payment)?.needsReceipt
      ? ["Te mando el comprobante por acá."]
      : []),
  ].join("\n");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
}
function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
}
function Link({
  to,
  children,
  className = "",
  ...rest
}: {
  to: string;
  children: ReactNode;
  className?: string;
  tabIndex?: number;
  "aria-hidden"?: boolean;
}) {
  return (
    <a
      className={className}
      href={to}
      {...rest}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <img src="/images/mistral-logo.png" alt="Mistral" />
      <span>ENSENADA</span>
    </span>
  );
}
function useRoute() {
  const [path, setPath] = useState(location.pathname + location.search);
  useEffect(() => {
    const handler = () => setPath(location.pathname + location.search);
    addEventListener("popstate", handler);
    return () => removeEventListener("popstate", handler);
  }, []);
  return path;
}
function Overlay({
  title,
  children,
  onClose,
  side = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement;
    dialog.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = prior;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={side ? "drawer" : "modal"}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="overlay-inner">
        <div className="overlay-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function ProductImage({
  product,
  src,
  ...props
}: {
  product: Product;
  src?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <img
      src={src || product.image}
      alt={`${product.name} — ${product.color}`}
      {...props}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/images/product-fallback.svg";
      }}
    />
  );
}
function ProductCard({ product: p }: { product: Product }) {
  const { favorites, toggleFavorite } = useStore();
  const available = Object.values(p.stock).some((n) => n > 0);
  return (
    <article className="product-card">
      <div className="product-visual">
        <Link to={`/producto/${p.id}`}>
          <ProductImage product={p} loading="lazy" />
        </Link>
        <span className="product-tag">
          {!available ? "SIN STOCK" : p.isNew ? "NEW IN" : "ESENCIAL"}
        </span>
        <button
          className={`favorite ${favorites.includes(p.id) ? "selected" : ""}`}
          aria-label={`${favorites.includes(p.id) ? "Quitar" : "Guardar"} ${p.name} en favoritos`}
          aria-pressed={favorites.includes(p.id)}
          onClick={() => toggleFavorite(p.id)}
        >
          <Heart size={19} />
        </button>
        <Link className="quick-shop" to={`/producto/${p.id}`}>
          Elegir talle <Plus size={16} />
        </Link>
      </div>
      <div className="product-meta">
        <span>
          {p.category} / {p.type}
        </span>
        <span
          className="swatch"
          style={{ background: p.colorHex }}
          title={p.color}
        />
      </div>
      <Link className="product-name" to={`/producto/${p.id}`}>
        {p.name}
      </Link>
      <p className="product-price">
        {p.oldPrice && p.oldPrice > p.price ? <del>{money(p.oldPrice)}</del> : null}
        {money(p.price)} <span>ARS</span>
      </p>
    </article>
  );
}
function Header({ onCart }: { onCart: () => void }) {
  const { cart, favorites } = useStore();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const nav = [
    ["New in", "/tienda?new=1"],
    ["Hombre", "/tienda?categoria=Hombre"],
    ["Mujer", "/tienda?categoria=Mujer"],
    ["Accesorios", "/tienda?categoria=Accesorios"],
  ];
  return (
    <>
      <div className="announcement">
        <span>EL ESPÍRITU MISTRAL, MÁS CERCA TUYO</span>
        <span>
          Ensenada · Envíos a La Plata y Berisso <ArrowUpRightSmall />
        </span>
      </div>
      <header className="site-header">
        <div className="header-main">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir menú"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <Link className="branch-picker" to="/sucursales">
            <MapPin size={16} />
            {localAddress.city}
          </Link>
          <Link className="brand-link" to="/">
            <Brand />
          </Link>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Buscar productos"
              onClick={() => setSearch(!search)}
            >
              <Search size={22} />
            </button>
            <Link className="icon-button favorites-link" to="/favoritos">
              <Heart size={21} />
              <span className="sr-only">Favoritos ({favorites.length})</span>
            </Link>
            <button
              className="icon-button bag-button"
              aria-label={`Abrir bolsa (${cart.reduce((s, i) => s + i.quantity, 0)})`}
              onClick={onCart}
            >
              <ShoppingBag size={21} />
              <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </button>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {nav.map(([name, to]) => (
            <Link key={name} to={to}>
              {name}
              {name === "New in" && <span className="nav-new">NUEVO</span>}
            </Link>
          ))}
          <Link className="nav-stores" to="/sucursales">
            Nuestras tiendas <MapPin size={14} />
          </Link>
        </nav>
        {search && (
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/tienda?q=${encodeURIComponent(query)}`);
              setSearch(false);
            }}
          >
            <Search size={20} />
            <input
              autoFocus
              aria-label="Buscar en la tienda"
              placeholder="¿Qué estás buscando?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit">
              Buscar <ArrowRight size={18} />
            </button>
          </form>
        )}
      </header>
      {menu && (
        <Overlay title="Explorá Mistral" side onClose={() => setMenu(false)}>
          <nav className="mobile-nav">
            {[
              ["Inicio", "/"],
              ...nav,
              ["Nuestras tiendas", "/sucursales"],
              ["Favoritos", "/favoritos"],
            ].map(([name, to]) => (
              <a
                href={to}
                key={name}
                onClick={(e) => {
                  e.preventDefault();
                  setMenu(false);
                  navigate(to);
                }}
              >
                {name}
                <ArrowRight size={20} />
              </a>
            ))}
          </nav>
        </Overlay>
      )}
    </>
  );
}
// Fotos de campaña del hero. Con una sola hace un acercamiento lento; en
// cuanto se sumen más, se encadenan solas con un fundido.
const heroImages = [
  {
    src: "/images/lifestyle.webp",
    alt: "Campaña Mistral: un momento compartido, a tu manera",
  },
];
function HeroSlides() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (heroImages.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % heroImages.length),
      6500,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <>
      {heroImages.map((image, i) => (
        <img
          key={image.src}
          className={`hero-image ${i === index ? "is-visible" : ""}`}
          src={image.src}
          alt={i === index ? image.alt : ""}
          aria-hidden={i !== index}
          fetchPriority={i === 0 ? "high" : undefined}
        />
      ))}
    </>
  );
}
/** Tira de prendas que se desplaza sola. Se frena al pasar el mouse o al
 *  llegar con el teclado, y con "reducir movimiento" queda quieta. */
function ProductMarquee({ products }: { products: Product[] }) {
  if (products.length < 3) return null;
  const loop = [...products, ...products];
  return (
    <section className="marquee" aria-label="Prendas de la colección">
      <div className="marquee-track">
        {loop.map((p, i) => {
          const clone = i >= products.length;
          return (
            <Link
              key={`${p.id}-${i}`}
              to={`/producto/${p.id}`}
              className="marquee-item"
              aria-hidden={clone}
              tabIndex={clone ? -1 : undefined}
            >
              <ProductImage product={p} loading="lazy" />
              <span>{p.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
function ArrowUpRightSmall() {
  return <ArrowRight size={13} style={{ transform: "rotate(-40deg)" }} />;
}
function Home() {
  const { products } = useStore();
  const [tab, setTab] = useState("Todos");
  const selected = products.filter(
    (p) => p.active && (tab === "Todos" || p.category === tab),
  );
  const picks =
    tab === "Todos"
      ? Array.from(
          new Map(
            [
              selected[0],
              selected.find((p) => p.id === "7"),
              selected.find((p) => p.id === "3"),
              selected.find((p) => p.id === "11"),
              ...selected,
            ]
              .filter((p): p is Product => !!p)
              .map((p) => [p.id, p]),
          ).values(),
        ).slice(0, 4)
      : selected.slice(0, 4);
  return (
    <>
      <section className="hero">
        <HeroSlides />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow">MISTRAL · EVERYDAY ADVENTURES</span>
          <h1>
            Tu esencia.
            <br />
            Tu ritmo.
            <br />
            <em>Tu Mistral.</em>
          </h1>
          <p>
            El espíritu de siempre.
            <br />
            Nuevas formas de vivirlo.
          </p>
          <Link className="button button-white" to="/tienda">
            Explorá la colección <ArrowRight size={19} />
          </Link>
        </div>
        <span className="hero-side">MISTRAL — EVERYDAY ESSENTIALS</span>
        <div className="hero-bottom">
          <span>ENSENADA</span>
          <a href="#novedades" aria-label="Ver novedades">
            <ArrowDown size={20} />
          </a>
          <span>VIVÍ A TU MANERA.</span>
        </div>
      </section>
      <div className="service-strip">
        <span>
          <Store size={21} />
          <b>Retirá en el local</b>
          <small>La Merced 327, Ensenada</small>
        </span>
        <span>
          <ShoppingBag size={21} />
          <b>Comprá a tu ritmo</b>
          <small>Descubrí todos los esenciales</small>
        </span>
        <span>
          <MapPin size={21} />
          <b>Retirá en tu ciudad</b>
          <small>Cerca tuyo, como siempre</small>
        </span>
      </div>
      <ProductMarquee products={selected.slice(0, 10)} />
      <section className="section new-section" id="novedades">
        <div className="section-heading">
          <div>
            <span className="eyebrow dark">UN AIRE NUEVO</span>
            <h2>Lo que se viene con vos.</h2>
          </div>
          <Link className="text-link" to="/tienda">
            Ver toda la colección <ArrowRight size={18} />
          </Link>
        </div>
        <div
          className="category-tabs"
          role="group"
          aria-label="Categorías de novedades"
        >
          {["Todos", "Hombre", "Mujer", "Accesorios"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {picks.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="collection-grid">
        <Link to="/tienda?categoria=Hombre" className="collection-card">
          <img
            src="/images/product-3.webp"
            alt="Colección para hombre Mistral"
            loading="lazy"
          />
          <div>
            <span className="eyebrow">SIEMPRE EN MOVIMIENTO</span>
            <h2>Hombre</h2>
            <span>
              Encontrá tu estilo <ArrowRight size={19} />
            </span>
          </div>
        </Link>
        <Link to="/tienda?categoria=Mujer" className="collection-card">
          <img
            src="/images/product-9.webp"
            alt="Colección para mujer Mistral"
            loading="lazy"
          />
          <div>
            <span className="eyebrow">LIBRE POR NATURALEZA</span>
            <h2>Mujer</h2>
            <span>
              Descubrí la colección <ArrowRight size={19} />
            </span>
          </div>
        </Link>
      </section>
      <section className="local-section">
        <span className="eyebrow dark">EL MISMO ESPÍRITU. TU CIUDAD.</span>
        <h2>
          Nos encontramos
          <br />
          cerca tuyo.
        </h2>
        <p>
          Un local, y envíos a tu ciudad.
          <br />
          Pasá por el local en Ensenada, o te lo enviamos.
        </p>
        <Link className="button button-green" to="/sucursales">
          Cómo llegar <ArrowRight size={18} />
        </Link>
        <div className="local-coordinates">
          LA PLATA / ENSENADA
          <br />
          BUENOS AIRES, ARGENTINA
        </div>
      </section>
    </>
  );
}
function Catalog({ favorites = false }: { favorites?: boolean }) {
  const { products, favorites: saved } = useStore();
  const params = new URLSearchParams(location.search);
  const [category, setCategory] = useState(params.get("categoria") || "Todos");
  const [query, setQuery] = useState(params.get("q") || "");
  const [sort, setSort] = useState("featured");
  const [size, setSize] = useState("Todos");
  const [stock, setStock] = useState(false);
  const [filters, setFilters] = useState(false);
  const onlyNew = params.get("new") === "1";
  let result = products.filter(
    (p) =>
      p.active &&
      (!favorites || saved.includes(p.id)) &&
      (category === "Todos" || p.category === category) &&
      (!onlyNew || p.isNew) &&
      `${p.name} ${p.type} ${p.color}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (size === "Todos" || p.sizes.includes(size)) &&
      (!stock ||
        (size === "Todos"
          ? Object.values(p.stock).some((n) => n > 0)
          : (p.stock[size] || 0) > 0)),
  );
  if (sort === "asc") result.sort((a, b) => a.price - b.price);
  if (sort === "desc") result.sort((a, b) => b.price - a.price);
  const clear = () => {
    setCategory("Todos");
    setQuery("");
    setSize("Todos");
    setStock(false);
  };
  return (
    <main className="catalog-page section">
      <div className="breadcrumb">
        <Link to="/">Inicio</Link>
        <ChevronRight size={13} />
        <span>{favorites ? "Favoritos" : "Colección"}</span>
      </div>
      <span className="eyebrow dark">HECHO PARA ACOMPAÑARTE</span>
      <div className="catalog-heading">
        <h1>
          {favorites
            ? "Tus favoritos."
            : onlyNew
              ? "Lo nuevo de Mistral."
              : category === "Todos"
                ? "Encontrá tu próximo esencial."
                : category + "."}
        </h1>
        <span>{result.length} productos</span>
      </div>
      <div className="catalog-controls">
        <div className="category-tabs">
          {["Todos", "Hombre", "Mujer", "Accesorios"].map((t) => (
            <button
              className={category === t ? "active" : ""}
              key={t}
              onClick={() => setCategory(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="sort-controls">
          <button
            className={`filter-button ${filters ? "active" : ""}`}
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} />
            Filtros
          </button>
          <select
            aria-label="Ordenar productos"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="featured">Destacados</option>
            <option value="asc">Menor precio</option>
            <option value="desc">Mayor precio</option>
          </select>
        </div>
      </div>
      {filters && (
        <div className="filter-panel">
          <label className="field">
            Buscar producto
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Remera, buzo, color…"
            />
          </label>
          <label className="field">
            Talle
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              {["Todos", ...new Set(products.flatMap((p) => p.sizes))].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={stock}
              onChange={(e) => setStock(e.target.checked)}
            />
            Con stock
          </label>
          <button className="text-link" onClick={clear}>
            Limpiar filtros
          </button>
        </div>
      )}
      {query && (
        <p className="query-label">
          Resultados para “{query}”{" "}
          <button onClick={() => setQuery("")} aria-label="Borrar búsqueda">
            <X size={15} />
          </button>
        </p>
      )}
      {result.length ? (
        <div className="product-grid">
          {result.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Heart size={35} />
          <h2>
            {favorites
              ? "Todavía no guardaste favoritos."
              : "No encontramos productos."}
          </h2>
          <p>
            {favorites
              ? "Tocá el corazón de los productos que te gusten."
              : "Probá con otra búsqueda o cambiá los filtros."}
          </p>
          {favorites ? (
            <Link to="/tienda" className="button button-green">
              Explorar colección
            </Link>
          ) : (
            <button className="button button-green" onClick={clear}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </main>
  );
}
function ProductDetail({ id, onCart }: { id: string; onCart: () => void }) {
  const { products, cart, setCart, favorites, toggleFavorite, notify } =
    useStore();
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [guide, setGuide] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [error, setError] = useState("");
  const p = products.find((p) => p.id === id && p.active);
  if (!p) return <NotFound />;
  const max = size ? p.stock[size] || 0 : 0;
  const photos = [p.image, ...(p.images || [])].filter(Boolean);
  const add = () => {
    if (!size) {
      setError("Elegí un talle para continuar.");
      return;
    }
    const existing = cart.find(
      (i) => i.productId === id && i.size === size,
    );
    if (quantity + (existing?.quantity || 0) > max) {
      setError("La cantidad supera el stock disponible para este talle.");
      return;
    }
    setCart(
      existing
        ? cart.map((i) =>
            i === existing ? { ...i, quantity: i.quantity + quantity } : i,
          )
        : [...cart, { productId: id, size, quantity }],
    );
    setError("");
    notify("Agregamos el producto a tu bolsa.");
    onCart();
  };
  return (
    <main className="section detail-page">
      <div className="breadcrumb">
        <Link to="/">Inicio</Link>
        <ChevronRight size={13} />
        <Link to={`/tienda?categoria=${p.category}`}>{p.category}</Link>
        <ChevronRight size={13} />
        <span>{p.name}</span>
      </div>
      <div className="detail-grid">
        <div
          className={`detail-media ${photos.length > 1 ? "has-thumbs" : ""}`}
        >
          <div className="detail-photo">
            <ProductImage product={p} src={photos[photo] || p.image} />
            <span className="product-tag">
              {p.isNew ? "NEW IN" : "MISTRAL ESSENTIALS"}
            </span>
          </div>
          {photos.length > 1 && (
            <div
              className="detail-thumbs"
              role="group"
              aria-label="Fotos de la prenda"
            >
              {photos.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  className={i === photo ? "selected" : ""}
                  aria-label={`Ver foto ${i + 1} de ${photos.length}`}
                  aria-pressed={i === photo}
                  onClick={() => setPhoto(i)}
                >
                  <ProductImage product={p} src={src} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <span className="eyebrow dark">
            {p.category} / {p.type}
          </span>
          <h1>{p.name}</h1>
          <p className="detail-price">
            {p.oldPrice && p.oldPrice > p.price ? <del>{money(p.oldPrice)}</del> : null}
            {money(p.price)} <small>ARS</small>
          </p>
          <p className="reference-price">
            Precio de referencia para esta demostración.
          </p>
          <div className="detail-divider" />
          <p className="color-label">
            Color: <b>{p.color}</b>
          </p>
          <span className="detail-swatch" style={{ background: p.colorHex }} />
          <div className="size-heading">
            <b>Elegí tu talle</b>
            <button onClick={() => setGuide(true)}>Ayuda con los talles</button>
          </div>
          <div className="size-options">
            {p.sizes.map((s) => (
              <button
                key={s}
                disabled={!p.stock[s]}
                aria-pressed={size === s}
                className={size === s ? "selected" : ""}
                onClick={() => {
                  setSize(s);
                  setQuantity(1);
                  setError("");
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="stock-label">
            <MapPin size={15} />
            {size
              ? `${max} unidades disponibles`
              : "Consultá disponibilidad"}
          </p>
          <div className="purchase-controls">
            <div className="quantity-control">
              <button
                aria-label="Reducir cantidad"
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
              >
                <Minus size={16} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label="Aumentar cantidad"
                disabled={!size || quantity >= max}
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="button button-green"
              onClick={add}
              disabled={!Object.values(p.stock).some((n) => n > 0)}
            >
              <ShoppingBag size={18} />
              Agregar a la bolsa
            </button>
            <button
              className={`icon-button detail-favorite ${favorites.includes(id) ? "selected" : ""}`}
              aria-label="Guardar en favoritos"
              aria-pressed={favorites.includes(id)}
              onClick={() => toggleFavorite(id)}
            >
              <Heart size={22} />
            </button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="product-service">
            <Store size={21} />
            <div>
              <b>Retiro en el local</b>
              <span>La Merced 327, Ensenada. O te lo enviamos.</span>
            </div>
          </div>
          <details open>
            <summary>
              Sobre esta prenda <Plus size={16} />
            </summary>
            <p>{p.description}</p>
          </details>
          <details>
            <summary>
              Información de la demo <Plus size={16} />
            </summary>
            <p>
              Las fotos y los precios son de referencia. El stock es simulado y
              las compras no generan cobros ni reservas reales.
            </p>
          </details>
        </div>
      </div>
      <section className="related">
        <div className="section-heading">
          <h2>También van con vos.</h2>
          <Link className="text-link" to="/tienda">
            Ver más <ArrowRight size={17} />
          </Link>
        </div>
        <div className="product-grid">
          {products
            .filter((x) => x.active && x.id !== id)
            .slice(0, 4)
            .map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
        </div>
      </section>
      {guide && (
        <Overlay title="Encontrá tu talle" onClose={() => setGuide(false)}>
          <p className="modal-copy">
            En esta demo mostramos los talles del catálogo de referencia. La
            tabla de medidas de cada prenda se incorporará con la información
            del local.
          </p>
          <p className="modal-copy">
            Para asesoramiento, escribinos por Instagram.
          </p>
          <a
            className="button button-green"
            href={instagram}
            target="_blank"
            rel="noreferrer"
          >
            Consultar por Instagram <Instagram size={18} />
          </a>
        </Overlay>
      )}
    </main>
  );
}
function Cart({ onClose }: { onClose: () => void }) {
  const { cart, setCart, products } = useStore();
  const entries = cart.map((i) => ({
    item: i,
    product: products.find((p) => p.id === i.productId),
  }));
  const total = entries.reduce(
    (s, { item, product }) => s + (product?.price || 0) * item.quantity,
    0,
  );
  const invalid = entries.some(
    ({ item, product }) =>
      !product?.active ||
      (product.stock[item.size] || 0) < item.quantity,
  );
  return (
    <Overlay
      title={`Tu bolsa (${cart.reduce((s, i) => s + i.quantity, 0)})`}
      side
      onClose={onClose}
    >
      {!cart.length ? (
        <div className="empty-state">
          <ShoppingBag size={40} />
          <h3>Tu próxima aventura empieza acá.</h3>
          <p>Sumá tus favoritos a la bolsa.</p>
          <button
            className="button button-green"
            onClick={() => {
              onClose();
              navigate("/tienda");
            }}
          >
            Explorar colección
          </button>
        </div>
      ) : (
        <>
          <p className="cart-branch">
            <MapPin size={16} />
            Retirás en {localAddress.city} o te lo enviamos
          </p>
          <div className="cart-items">
            {entries.map(({ item, product }) => (
              <div className="cart-item" key={cartKey(item)}>
                {product && <ProductImage product={product} />}
                <div className="cart-item-info">
                  <h3>{product?.name || "Producto no disponible"}</h3>
                  <p>
                    Talle {item.size} · {product?.color}
                  </p>
                  <b>{money((product?.price || 0) * item.quantity)}</b>
                  <div className="cart-item-actions">
                    <div className="quantity-control">
                      <button
                        aria-label={`Reducir ${product?.name}`}
                        onClick={() =>
                          setCart(
                            item.quantity === 1
                              ? cart.filter((i) => i !== item)
                              : cart.map((i) =>
                                  i === item
                                    ? { ...i, quantity: i.quantity - 1 }
                                    : i,
                                ),
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        aria-label={`Aumentar ${product?.name}`}
                        disabled={
                          !product?.active ||
                          item.quantity >=
                            (product?.stock[item.size] || 0)
                        }
                        onClick={() =>
                          setCart(
                            cart.map((i) =>
                              i === item
                                ? { ...i, quantity: i.quantity + 1 }
                                : i,
                            ),
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="remove-item"
                      onClick={() => setCart(cart.filter((i) => i !== item))}
                    >
                      Quitar
                    </button>
                  </div>
                  {(!product?.active ||
                    (product.stock[item.size] || 0) <
                      item.quantity) && (
                    <p className="form-error">
                      Stock modificado. Reducí la cantidad o quitá este
                      producto.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="cart-summary">
            <div>
              <span>Subtotal</span>
              <strong>{money(total)}</strong>
            </div>
            <p>El retiro en el local no tiene costo.</p>
            {invalid && (
              <p className="form-error" role="alert">
                Revisá los productos sin stock antes de continuar.
              </p>
            )}
            <button
              className="button button-green"
              disabled={invalid}
              onClick={() => {
                onClose();
                navigate("/checkout");
              }}
            >
              Continuar compra <ArrowRight size={18} />
            </button>
            <span className="demo-note">
              Compra de demostración · Sin cobros reales
            </span>
          </div>
        </>
      )}
    </Overlay>
  );
}
const paymentIcons: Record<PaymentMethodId, ReactNode> = {
  mercadopago: <Wallet size={24} />,
  cuentadni: <Smartphone size={24} />,
  transferencia: <Landmark size={24} />,
  efectivo: <Banknote size={24} />,
  tarjeta: <CreditCard size={24} />,
};
/** Alias, CBU o titular con un botón para copiarlo de una. */
function PaymentData({ label, value }: { label: string; value: string }) {
  const { notify } = useStore();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify(`${label} copiado.`);
    } catch {
      // Sin permiso de portapapeles queda a la vista para copiar a mano.
      notify(`Copiá a mano el ${label.toLowerCase()}: ${value}`);
    }
  };
  return (
    <div className="payment-data">
      <span>{label}</span>
      <strong>{value}</strong>
      <button
        type="button"
        className="payment-copy"
        onClick={copy}
        aria-label={`Copiar ${label}`}
      >
        <Copy size={14} />
        Copiar
      </button>
    </div>
  );
}
/** Cómo pagar, en la pantalla final: el link, los datos y el comprobante. */
function PaymentBlock({ option }: { option: PaymentOption }) {
  return (
    <div className="payment-summary">
      <b>
        {paymentIcons[option.id]}
        {option.label}
      </b>
      <p>{option.detail}</p>
      {option.image && (
        <img
          className="payment-qr"
          src={option.image}
          alt={`Código QR para pagar con ${option.label}`}
        />
      )}
      {option.data.map((d) => (
        <PaymentData key={d.label} label={d.label} value={d.value} />
      ))}
      {option.needsReceipt && (
        <p className="payment-note">
          Mandanos el comprobante por WhatsApp con el número de pedido así lo
          preparamos.
        </p>
      )}
    </div>
  );
}
function Checkout() {
  const { cart, products, placeOrder } = useStore();
  const [name, setName] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Si el local todavía no configuró ninguna, la lista queda vacía y el
  // checkout se ve igual que antes.
  const options = paymentOptions();
  const [method, setMethod] = useState<PaymentMethodId | undefined>(
    options[0]?.id,
  );
  const [delivery, setDelivery] = useState<"pickup" | "shipping">("pickup");
  const [zone, setZone] = useState(deliveryZones[0]?.name || "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = placeOrder(delivery, name, method, zone);
    if (result.error) {
      setError(result.error);
      setBusy(false);
    } else setOrder(result.order!);
  };
  if (order) {
    const chosen = options.find((o) => o.id === order.payment);
    return (
      <main className="checkout-success section">
        <CheckCircle2 size={58} />
        <span className="eyebrow dark">ASÍ SE VERÍA TU COMPRA</span>
        <h1>
          ¡Todo listo para
          <br />
          tu próxima aventura!
        </h1>
        <p>
          Pedido <b>{order.id}</b>
        </p>
        <p>
          {order.delivery === "shipping"
            ? `Envío a ${order.zone}`
            : `Retiro en ${localAddress.city}`}{" "}
          · {money(order.total)}
        </p>
        <div className="demo-box">
          {chargesRealMoney ? (
            <>
              Todavía no se cobró nada. Si pagás con el link o transferís, ese
              pago es real: confirmá antes con el local que el precio y la
              disponibilidad están bien.
            </>
          ) : (
            <>
              No se realizó ningún cobro. Mandá el pedido por WhatsApp y te
              confirmamos la disponibilidad y la entrega.
            </>
          )}
        </div>
        {chosen && <PaymentBlock option={chosen} />}
        <div className="success-actions">
          {chosen?.url && (
            <a
              className="button button-green"
              href={chosen.url}
              target="_blank"
              rel="noreferrer"
            >
              Pagar con {chosen.label}
              <ExternalLink size={17} />
            </a>
          )}
          <a
            className="button button-green"
            href={whatsappOrderUrl(order)}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            Enviar pedido por WhatsApp
          </a>
          <Link className="text-link" to="/tienda">
            Seguir explorando <ArrowRight size={18} />
          </Link>
        </div>
      </main>
    );
  }
  if (!cart.length)
    return (
      <main className="section empty-state">
        <ShoppingBag size={40} />
        <h1>Tu bolsa está vacía.</h1>
        <Link className="button button-green" to="/tienda">
          Ver la colección
        </Link>
      </main>
    );
  const total = cart.reduce(
    (s, i) =>
      s + (products.find((p) => p.id === i.productId)?.price || 0) * i.quantity,
    0,
  );
  return (
    <main className="checkout section">
      <Link className="text-link" to="/tienda">
        <ArrowLeft size={16} />
        Volver a la tienda
      </Link>
      <span className="eyebrow dark">UN PASO MÁS</span>
      <h1>Tu próxima compra.</h1>
      <div className="demo-box">
        Estás probando el recorrido de compra. No necesitás ingresar datos
        personales ni medios de pago.
      </div>
      <div className="checkout-grid">
        <form onSubmit={submit}>
          <h2>1. Datos de la demo</h2>
          <label className="field">
            Nombre de prueba (opcional)
            <input
              maxLength={60}
              placeholder="Ej.: Cliente de prueba"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <h2>2. Forma de entrega</h2>
          {deliveryAvailable ? (
            <>
              <div className="payment-options">
                <label
                  className={`payment-option${delivery === "pickup" ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={delivery === "pickup"}
                    onChange={() => setDelivery("pickup")}
                  />
                  <Store size={24} />
                  <div>
                    <b>Retiro en el local</b>
                    <span>Sin costo. Te avisamos cuando esté listo.</span>
                  </div>
                </label>
                <label
                  className={`payment-option${delivery === "shipping" ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={delivery === "shipping"}
                    onChange={() => setDelivery("shipping")}
                  />
                  <Truck size={24} />
                  <div>
                    <b>Envío a domicilio</b>
                    <span>
                      {deliveryZones.map((z) => z.name).join(", ")}.
                    </span>
                  </div>
                </label>
              </div>
              {delivery === "shipping" && (
                <label className="field">
                  ¿A qué ciudad lo mandamos?
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  >
                    {deliveryZones.map((z) => (
                      <option key={z.id}>{z.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <p className="reference-price">
                {delivery === "shipping"
                  ? `${zoneCostLabel(zoneByName(zone) || deliveryZones[0])}. Te pedimos la dirección al confirmar el pedido.`
                  : "También hacemos envíos a " +
                    deliveryZones.map((z) => z.name).join(", ") +
                    "."}
              </p>
            </>
          ) : (
            <>
              <div className="delivery-option">
                <Store size={24} />
                <div>
                  <b>Retiro en el local</b>
                  <span>Sin costo · disponibilidad simulada</span>
                </div>
                <Check size={20} />
              </div>
              <p className="reference-price">
                Los envíos a domicilio se definirán con el local.
              </p>
            </>
          )}
          {options.length > 0 && (
            <>
              <h2>3. Forma de pago</h2>
              <div className="payment-options">
                {options.map((o) => (
                  <label
                    className={`payment-option${method === o.id ? " selected" : ""}`}
                    key={o.id}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={o.id}
                      checked={method === o.id}
                      onChange={() => setMethod(o.id)}
                    />
                    {paymentIcons[o.id]}
                    <div>
                      <b>{o.label}</b>
                      <span>{o.detail}</span>
                    </div>
                  </label>
                ))}
              </div>
              <p className="reference-price">
                No se piden datos de tarjeta en el sitio. Al confirmar te damos
                el link o los datos para pagar.
              </p>
            </>
          )}
          <h2>{options.length > 0 ? 4 : 3}. Confirmación</h2>
          <p className="modal-copy">
            Al confirmar, se descuenta el stock de prueba y se crea un pedido
            visible en el panel interno de este navegador.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-green" type="submit" disabled={busy}>
            Confirmar compra de prueba <ArrowRight size={18} />
          </button>
        </form>
        <aside className="order-summary">
          <h2>Resumen de tu bolsa</h2>
          {cart.map((i) => {
            const p = products.find((p) => p.id === i.productId);
            return (
              <div className="summary-item" key={cartKey(i)}>
                {p && <ProductImage product={p} />}
                <div>
                  <b>{p?.name || "No disponible"}</b>
                  <span>
                    Talle {i.size} · Cantidad {i.quantity}
                  </span>
                </div>
                <strong>{money((p?.price || 0) * i.quantity)}</strong>
              </div>
            );
          })}
          <div className="order-total">
            <span>Total de prueba</span>
            <strong>{money(total)}</strong>
          </div>
        </aside>
      </div>
    </main>
  );
}
function Stores() {
  return (
    <main className="section stores-page">
      <span className="eyebrow dark">EL MISMO ESPÍRITU. TU CIUDAD.</span>
      <h1>
        Pasá. Probá.
        <br />
        Encontrá tu Mistral.
      </h1>
      <p>
        Estamos en {localAddress.city}.
        <br />
        Y hacemos envíos a {deliveryZones.map((z) => z.name).join(", ")}.
      </p>
      <div className="store-grid store-grid-single">
        {[localAddress].map((local) => (
          <article className="store-card" key={local.city}>
            <MapPin size={30} />
            <h2>{local.city}</h2>
            <p>
              {local.street} · {local.city}, {local.region} (CP{" "}
              {local.postalCode})
            </p>
            <p className="store-detail">
              Consultá horarios y disponibilidad por Instagram. Hacemos envíos a{" "}
              {deliveryZones.map((z) => z.name).join(", ")}.
            </p>
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              className="button button-green"
            >
              Consultar por Instagram <Instagram size={17} />
            </a>
            <Link className="text-link" to="/tienda">
              Explorar la colección <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      <p className="store-footnote">
        Los horarios se incorporarán al confirmarlos con el local.
      </p>
    </main>
  );
}
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Brand light />
          <p>
            Espíritu libre.
            <br />
            Desde siempre, cerca tuyo.
          </p>
          <a
            className="social-link"
            href={instagram}
            target="_blank"
            rel="noreferrer"
          >
            <Instagram size={18} />
            @mistral.zero.indumentaria
          </a>
        </div>
        <div>
          <h3>EXPLORÁ</h3>
          <Link to="/tienda?new=1">New in</Link>
          <Link to="/tienda?categoria=Hombre">Hombre</Link>
          <Link to="/tienda?categoria=Mujer">Mujer</Link>
          <Link to="/tienda?categoria=Accesorios">Accesorios</Link>
        </div>
        <div>
          <h3>CERCA TUYO</h3>
          <Link to="/sucursales">Nuestras tiendas</Link>
          <a href={instagram} target="_blank" rel="noreferrer">
            Contacto por Instagram
          </a>
          <Link to="/favoritos">Mis favoritos</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Mistral Ensenada</span>
        <span>
          Prototipo de presentación. Precios y stock de referencia. Sin ventas
          reales.
        </span>
        <span>MADE FOR LIFE OUTSIDE.</span>
      </div>
    </footer>
  );
}
function NotFound() {
  return (
    <main className="section empty-state">
      <h1>Por acá no era.</h1>
      <p>El producto o la página que buscás no está disponible.</p>
      <Link className="button button-green" to="/tienda">
        Volver a la colección <ArrowRight size={18} />
      </Link>
    </main>
  );
}
export default function App() {
  const route = useRoute();
  const path = route.split("?")[0];
  const [cart, setCart] = useState(false);
  useEffect(() => {
    // Nombra la ciudad en cada título: es lo que se lee en la pestaña, en el
    // historial y en el resultado de Google.
    const titles: Record<string, string> = {
      "/": "Mistral Ensenada — Indumentaria",
      "/tienda": "Tienda — Mistral Ensenada",
      "/sucursales": "Dónde estamos — Mistral Ensenada",
      "/favoritos": "Favoritos — Mistral Ensenada",
      "/checkout": "Tu pedido — Mistral Ensenada",
      "/admin": "Panel interno — Mistral",
    };
    document.title =
      titles[path] || "Mistral Ensenada — Indumentaria";
  }, [path]);
  if (path === "/admin")
    return (
      <Suspense fallback={<div className="loading">Cargando panel…</div>}>
        <AdminGate onExit={() => navigate("/")}>
          <Admin
            onExit={() => navigate("/")}
            onPreview={() =>
              window.open("/", "_blank", "noopener,noreferrer")
            }
          />
        </AdminGate>
      </Suspense>
    );
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Header onCart={() => setCart(true)} />
      <div id="contenido" key={route}>
        {path === "/" ? (
          <Home />
        ) : path === "/tienda" ? (
          <Catalog />
        ) : path === "/favoritos" ? (
          <Catalog favorites />
        ) : path.startsWith("/producto/") ? (
          <ProductDetail id={path.split("/")[2]} onCart={() => setCart(true)} />
        ) : path === "/checkout" ? (
          <Checkout />
        ) : path === "/sucursales" ? (
          <Stores />
        ) : (
          <NotFound />
        )}
      </div>
      <Footer />
      {cart && <Cart onClose={() => setCart(false)} />}
    </>
  );
}
