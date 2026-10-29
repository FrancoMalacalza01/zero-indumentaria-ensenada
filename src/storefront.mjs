/**
 * Qué se muestra en la tienda.
 *
 * La tienda publica sólo prendas de hombre: **New in** es lo nuevo de hombre y
 * **Hombre** es todo el catálogo de hombre. Mujer y Accesorios no se muestran,
 * pero esas fichas quedan en el panel con sus precios y su stock: no se borran
 * datos, sólo se dejan de publicar. Para volver a mostrar una categoría, se
 * agrega acá.
 */
export const CATEGORIAS_EN_TIENDA = Object.freeze(["Hombre"]);

/** true si el producto se muestra en la tienda: está publicado y es de una categoría publicada. */
export function esProductoDeTienda(producto) {
  return (
    Boolean(producto?.active) && CATEGORIAS_EN_TIENDA.includes(producto?.category)
  );
}
