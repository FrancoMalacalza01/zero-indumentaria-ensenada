# Revisión del repositorio y colección Hombre

Fecha del relevamiento: 24/10/2026.

## Estado encontrado

La aplicación usa React, TypeScript y Vite. La tienda y el panel comparten un
catálogo respaldado por Supabase; cuando no responde, se muestran 12 artículos
de demostración incluidos en el código. La ruta de Hombre apuntaba al filtro
de esa tienda, por lo que no mostraba las secciones completas de las marcas.
Antes de los cambios, los 103 tests existentes pasaban.

## Hallazgos y correcciones

| Hallazgo | Corrección en esta rama |
| --- | --- |
| La identidad visible, los correos y el descriptor de pago todavía decían Mistral. | Se usa Zero Indumentaria, el logo aportado y una paleta neutra en tienda, panel, correos, pagos y metadatos. |
| El sitemap y los metadatos apuntaban a la identidad y al dominio anteriores. | Se quitaron esas referencias para no publicar direcciones incorrectas. La rama queda sin indexar hasta confirmar el catálogo comercial. |
| Hombre sólo filtraba la tienda de demostración. | Se creó `/hombre` con marcas, secciones, búsqueda, fichas y galerías. |
| Las fotos de los proveedores no estaban guardadas en el repositorio. | Se añadieron portadas y galerías locales optimizadas, con los enlaces de origen preservados en el catálogo. |

## Relevamiento

| Marca | Productos | Fotos | Secciones |
| --- | ---: | ---: | ---: |
| Mistral | 209 | 2.573 | 11 |
| Brooksfield | 752 | 6.596 | 19 |
| Total | 961 | 9.169 | — |

Fuentes: [Mistral Hombre](https://www.mistral.com.ar/hombre/) y
[Brooksfield Hombre](https://www.brooksfieldstore.com/3-hombre-brooksfield).
El relevamiento recorrió la paginación y las fichas de producto. Los datos
están en `src/men-catalog.json`, las portadas en `public/men-images` y las
galerías en `public/men-gallery`.

## Alcance comercial

Los precios del catálogo Hombre son los publicados por las marcas en la fecha
indicada. No representan necesariamente el precio, los talles ni la existencia
de Zero Indumentaria. Por eso esta colección permite explorar y consultar en
el local, mientras que la compra sigue limitada a los productos que Zero
publique en su propia tienda y base de datos.

Para actualizar el relevamiento: ejecutar `scripts/scrape-men.py`, luego
`scripts/download-men-covers.py` y finalmente
`scripts/download-men-gallery.py` con Python, `lxml` y `Pillow` disponibles.
