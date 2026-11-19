import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, ImagePlus, TriangleAlert, X } from "lucide-react";
import type { Category, Product } from "./types";
import { prepararImagen as prepareImage } from "./imagen";
import { avisoDeCambio, leerPrecio } from "./menOverrides.mjs";
import { diaDe, finDelDia, vencida } from "./ofertas.mjs";
import { imagePattern, categories } from "./adminComunes";

/** Lado máximo al que se achican las fotos subidas, en píxeles. */
export function ProductEditor({
  product,
  onSave,
  onDelete,
  onClose,
  notify,
}: {
  product?: Product;
  onSave: (product: Product) => void;
  /** Dar de baja el producto del todo. Sólo existe al editar uno que ya está. */
  onDelete?: (product: Product) => void;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Product>(
    product
      ? structuredClone(product)
      : {
          id: `local-${crypto.randomUUID()}`,
          name: "",
          category: "Hombre",
          type: "Remeras",
          price: 0,
          image: "",
          color: "",
          colorHex: "#132457",
          sizes: ["S", "M", "L", "XL"],
          stock: {},
          isNew: true,
          active: true,
          description: "",
        },
  );
  const [sizeText, setSizeText] = useState(draft.sizes.join(", "));
  const [gallery, setGallery] = useState<string[]>(draft.images || []);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [error, setError] = useState("");
  const sizes = [
    ...new Set(
      sizeText
        .split(",")
        .map((size) => size.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }
  /**
   * Deja la foto lista para guardar. La achica antes: una foto de celular
   * pesa varios MB y acá todo se guarda en el navegador, que da poco lugar.
   * Si el navegador no sabe achicar, se guarda tal cual y manda el límite.
   */
  async function uploadImage(file?: File) {
    if (!file) return;
    try {
      set("image", await prepareImage(file));
      setError("");
      notify("Imagen lista para guardar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer la imagen.");
    }
  }
  /** Varias fotos de una, para mostrar la prenda desde distintos ángulos. */
  async function uploadGallery(files?: FileList | null) {
    if (!files?.length) return;
    const listos: string[] = [];
    for (const file of Array.from(files)) {
      try {
        listos.push(await prepareImage(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos leer la imagen.");
      }
    }
    if (!listos.length) return;
    setGallery((prev) => [...prev, ...listos]);
    setError("");
    notify(
      listos.length === 1 ? "Foto agregada" : `${listos.length} fotos agregadas`,
    );
  }
  function addGalleryUrl() {
    const url = galleryUrl.trim();
    if (!url) return;
    if (!imagePattern.test(url)) {
      setError("El enlace tiene que empezar con https://");
      return;
    }
    setGallery((prev) => [...prev, url]);
    setGalleryUrl("");
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.color.trim() || !draft.type.trim()) {
      setError("Completá el nombre, tipo de prenda y color.");
      return;
    }
    // El precio se guarda en pesos enteros: con centavos o con basura no se
    // adivina, se avisa.
    const precio = leerPrecio(draft.price);
    if (!precio.ok) {
      setError(precio.error);
      return;
    }
    // El precio anterior es el que se muestra tachado: si no es mayor que el
    // actual, la tienda mostraría un "descuento" que sube el precio.
    if (draft.oldPrice !== undefined) {
      const anterior = leerPrecio(draft.oldPrice);
      if (!anterior.ok) {
        setError(`Precio anterior: ${anterior.error}`);
        return;
      }
      if (anterior.value <= precio.value) {
        setError(
          "El precio anterior tiene que ser mayor al actual: es el que se muestra tachado. Si no hay descuento, dejalo vacío.",
        );
        return;
      }
    }
    // La fecha de fin de la oferta: sin precio anterior no hay a qué volver, y una fecha
    // que ya pasó terminaría la oferta en el mismo momento de guardarla.
    if (draft.offerUntil) {
      if (!draft.oldPrice) {
        setError("La fecha de fin necesita el precio anterior: es el precio al que vuelve cuando termina la oferta.");
        return;
      }
      if (vencida(draft.offerUntil)) {
        setError("La fecha de fin de la oferta ya pasó. Elegí un día que no haya pasado o dejala vacía.");
        return;
      }
    }
    // Un cambio enorme casi siempre es un cero de más o de menos.
    const aviso = product ? avisoDeCambio(product.price, precio.value) : null;
    if (aviso && !confirm(aviso)) return;
    if (!sizes.length) {
      setError("Agregá al menos un talle; podés usar ÚNICO.");
      return;
    }
    if (
      !draft.image.trim() ||
      !imagePattern.test(draft.image)
    ) {
      setError("Agregá una imagen o una URL válida que comience con https://.");
      return;
    }
    if (gallery.some((url) => !imagePattern.test(url))) {
      setError(
        "Revisá las fotos extra: cada línea tiene que ser una URL que empiece con https://",
      );
      return;
    }
    const stock = Object.fromEntries(
      sizes.map((s) => [s, Math.max(0, Math.floor(draft.stock[s] || 0))]),
    ) as Product["stock"];
    onSave({
      ...draft,
      name: draft.name.trim(),
      type: draft.type.trim(),
      color: draft.color.trim(),
      image: draft.image.trim(),
      sizes,
      stock,
      images: gallery.length ? gallery : undefined,
    });
  }
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="admin-product-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="admin-product-form" onSubmit={submit}>
        <div className="admin-dialog-heading">
          <div>
            <span className="admin-eyebrow">CATÁLOGO DE PRODUCTOS</span>
            <h2 id="admin-product-title">
              {product ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p>Un catálogo compartido. Stock por talle.</p>
          </div>
          <button
            type="button"
            className="admin-close"
            aria-label="Cerrar editor"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="admin-dialog-body">
          <div className="admin-form-grid">
            <label className="admin-field admin-field-full">
              Nombre del producto
              <input
                autoFocus
                required
                maxLength={90}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ej. Remera Classic Logo"
              />
            </label>
            <label className="admin-field">
              Marca
              <input value={draft.brand || ""} onChange={(e) => set("brand", e.target.value)} placeholder="Ej. Mistral" />
            </label>
            <label className="admin-field">
              Categoría
              <select
                value={draft.category}
                onChange={(e) => set("category", e.target.value as Category)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              Tipo de producto
              <input
                required
                value={draft.type}
                onChange={(e) => set("type", e.target.value)}
                placeholder="Remeras, buzos, camperas…"
              />
            </label>
            <label className="admin-field">
              Precio (ARS)
              <input
                type="number"
                min="1"
                step="1"
                required
                value={draft.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="45000"
              />
            </label>
            <label className="admin-field">
              Precio anterior (opcional)
              <input
                type="number"
                min="1"
                step="1"
                value={draft.oldPrice || ""}
                onChange={(e) =>
                  set(
                    "oldPrice",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="Precio sin descuento"
              />
            </label>
            <label className="admin-field">
              La oferta termina el (opcional)
              <input
                type="date"
                value={diaDe(draft.offerUntil)}
                disabled={!draft.oldPrice}
                onChange={(e) => set("offerUntil", finDelDia(e.target.value) ?? undefined)}
              />
              <small>
                {draft.oldPrice
                  ? "Ese día, a las 23:59, el precio vuelve solo al anterior. Vacío: dura hasta que la termines a mano."
                  : "Se usa junto con el precio anterior."}
              </small>
            </label>
            <label className="admin-field">
              Nombre del color
              <input
                required
                value={draft.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="Ej. Verde bosque"
              />
            </label>
            <label className="admin-field">
              Muestra de color
              <div className="admin-color-input">
                <input
                  type="color"
                  aria-label="Elegir color"
                  value={draft.colorHex}
                  onChange={(e) => set("colorHex", e.target.value)}
                />
                <span>{draft.colorHex.toUpperCase()}</span>
              </div>
            </label>
            <label className="admin-field admin-field-full">
              Descripción
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Materiales, calce y detalles de la prenda."
              />
            </label>
          </div>
          <div className="admin-form-section">
            <h3>Imagen del producto</h3>
            <div className="admin-image-upload">
              {draft.image ? (
                <img
                  src={draft.image}
                  alt="Vista previa del producto"
                  onError={(e) => {
                    e.currentTarget.style.opacity = ".25";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                />
              ) : (
                <span className="admin-image-placeholder">
                  <ImagePlus size={28} />
                </span>
              )}
              <div>
                <button
                  className="admin-button admin-button-outline"
                  type="button"
                  onClick={() => imageInput.current?.click()}
                >
                  <ImagePlus size={16} /> Subir imagen
                </button>
                <p>JPG, PNG o WebP. Hasta 1 MB.</p>
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="admin-sr-only"
                  aria-label="Subir imagen del producto"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                />
              </div>
            </div>
            <label className="admin-field">
              O pegá el enlace de una imagen
              <input
                value={draft.image.startsWith("data:") ? "" : draft.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder={
                  draft.image.startsWith("data:")
                    ? "Imagen subida. Pegá una URL para reemplazarla."
                    : "https://ejemplo.com/producto.jpg"
                }
              />
            </label>
            <div className="admin-field admin-gallery">
              <span className="admin-gallery-label">
                Más fotos de la prenda
              </span>
              {gallery.length > 0 && (
                <ul className="admin-gallery-list">
                  {gallery.map((src, i) => (
                    <li key={`${src.slice(0, 40)}-${i}`}>
                      <img src={src} alt={`Foto ${i + 2} de la prenda`} />
                      <button
                        type="button"
                        aria-label={`Quitar la foto ${i + 2}`}
                        onClick={() =>
                          setGallery((prev) =>
                            prev.filter((_, pos) => pos !== i),
                          )
                        }
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="admin-button admin-button-outline"
                type="button"
                onClick={() => galleryInput.current?.click()}
              >
                <ImagePlus size={16} /> Subir fotos
              </button>
              <input
                ref={galleryInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="admin-sr-only"
                aria-label="Subir más fotos de la prenda"
                onChange={(e) => {
                  uploadGallery(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="admin-gallery-url">
                <input
                  value={galleryUrl}
                  onChange={(e) => setGalleryUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryUrl();
                    }
                  }}
                  placeholder="O pegá el enlace de otra foto"
                  aria-label="Enlace de otra foto"
                />
                <button
                  className="admin-button admin-button-outline"
                  type="button"
                  onClick={addGalleryUrl}
                >
                  Agregar
                </button>
              </div>
            </div>
            <p>
              La primera foto es la principal. Las de acá se muestran como
              miniaturas en la ficha, para ver la prenda de adelante, de atrás
              y de cerca. Se achican solas al subirlas.
            </p>
          </div>
          <div className="admin-form-section">
            <h3>Talles y stock</h3>
            <p>
              La tienda usa estas cantidades para mostrar la disponibilidad.
            </p>
            <label className="admin-field">
              Talles disponibles{" "}
              <input
                value={sizeText}
                onChange={(e) => setSizeText(e.target.value)}
                placeholder="S, M, L, XL"
              />
              <small>Separalos con comas. Para accesorios, usá ÚNICO.</small>
            </label>
            {sizes.length > 0 && (
              <div className="admin-size-table-wrap">
                <table className="admin-size-table">
                  <thead>
                    <tr>
                      <th>TALLE</th>
                      <th>UNIDADES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size) => (
                      <tr key={size}>
                        <th scope="row">{size}</th>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="99999"
                            step="1"
                            aria-label={`Stock talle ${size}`}
                            value={draft.stock[size] ?? 0}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                stock: {
                                  ...prev.stock,
                                  [size]: Number(e.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="admin-form-switches">
            <label>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              <span>
                <strong>Publicar en la tienda</strong>
                <small>El producto estará visible para los clientes.</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.isNew}
                onChange={(e) => set("isNew", e.target.checked)}
              />
              <span>
                <strong>Marcar como novedad</strong>
                <small>Mostrar la etiqueta «Nuevo» en el catálogo.</small>
              </span>
            </label>
          </div>
          {error && (
            <p className="admin-form-error" role="alert">
              <TriangleAlert size={16} />
              {error}
            </p>
          )}
        </div>
        <div className="admin-dialog-footer">
          {product && onDelete && (
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={() => onDelete(product)}
            >
              Dar de baja
            </button>
          )}
          <button
            type="button"
            className="admin-button admin-button-outline"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="admin-button admin-button-primary">
            <Check size={17} />
            {product ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
