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

## El servidor

El catálogo que ve el cliente vive en una base de datos, no adentro del sitio.
Al abrir la tienda se piden los productos publicados y su stock por talle, y
reemplazan a lo que venía compilado.

| | |
|---|---|
| Proyecto | `mistral-ensenada` (Supabase), región São Paulo |
| Tablas | `products`, `stock`, `movements`, `orders`, `admins` |
| Permisos | cualquiera **lee** lo publicado; **escribe solo quien está en `admins`** |
| Se configura en | `src/server.ts`, o con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` |

**Si el servidor no contesta, la tienda no se rompe**: usa el catálogo que
trae adentro y sigue andando. Lo mismo si devuelve una lista vacía — más vale
mostrar precios de ayer que una tienda en blanco.

La clave que viaja en el sitio es pública a propósito, como en cualquier
tienda hecha así. Lo que protege los datos son los permisos de la base.
**Nunca poner ahí la clave de servicio.**

Los permisos están armados para que estar logueado **no alcance**: cada
política de escritura pregunta si el usuario figura en la tabla `admins`, que
se carga a mano desde el panel de Supabase. Si alguna vez quedan los registros
abiertos, o se filtra una cuenta cualquiera, esa cuenta ve exactamente lo mismo
que un visitante y no puede tocar nada. Probado contra la base: un logueado que
no es admin ve el catálogo publicado y cero pedidos, cero movimientos y cero
productos despublicados, y cualquier escritura le rebota.

`movements` y `orders` no son públicas: la primera dice cuánto entra y cuánto
se vende, la segunda tiene datos de clientes.

La CSP de `vercel.json` tiene que permitir el origen del servidor
(`connect-src ... https://*.supabase.co`). Sin eso el navegador bloquea el
pedido y la tienda cae al catálogo interno sin decir por qué.

### El panel publica

Con sesión abierta, el panel escribe en el servidor: productos, precios,
fotos, stock, el historial de movimientos y el estado de los pedidos. Lo que
carga el dueño sale publicado sin que nadie toque el código.

Cómo se comporta, que es lo que importa cuando falla:

- **El cambio se ve primero y se manda después**, así el panel no se congela
  esperando la red.
- **Si el envío falla, lo dice en la cara**: un cartel rojo con el motivo que
  dio el servidor y un botón para reintentar. Nunca se hace de cuenta que
  guardó.
- **Después de cada guardado recarga del servidor.** Es lo que confirma que
  quedó, y además trae lo que haya cambiado otra persona mientras tanto.
- **El panel ve lo despublicado**, que la tienda no muestra; si no, no habría
  forma de volver a publicarlo.
- **Sacar un talle lo borra también del servidor.** Sin ese barrido, el talle
  quedaba en la base con stock y todo.

### Lo que todavía no hace

El pedido de la tienda sigue saliendo por WhatsApp y no se guarda en el
servidor. Para que una compra web descuente stock sola hace falta hacerlo en
un solo paso del lado de la base, para que dos personas comprando lo último no
puedan comprarlo las dos. Esa es la etapa siguiente.

## Venta del mostrador

La pantalla **Venta del día** del panel es para descontar lo que se vende en el
local, que es la mayor parte. Se busca la prenda, se toca el talle y cada toque
suma una unidad al ticket; abajo de cada talle dice cuántas quedan, y el que no
tiene stock no se puede tocar. Una misma venta puede llevar varias prendas y
varios talles.

Al confirmar baja del stock y quedan los movimientos asentados con motivo
**Venta** y un número (`V-…`) que es el mismo para todo lo que se llevó la
misma persona, así en Movimientos se ve qué salió junto.

No se toca plata: el módulo es para saber qué queda, no para registrar
ingresos. Los motivos manuales de `Cargar stock` siguen siendo Ingreso,
Devolución, Rotura y Ajuste; las ventas no se cargan ahí.

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

## Entrar al panel

La tienda y el panel están separados: **ninguna página pública enlaza a
`/admin`**. Un cliente que recorre el sitio no se entera de que existe. Se
entra escribiendo la dirección a mano.

En el sentido inverso sí hay paso: desde el panel, **"Ver tienda"** (arriba a
la derecha) abre la tienda en otra pestaña, así el admin la mira sin perder lo
que estaba haciendo, y **"Volver a la tienda"** (abajo a la izquierda) sale del
panel.

`/admin` no muestra nada hasta que alguien entre. Hay dos formas y **no son
lo mismo**:

**1. Con usuario y contraseña (la de verdad).** La contraseña se verifica en
el servidor y vuelve un permiso que vence y se renueva solo. Con eso el panel
publica. El usuario se crea en el panel de Supabase (Authentication → Users) y
además hay que agregarlo a la tabla `admins`: sin eso entra pero no puede
escribir nada, y el login lo avisa en vez de dejarlo descubrirlo al primer
guardado. La sesión queda abierta entre visitas; el botón de salir, arriba a
la derecha, la cierra.

**2. Modo demo.** Solo si no se puede llegar al servidor. Ahí vale la
contraseña local de siempre, que abre el panel pero **no publica nada**: los
cambios se guardan en ese navegador. Sirve para mostrar el sistema sin
conexión; no sirve para trabajar. El panel lo dice arriba, en la chapita y en
el cartel.

