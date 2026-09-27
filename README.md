# Mistral · La Plata & Ensenada

Prototipo interactivo de tienda y administración, desarrollado con React, TypeScript y Vite. Adaptado a escritorio y celular.

## Ejecutar

Requiere Node.js 22.12+ (o 24) y pnpm 11.19.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm build
pnpm test
pnpm preview
```

## Recorridos

- `/`: inicio, novedades y colecciones.
- `/tienda`: catálogo con búsqueda, categorías, orden por precio, talles y disponibilidad.
- `/producto/1`: detalle, selección de talle/cantidad y bolsa.
- `/favoritos`: productos guardados.
- `/checkout`: compra de demostración con retiro en la sucursal seleccionada.
- `/sucursales`: La Plata y Ensenada, con contacto por Instagram.
- `/admin`: resumen, alta/edición de productos, imagen, precios, stock por talle y sucursal, publicación, exportación CSV y estados de pedidos.

Una compra descuenta el stock de la sucursal y talle seleccionados. El pedido aparece inmediatamente en administración. Cambiar de sucursal vacía la bolsa para evitar mezclar disponibilidades. Si un producto se oculta o se reduce su stock desde administración, se vuelve a validar la bolsa antes de confirmar.

## Alcance de la demo

Todos los cambios se guardan en `localStorage` (`mistral-local-demo-v1`). No hay servidor, sincronización entre dispositivos, autenticación, pagos, correos ni reservas reales. El panel es público por diseño para presentar la propuesta. No usar para gestionar stock o pedidos reales.

Precios, imágenes y talles iniciales tomados del catálogo nacional como referencia; **el stock de ambas sucursales es ficticio**. Las direcciones, los horarios, las condiciones de entrega y los medios de pago deben confirmarse con el dueño. No se inventaron direcciones locales.

Para reiniciar la demo, borrar los datos de este sitio en el navegador. No ingresar datos personales reales durante la presentación.

## Publicación en Vercel

Importar `Serran0Juan/Mistral-la-plata`, usar la raíz del repositorio, preset **Vite**, comando `pnpm build` y salida `dist`. `vercel.json` ya configura el frontend y las rutas de la aplicación. No requiere variables de entorno.

El HTML tiene `noindex,nofollow` para mantener el prototipo fuera de los buscadores. Esto no constituye control de acceso.

## Validación

`pnpm test` ejecuta pruebas de la transacción de compra: inventario por sucursal/talle, duplicados, stock insuficiente, productos ocultos o eliminados, cantidades inválidas y conservación del estado al rechazar una operación. `pnpm build` comprueba TypeScript y genera el paquete de producción.

## Imágenes y referencias

Marca y fotografías: [Mistral Argentina](https://www.mistral.com.ar/). Contacto local: [@mistral_laplata](https://www.instagram.com/mistral_laplata/). La procedencia detallada está en `docs/asset-sources.json`; las fotos usadas están en `public/images`. Su uso aquí es para la presentación del prototipo; confirmar con la marca el uso en la tienda final.

La siguiente etapa requiere backend, autenticación y roles, inventario transaccional, catálogo real de las sucursales, medios de pago y logística.
