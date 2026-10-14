# Mistral · Ensenada

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
- `/checkout`: compra de demostración, con retiro en el local o envío a La Plata, Berisso o Ensenada.
- `/sucursales`: el local de Ensenada, con contacto por Instagram.
- `/admin`: no está enlazado desde la tienda; se entra escribiendo la dirección. Pide contraseña (ver abajo). Resumen, alta/edición de productos, imagen, precios, stock por talle, publicación, exportación CSV y estados de pedidos.

Una compra descuenta el stock del talle seleccionado. El pedido aparece inmediatamente en administración. Si un producto se oculta o se reduce su stock desde administración, se vuelve a validar la bolsa antes de confirmar.

## Paleta

El azul y el rojo salen del logo oficial (`public/images/mistral-logo.png`),
medidos sobre el archivo: `#132457` es el 89% de los píxeles opacos y `#cc0035`
es el punto de la "i". Coinciden con la dirección visual anotada en
`docs/asset-sources.json` ("navy, red, off-white") al relevar el sitio de la
marca.

Los tokens están en `:root`, en `src/styles.css`. El resto de la paleta se
derivó del verde anterior conservando la luminosidad de cada color y girando
solo el tono, así que los contrastes no empeoraron. Quedaron fuera a propósito
los colores con significado: entrada y salida de stock, error y alerta de stock
bajo.
## Envíos

Las zonas están en `src/delivery.ts`. Hoy: La Plata, Berisso y Ensenada.
Agregar o sacar una de esa lista alcanza — aparece sola en el checkout y viaja
en el pedido de WhatsApp. Si la lista queda vacía, el checkout vuelve a ser
solo retiro.

El costo va sin precio a propósito: mientras `cost` no esté definido, el sitio
dice que se coordina por WhatsApp en vez de inventar un número. Poniendo
`cost: 0` dice "Sin costo", y con un número lo muestra.

El local está en La Merced 327, Ensenada (CP 1925). La dirección también va en
los datos estructurados de `index.html`, que es lo que lee Google, junto con
las tres ciudades como zona de cobertura.

## Contraseña del panel

La tienda y el panel están separados: **ninguna página pública enlaza a
`/admin`**. Un cliente que recorre el sitio no se entera de que existe. Se
entra escribiendo la dirección a mano.

En el sentido inverso sí hay paso: desde el panel, **"Ver tienda"** (arriba a
la derecha) abre la tienda en otra pestaña, así el admin la mira sin perder lo
que estaba haciendo, y **"Volver a la tienda"** (abajo a la izquierda) sale del
panel.

`/admin` pide una contraseña antes de mostrar nada. Se cambia así:

```sh
node scripts/clave-admin.mjs "la nueva clave"
```

El script imprime un bloque con el hash y la sal; se pega en
`src/adminAccess.ts`, reemplazando el que está. Sin argumento inventa una
contraseña y la muestra. Dejando `hash` y `salt` vacíos, el panel vuelve a
abrirse sin contraseña.

La contraseña no se guarda en ningún lado: lo que viaja al navegador es un
hash PBKDF2-SHA256 con 310.000 vueltas, y del hash no se vuelve a la
contraseña. Queda desbloqueado mientras dure la pestaña; al cerrarla, la pide
de nuevo.

**Qué es y qué no es.** Esto evita que alguien entre de casualidad o
curioseando. No es control de acceso de verdad, por dos motivos que conviene
decir antes de que los descubra el cliente:

- El hash viaja en el sitio, como todo el código. No se puede volver de ahí a
  la contraseña, pero sí probar contraseñas contra él sin límite y sin que nos
  enteremos. La traba vale lo que valga la contraseña: una corta o adivinable
  no sirve.
- Los datos de la demo están en el `localStorage` del navegador y se leen sin
  contraseña. Esto tapa la pantalla, no los datos.

El acceso de verdad, con usuario, contraseña y roles verificados en un
servidor, es Etapa 2.

## Formas de pago

Se configuran en `src/payment.ts`. Lo que quede vacío o en `false` no se
muestra, y el pedido sigue saliendo por WhatsApp como antes.