La contraseña local de fábrica es **`Leomistral01`**.

**Para cambiar la local, desde el modo demo:** el botón de la llave, arriba a la derecha.
Pide la actual y la nueva. Esa contraseña queda guardada en el navegador donde
la cambiaste y pisa a la de fábrica; desde ese mismo diálogo se vuelve atrás.
En otra computadora o celular sigue valiendo la de fábrica, y borrar los datos
del sitio también la devuelve a esa.

**Para cambiar la de fábrica**, la que viene en el sitio para todos:

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

Eso vale para el **modo demo**. El acceso con usuario y contraseña es otra
cosa: ahí la contraseña se verifica del lado del servidor, no viaja ningún
hash en el sitio, y los permisos de la base son los que deciden qué se puede
leer y escribir.

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
checkout de Mercado Pago que arma el cobro solo necesita un servidor que hable
con Mercado Pago, porque el token de la cuenta no puede vivir en el navegador.
El servidor que ya hay guarda el catálogo; no cobra.

Mientras los precios y el stock sean de ejemplo, conviene dejar el link y el
alias vacíos: con uno cargado, un visitante puede pagar de verdad.

## Alcance de la demo

El catálogo, el stock, el historial y los pedidos cargados desde el panel
viven en el servidor. Lo que queda en `localStorage` (`mistral-local-demo-v1`)
es la bolsa, los favoritos, los pedidos hechos desde la tienda y todo lo que
se edite en modo demo.

Lo que el sitio **no** hace: cobrar (las formas de pago son un link y unos
datos para transferir; el sitio no cobra ni confirma nada), mandar correos,
reservar stock cuando alguien compra desde la web, ni descontar solo esa
compra.

Precios, imágenes y talles cargados hoy en el servidor vienen del catálogo
nacional como referencia; **el stock es ficticio** hasta que el dueño cargue
el suyo desde el panel. Las direcciones, los horarios, las condiciones de entrega y los medios de pago deben confirmarse con el dueño. No se inventaron direcciones locales.

Para reiniciar la demo, borrar los datos de este sitio en el navegador. No ingresar datos personales reales durante la presentación.

## Publicación en Vercel

El proyecto es [`mistral-la-plata`](https://vercel.com/frannn-m/mistral-la-plata), conectado a `FrancoMalacalza01/Mistral-la-plata`. Producción: https://mistral-la-plata-lime.vercel.app/ (sale de `main`). Para rearmarlo: importar `FrancoMalacalza01/Mistral-la-plata`, usar la raíz del repositorio, preset **Vite**, comando `pnpm build` y salida `dist`. `vercel.json` ya configura el frontend y las rutas de la aplicación. No requiere variables de entorno.

El sitio es indexable: el `noindex,nofollow` se sacó al agregar el SEO local. `public/robots.txt` pide no indexar `/admin`, lo que no constituye control de acceso. Para volver a esconderlo de los buscadores, agregar `<meta name="robots" content="noindex,nofollow" />` en `index.html`. Conviene hacerlo mientras el catálogo sea de ejemplo y no esté confirmado el uso del nombre y las fotos de Mistral.

## Validación

`pnpm test` ejecuta 57 pruebas, todas sin navegador ni red:

| Archivo | Qué cubre | |
|---|---|---|
| `commerce.test.mjs` | la transacción de compra: inventario por talle, duplicados, stock insuficiente, productos ocultos o eliminados, cantidades inválidas y conservación del estado al rechazar una operación | 19 |
| `serverSync.test.mjs` | lo que se le manda al servidor: que un producto, un movimiento y un pedido vayan y vuelvan iguales, que los valores que la base no acepta se corten antes de salir, y que un talle con coma no parta el filtro de borrado | 20 |
| `catalogMap.test.mjs` | lo que llega del servidor: filas incompletas, columnas en `null`, cantidades basura | 10 |
| `migrate.test.mjs` | la conversión de una demo guardada con la forma vieja (stock por sucursal) a la actual | 8 |

`pnpm build` comprueba TypeScript y genera el paquete de producción.

El login y la publicación se probaron además en un navegador real, contra un
servidor que habla el mismo protocolo que Supabase y con los headers de
producción puestos (20 comprobaciones): contraseña mal puesta, cuenta sin
permiso, entrada del dueño, publicar y ocultar, venta del mostrador bajando
stock y dejando movimiento, barrido de talles viejos, sesión que sobrevive a
recargar, cierre de sesión, un guardado rechazado por el servidor mostrando el
cartel rojo, y ninguna llamada bloqueada por la CSP.

## Imágenes y referencias

Marca y fotografías: [Mistral Argentina](https://www.mistral.com.ar/). Contacto local: [@mistral.zero.indumentaria](https://www.instagram.com/mistral.zero.indumentaria/). La procedencia detallada está en `docs/asset-sources.json`; las fotos usadas están en `public/images`. Su uso aquí es para la presentación del prototipo; confirmar con la marca el uso en la tienda final.

La siguiente etapa es el inventario transaccional: que una compra desde la web
descuente stock en un solo paso del lado de la base. Falta además el catálogo
real del local, los medios de pago y la logística.