| Campo | Qué hace |
|---|---|
| `mercadoPagoUrl` | Link de pago de Mercado Pago (Cobrar → Link de pago). Aparece el botón "Pagar con Mercado Pago". |
| `mercadoPagoAlias` | Alias o CVU de Mercado Pago, con botón para copiarlo. |
| `bankAlias`, `bankCbu`, `bankHolder`, `bankName` | Transferencia bancaria. Con el alias o el CBU alcanza para que la opción aparezca. |
| `cuentaDniAlias`, `cuentaDniQr` | Cuenta DNI (Banco Provincia): el alias donde recibís, y opcionalmente la URL de la imagen de tu QR de comercio. |
| `cash`, `cardInStore` | Efectivo y tarjeta al retirar. No necesitan configuración. |

La forma elegida queda guardada en el pedido, se ve en el panel y viaja en el
mensaje de WhatsApp.

**Sin servidor no se puede cobrar el total exacto de la bolsa de forma
automática.** Un link de pago lleva el monto fijo con el que se creó, así que
sirve para una seña o un precio redondo; para cobrar el importe exacto están el
alias (el cliente transfiere y manda el comprobante) o el cobro en el local. El
checkout de Mercado Pago que arma el cobro solo necesita backend, porque el
token de la cuenta no puede vivir en el navegador: es Etapa 2.

Mientras los precios y el stock sean de ejemplo, conviene dejar el link y el
alias vacíos: con uno cargado, un visitante puede pagar de verdad.

## Alcance de la demo

Todos los cambios se guardan en `localStorage` (`mistral-local-demo-v1`). No hay servidor, sincronización entre dispositivos, autenticación, cobros procesados por el sitio, correos ni reservas reales: las formas de pago son un link y unos datos para transferir, el sitio no cobra ni confirma nada. No usar para gestionar stock o pedidos reales.

Precios, imágenes y talles iniciales tomados del catálogo nacional como referencia; **el stock es ficticio**. Las direcciones, los horarios, las condiciones de entrega y los medios de pago deben confirmarse con el dueño. No se inventaron direcciones locales.

Para reiniciar la demo, borrar los datos de este sitio en el navegador. No ingresar datos personales reales durante la presentación.

## Publicación en Vercel

El proyecto es [`mistral-la-plata`](https://vercel.com/frannn-m/mistral-la-plata), conectado a `FrancoMalacalza01/Mistral-la-plata`. Producción: https://mistral-la-plata-lime.vercel.app/ (sale de `main`). Para rearmarlo: importar `FrancoMalacalza01/Mistral-la-plata`, usar la raíz del repositorio, preset **Vite**, comando `pnpm build` y salida `dist`. `vercel.json` ya configura el frontend y las rutas de la aplicación. No requiere variables de entorno.

El sitio es indexable: el `noindex,nofollow` se sacó al agregar el SEO local. `public/robots.txt` pide no indexar `/admin`, lo que no constituye control de acceso. Para volver a esconderlo de los buscadores, agregar `<meta name="robots" content="noindex,nofollow" />` en `index.html`. Conviene hacerlo mientras el catálogo sea de ejemplo y no esté confirmado el uso del nombre y las fotos de Mistral.

## Validación

`pnpm test` ejecuta 19 pruebas de la transacción de compra: inventario por talle, duplicados, stock insuficiente, productos ocultos o eliminados, cantidades inválidas y conservación del estado al rechazar una operación. `pnpm build` comprueba TypeScript y genera el paquete de producción.

## Imágenes y referencias

Marca y fotografías: [Mistral Argentina](https://www.mistral.com.ar/). Contacto local: [@mistral.zero.indumentaria](https://www.instagram.com/mistral.zero.indumentaria/). La procedencia detallada está en `docs/asset-sources.json`; las fotos usadas están en `public/images`. Su uso aquí es para la presentación del prototipo; confirmar con la marca el uso en la tienda final.

La siguiente etapa requiere backend, autenticación y roles, inventario transaccional, catálogo real del local, medios de pago y logística.
