# Zero Indumentaria · Ensenada

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

Para trabajar de a dos (ramas, pull requests, qué no tocar): [`AGENTS.md`](AGENTS.md).

## Recorridos

- `/`: inicio, novedades y colecciones.
- `/hombre`: colección de Hombre de Mistral y Brooksfield, con todas las secciones, búsqueda y galerías de fotos. Los modelos, precios y talles disponibles en Zero se confirman con el local.
- `/tienda`: catálogo público de prendas de **Hombre**, con búsqueda, filtros visuales, orden por precio, talles y disponibilidad. `/tienda?new=1` es **New in**: lo marcado como novedad. La tienda publica sólo esas dos cosas: las fichas de Accesorios se conservan en administración, con sus precios y su stock, para no borrar datos, pero no se publican. Qué categorías se publican lo decide `src/storefront.mjs` (probado en `tests/storefront.test.mjs`).
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
| Tablas | `products`, `stock`, `movements`, `orders`, `admins`, `settings` |
| Permisos | cualquiera **lee** lo publicado; **escribe solo quien está en `admins`** |
| La compra | la hace la base en un solo paso (`crear_pedido`) |
| El esquema | `db/esquema.sql` y `db/crear_pedido.sql` |
| Se configura en | `src/server.ts`, o con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` |

El esquema completo vive en el repo, no sólo en Supabase: `db/esquema.sql`
(tablas y permisos) y `db/crear_pedido.sql` (la compra). Los dos se pueden
volver a correr sin romper nada, así que sirven para levantar la base de cero
y para revisar qué permisos hay sin entrar al panel. Los productos no están
ahí: los carga el dueño.

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

La CSP (`vercel.json` y `public/_headers`) tiene que permitir el origen del servidor
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

### La compra la cierra la base

Cuando alguien compra en la tienda, el navegador **no** descuenta nada: le
pide a la base que lo haga, y la base lo hace todo junto o no hace nada
(`crear_pedido`). En un solo paso valida, descuenta el stock, guarda el pedido
y asienta los movimientos, con la fila del stock trabada mientras lo hace.

Eso es lo que resuelve el caso que importa: **dos personas comprando la última
prenda al mismo tiempo**. La segunda espera a que termine la primera, lee lo
que quedó y rebota con el motivo exacto — "Quedan 0 de Buzo Alva talle M" —
aunque su pantalla todavía dijera que había. El stock no queda en negativo y
no se crea un pedido que el local no puede cumplir.

Lo demás que hace falta aclarar:

- **Los precios los pone la base.** No viajan desde el navegador. Si alguien
  edita el pedido antes de mandarlo, cambia lo que pide, no lo que paga.
  Probado: un pedido con `"price": 1` y el nombre cambiado se guarda con el
  precio y el nombre reales.
- **Si algo falla a mitad de camino, no queda nada a medias.** Un pedido de
  tres prendas donde la tercera no alcanza deja el stock de las dos primeras
  como estaba.
- **Si no se pudo confirmar, el cliente se entera.** Sin conexión no se le
  muestra una compra que no existe: se le dice que no se pudo confirmar y no
  se descuenta nada.
- **Un freno de mano**: la función la puede llamar cualquiera que entre a la
  tienda, así que un script podría dejar el local en cero sin comprar nada.
  Más de diez pedidos por minuto se rechazan. También hay topes por pedido
  (20 unidades por talle, 50 en total, 40 renglones).
- **El pedido guarda el nombre, el precio y la foto de cada prenda.** Dentro
  de un mes el producto puede cambiar y el pedido tiene que seguir diciendo
  qué se vendió y a cuánto.

Dos avisos del linter de Supabase quedan abiertos **a propósito**: dicen que
`crear_pedido` la puede ejecutar cualquiera sin estar logueado. Es exactamente
lo que tiene que pasar — es la única forma de que un cliente compre — y es
segura porque la función valida todo adentro, pone ella los precios y lo único
que escribe es un pedido, sus movimientos y el descuento de stock.

### El sitio cobra

Con el cobro online prendido, al cerrar la compra el cliente ve **"Pagar
ahora"** y va a Mercado Pago con el total exacto del pedido, envío incluido.
Cuando el pago se acredita, el pedido queda marcado como pagado solo y pasa a
*Preparando*.

Eso vive en tres funciones que corren en el servidor, no en el navegador:

| Función | Qué hace |
|---|---|
| `crear-pago` | Le pide a Mercado Pago el cobro del monto exacto del pedido. |
| `pago-aviso` | Recibe el aviso de Mercado Pago y anota cómo quedó el pago. |
| `enviar-mail` | Le manda al cliente la confirmación de su pedido. |

Están en `supabase/functions/` y corren como Edge Functions, que entran en el
plan gratuito de Supabase: **no agregan costo de infraestructura**. Lo que sí
cuesta es la comisión de Mercado Pago por venta, que es de Mercado Pago.

Cuatro decisiones que importan:

- **El token de Mercado Pago nunca viaja al navegador.** Con ese token
  cualquiera cobraría en nombre del local. Vive como secreto en Supabase y lo
  único que lo usa es la función. Por eso el cobro online no se puede prender
  del todo desde el panel: el interruptor está ahí, pero el token hay que
  cargarlo en Supabase.
- **El monto lo decide el servidor, no el navegador.** La función lee el
  pedido de la base y cobra eso. Si alguien edita la página antes de pagar,
  cambia lo que ve, no lo que paga.
- **Al aviso de pago no se le cree.** Mercado Pago manda el id del pago, no el
  resultado; la función le pregunta a Mercado Pago cómo quedó. Si se confiara
  en el cuerpo del aviso, cualquiera podría mandar un POST diciendo "el pedido
  M-00007 está pagado" y el local prepararía mercadería que nadie pagó.
- **Sin configurar, nada se rompe.** Si falta el token, el botón avisa que el
  cobro online no está disponible y la tienda sigue con el alias y el link de
  siempre. Lo mismo con el mail.

### Habilitar la compra online de todo el catálogo

Las 950 prendas de Mistral y Brooksfield se ven en `/hombre`, pero **no se pueden comprar hasta que
tengan stock**: el sistema no inventa stock. En *Productos y stock* hay un cuadro, **Habilitar la
compra online de todo el catálogo**, para hacerlo de una vez:

1. El local escribe **cuántas unidades por talle** (de 1 a 999).
2. Marca que entiende que se van a poder comprar online. Sin eso, el botón no se enciende.
3. Se guardan las prendas de a una (cada una en su transacción, 3 a la vez), con el avance a la
   vista y un botón **Detener**. Quedan afuera las que ya están administradas, las dadas de baja y
   las sin talles. Se respeta el precio propio que el local ya puso.
4. Después, lo que no se tenga se saca de la venta desde *Precios* o editando la prenda.

**Ojo:** mientras estén así, cualquier cliente puede comprar esas unidades. Si no las hay, se vende
lo que no existe. Las prendas importadas se compran desde `/hombre` y **no aparecen en `/tienda`**
(sin paginación, serían cientos de tarjetas). La lógica está en `fichasParaHabilitar()`
(`src/importarCatalogo.mjs`, con pruebas) y el cuadro en `src/AdminHabilitar.tsx`.

### Cobro con tarjeta por Payway

Además de Mercado Pago, la tienda puede cobrar con tarjeta (Visa crédito y débito)
por **Payway**, dentro de la misma pantalla de "pedido tomado". Viene **apagado**:
se prende desde *Configuración → Cobrar antes de entregar → Cobrar con tarjeta por
Payway*, y no se ve nada hasta que haya una clave pública cargada.

Es el modelo **NO PCI** de Payway: los datos de la tarjeta salen del navegador
**directo a Payway** (`POST /tokens`, con la clave pública) y vuelve un token. A
nuestro servidor llegan sólo el pedido, el token, los 6 primeros dígitos y el medio
de pago: nunca el número, el vencimiento ni el código. La función `payway-pagar`
(`supabase/functions/payway-pagar`) cobra con ese token (`POST /payments`, con la
clave **privada**).

| Qué | Cómo |
|---|---|
| **El monto** | Sale del pedido guardado en la base, no del navegador. |
| **Quién puede cobrar un pedido** | Cada pedido nace con un **código de pago** al azar (`pago_token`, 64 caracteres) que sólo recibe quien lo hizo, en la respuesta de `crear_pedido`. Sin ese código la función no cobra: los números de pedido son correlativos y, sin esto, cualquiera podía probar tarjetas robadas contra pedidos ajenos. Un pedido inexistente y un código equivocado dan la **misma** respuesta. El código no se guarda en el navegador ni viaja por mail. |
| **Intentos** | Cada pedido admite **3** intentos de cobro (`pago_intentos`); después hay que escribir al local. Corta el "probar tarjetas" aun con el código. |
| **Doble cobro** | La base reserva el pedido (`reservar_cobro`, con el pedido trabado) antes de llamar a Payway: sólo pasa si estaba *sin pago* o *rechazado*; dos cobros a la vez no pueden seguir los dos. |
| **Cada intento** | Lleva su propio `site_transaction_id` (alfanumérico, hasta 40). Un pago rechazado se reintenta con uno nuevo. |
| **Estados** | `approved` → el pedido queda *pagado* y pasa a *Preparando*; `rejected` → *rechazado* y se puede reintentar con otra tarjeta; **cualquier otra cosa (`review`, `preapproved`, un error) NO se da por pagada**. |
| **Sin respuesta** | Si Payway no contesta, el pedido queda *pendiente* y se le dice al cliente que no repita el pago: puede haber cobrado. Se revisa en el backoffice de Payway por el `site_transaction_id`. |
| **Qué se guarda** | `payment_status` y, en `pago_ref`, `payway:<id del pago>` (hace falta para consultar, anular o devolver). No se toca la base: son columnas que ya existían. |
| **Dónde viaja la tarjeta** | La dirección de la API sólo puede ser `https://…payway.com.ar` (el panel y la función lo exigen), así que los datos de la tarjeta no pueden ir a otro lado aunque alguien cambie la configuración. |

**Cómo se prende (Sandbox primero):**

1. Payway da las claves de **Sandbox** (pública y privada) y el acceso al backoffice de Pagos Online.
2. En Supabase: *Edge Functions → Secrets → `PAYWAY_PRIVATE_API_KEY`* con la clave **privada**.
3. Desplegar las funciones: `supabase functions deploy payway-pagar --no-verify-jwt` (la llama la tienda, donde el cliente no tiene cuenta, igual que `crear-pago`) y `supabase functions deploy payway-anular` (**sin** `--no-verify-jwt`: sólo la llama el panel, con sesión de admin).
4. En el panel: la clave **pública** y la dirección (viene la de Sandbox), y prender el interruptor.
5. Correr los casos de prueba de Payway (aprobado, rechazado 05 y 51, anulación). **Sin eso no habilitan producción.**
6. Producción: Payway da claves nuevas. Cambian dos cosas: las claves y la dirección
   (`https://ventasonline.payway.com.ar/api/v2`; para la función, el secreto `PAYWAY_URL`).
   Antes de abrirlo a todos, un pago real de monto mínimo.

**Anular un pago (cancelar un pedido pagado por Payway).** Cancelar un pedido devuelve el
stock pero no la plata, y un pago de tarjeta hay que anularlo en Payway. Por eso, en el panel,
**Cancelar** sobre un pedido pagado por Payway primero llama a la función `payway-anular`
(`POST /payments/{payment_id}/refunds`, cuerpo vacío) y **sólo si Payway confirma la anulación**
cancela el pedido y devuelve el stock:

- **Sólo un admin puede anular.** La función exige una sesión válida y que el usuario esté en
  `admins`; la clave pública de la tienda no alcanza. Se despliega con la verificación de JWT
  prendida (la de fábrica), a diferencia de `payway-pagar`.
- El id del pago sale de la base (`pago_ref`), no del panel. Se marca *devuelto* con una escritura
  condicional **antes** de llamar a Payway (dos anulaciones a la vez no pasan las dos) y **vuelve a
  *aprobado*** si Payway no lo confirma, no se entiende o no contesta: no se da por devuelta una
  plata que no sabemos si volvió.
- Si Payway **rechaza** (por ejemplo, ya se cerró el lote), el panel le pregunta al dueño si cancela
  el pedido igual y devuelve la plata a mano desde el backoffice de Payway. Si no está claro qué
  pasó (incierto o error), **no cancela nada**.
- **Sólo anulación total.** La devolución parcial, o la posterior al cierre de lote, no está hecha:
  la documentación no aclara si el monto va en centavos o en pesos, y equivocarse devolvería una
  fracción. Se hace desde el backoffice de Payway.

**Medios de pago:** sólo los dos ids confirmados en la documentación (Visa crédito `1`,
Visa débito `31`). Para sumar otro se agrega en `MEDIOS` de
`supabase/functions/_shared/payway.mjs` con el id de la tabla "Medios de pago
disponibles" de Payway; no se adivinan. Pago simple, **una cuota**.

**El código de pago protege todas las funciones que actúan sobre un pedido desde la tienda:**
`payway-pagar`, `crear-pago` (Mercado Pago) y `enviar-mail` lo piden (`supabase/functions/_shared/codigoDePago.mjs`).
Sin él, un pedido inexistente y uno con código equivocado contestan lo mismo (404), así que no se pueden recorrer
los números de pedido para cobrar, armar links o hacer que el local mande por mail pedidos de otros clientes.
`pago-aviso` (el aviso de Mercado Pago) además verifica que el monto pagado sea el del pedido y no deja que un
aviso tardío pise un pago ya aprobado (sólo una devolución lo cambia). Se prueba en
`supabase/functions/pago-aviso/prueba.ts` (con Deno). Tras cambiar estas funciones hay que **volver a desplegar**
`payway-pagar`, `crear-pago`, `enviar-mail` y `pago-aviso`.

**Se prueba sin Payway:** `tests/payway.test.mjs` cubre las cuentas y las reglas, y
`supabase/functions/payway-pagar/prueba.ts` y `supabase/functions/payway-anular/prueba.ts` (con Deno)
corren las funciones enteras contra una base y un Payway simulados: aprobado, rechazado, doble cobro,
estados raros, credenciales mal, falta de respuesta, entradas inválidas y, en la anulación, que sólo un admin pueda.

### Cancelar un pedido devuelve el stock

La compra descuenta el stock al crearse, que es lo que evita sobrevender. El
otro lado de esa moneda: un pedido que nadie paga se quedaría con las prendas
reservadas para siempre. En la pestaña de pedidos, **Cancelar** devuelve el
stock, deja el movimiento que lo explica y marca el pedido como *Cancelado*,
los tres en un solo paso de la base. Es idempotente: cancelar dos veces no
devuelve el stock dos veces.

### Lo que todavía no hace

Si el servidor no contesta cuando alguien entra, la tienda muestra el catálogo
que trae adentro y la compra se cierra en el navegador, como en la demo: el
pedido llega igual por WhatsApp, pero ese descuento de stock no está en la
base y hay que acomodarlo a mano.

**No factura.** Ver *Facturación* más abajo.

## Precios

La pestaña **Precios** junta en una sola tabla todos los artículos: los
productos de la tienda y las 950 prendas del catálogo de hombre, que viven en
lugares distintos pero se cambian igual. Se trabaja como en una planilla.

**Cambiar un precio.** Clic en el precio, se escribe y **Enter guarda y baja a la
fila de abajo** (también Tab y la flecha ↓; Mayús+Enter sube; Esc cancela; hacer
clic afuera guarda). Mientras se escribe se ve la variación en vivo (▲ 10%). Se
entiende como lo escribe la gente (`32900`, `32.900`, `$ 32.900`) y no se
adivina: centavos, cero o letras se rechazan ahí mismo. Un cambio de más del
doble o menos de la mitad pregunta antes, porque casi siempre es un cero de más
o de menos.

**Cambiar muchos de una vez.** Se eligen con las casillas (o *Elegir los N* para
todo lo que cumple el filtro) y se aplica una regla: subir o bajar un
porcentaje, sumar o restar un monto, o fijar un precio, con redondeo a $100,
$500, $1.000 o *terminado en 900*. Antes de aplicar se ve cómo queda cada uno
(antes → después, y cuántos cambian) y cuáles no se pueden: bajar el 100% o
restar más de lo que cuesta no deja un precio en cero, avisa y no toca esa
prenda.

**Deshacer.** *Deshacer* y *Rehacer* (o Ctrl+Z y Ctrl+Mayús+Z) revierten el
último cambio, aunque haya tocado 300 precios a la vez. Guarda los últimos 30.

**Encontrar lo que se busca.** Búsqueda, origen (tienda u hombre), marca,
sección, estado (a la venta, fuera de venta, con precio propio, tocados en esta
sesión) y un rango de precios, todo combinable. Las columnas se ordenan con un
clic. *Exportar CSV* baja lo que está filtrado, listo para Excel.

**Dos tipos de artículo.**
- **Tienda**: el precio vive en el producto. El *precio anterior* es el que se
  muestra tachado: si el precio nuevo lo alcanza o lo pasa, se saca, porque
  si no el "descuento" subiría el precio.
- **Hombre**: viene de fábrica en `src/men-catalog.json` con el precio que
  publica cada marca, y eso no se edita. El precio del local se guarda aparte,
  como una lista de excepciones por prenda: lo que no se toca sigue con el
  precio de la marca, así que con 950 prendas no hay que cargar nada para que la
  tienda ande. Poner el precio de la marca no guarda una excepción (no sería un
  cambio). Se muestra como *Precio Zero*, y *volver* la devuelve a la marca.

**Ofertas.** Una oferta es un precio rebajado con el **precio anterior tachado**
y una etiqueta de descuento (*−20%*), tanto en los productos de la tienda como
en las prendas de hombre. Se arma desde la misma tabla:

- En cualquier fila, **poner en oferta** elige ese artículo, arma la regla y
  deja el cursor en el porcentaje. Para varios, se eligen y se usa la operación
  *Poner en oferta (descuento %)*, con redondeo si se quiere. La vista previa
  muestra el precio de antes tachado y el nuevo.
- **El descuento se cuenta siempre sobre el precio original**, no sobre el ya
  rebajado: repetir una oferta cambia el descuento en lugar de acumularlo (un
  20% y después un 30% dan 30% del original, no 44%).
- La etiqueta muestra el descuento **real**: con redondeo, un 20% pedido sobre
  $35.900 que se redondea a $28.900 es en verdad un 19,5% y dice −19%.
- Si el redondeo se come el descuento (un 1% redondeado a los $1.000 vuelve al
  mismo precio), no es una oferta: avisa y no se puede aplicar.
- **Terminar la oferta** (en la fila o en bloque) vuelve al precio anterior y
  saca el tachado. Cambiar a mano el precio de algo en oferta la termina sólo si
  el precio nuevo alcanza o pasa al anterior; si sigue siendo menor, sigue
  siendo una oferta.
- Se puede deshacer y rehacer como cualquier otro cambio, y hay un filtro
  *En oferta*.

**Las ofertas no vencen solas.** Se terminan a mano. Es a propósito: el precio
que se cobra lo calcula la base al comprar (`crear_pedido`), y un vencimiento
automático tiene que decidirse ahí y no en la pantalla, o el cliente vería un
precio y pagaría otro. Eso está anotado en `docs/pendientes.md`.

**Sacar de la venta no borra.** La prenda o el producto deja de verse en la
tienda y se pone a la venta de nuevo cuando vuelva, con el precio que tenía.
Borrar de verdad un producto de la tienda se hace desde su editor, en *Productos
y stock* (*Dar de baja*): ahí el stock que tenía queda anotado como ajuste en
*Movimientos*.

La lógica está en `src/priceTools.mjs` y `src/menOverrides.mjs` (probadas en
`tests/priceTools.test.mjs` y `tests/menOverrides.test.mjs`). Las excepciones del
catálogo de hombre viven en la tabla `catalog_overrides`: se lee pública, porque
la tienda necesita saber qué ocultar, y sólo la escribe un admin. **Hay que
crearla una vez** corriendo `db/ajustes-catalogo.sql` en el SQL Editor de
Supabase (guarda precios propios, bajas y ofertas); para comprobar que quedó bien
se corre `db/verificar-ajustes-catalogo.sql`, que sólo lee y tiene que dar `true`
en todas las filas. Mientras la tabla no exista, el panel avisa que no pudo
guardar. Si la tienda
no llega al servidor, usa lo último que supo en ese navegador antes que volver a
mostrar lo que se sacó de la venta.

### Ofertas con fecha de fin

Una oferta es un precio bajo con el de antes tachado. Si además tiene **fecha de fin**,
el día elegido (hasta las 23:59, hora de Argentina) la oferta termina sola y vuelve a
valer el precio de antes: nadie tiene que acordarse. Se carga en la ficha del producto
(*La oferta termina el*) o en *Precios*, al poner en oferta varias prendas a la vez. Sin
fecha, la oferta dura hasta que se termine a mano, como antes.

- **Quién decide lo que se cobra es la base.** `public.precio_vigente(price, old_price,
  offer_until)` devuelve el precio de antes si la oferta venció, y `crear_pedido` cobra
  ese. La misma regla está en `src/ofertas.mjs` para lo que ve el cliente. Si una se
  cambia, hay que cambiar la otra: `tests/ofertas.test.mjs` y `db/probar-local.sh`
  fijan las dos con los mismos casos.
- **No hay un proceso que "termine" la oferta.** El precio vigente se calcula en el
  momento, así que no hay nada que pueda fallar a las 00:00. La fila guarda lo que se
  cargó; la que venció se ve y se cobra como precio común, y al guardarla otra vez el
  panel la deja limpia.
- **Una página ya abierta** puede seguir mostrando la oferta un rato después de vencer;
  al comprar, la base cobra el precio de antes, y el carrito se actualiza al recargar.
- Un vencimiento sin precio anterior no se guarda (no habría a qué volver).
- **Para activarlo** hay que correr, en este orden, `db/ofertas-con-vencimiento.sql`,
  `db/catalogo-editable.sql` y `db/crear_pedido.sql` en el SQL Editor, y mirar que
  `db/verificar-ofertas-con-vencimiento.sql` dé todo en `true`. Hasta entonces el sitio
  anda como antes (la tienda tolera que falte la columna), pero no hay que usar fechas.

## Tablas de talle de referencia

Las prendas de Brooksfield sin tabla propia (pantalones, bermudas, buzos, chalecos) muestran la de la prenda más
parecida (jeans o sweaters), con el aviso *"Medidas de referencia"*. Los shorts de baño y los accesorios no tienen tabla.
Las de Mistral cuya ficha no trae medidas (remeras, polos, camisas, camperas, buzos) usan la tabla equivalente de
Brooksfield, con el aviso de que es de referencia y de otra marca. Los joggings de Mistral y las fragancias no tienen tabla.

## Localidades en el envío

- **Localidades.** En Configuración → Envíos → *Localidades* el local carga localidad + código postal. En la
  ficha, la bolsa y el checkout el cliente elige su localidad (o "Otra" y escribe el código) y el costo sale solo.
  No se consulta ningún servicio externo, así que la dirección del cliente no sale del sitio. La calle y el número
  se siguen pidiendo al confirmar el pedido (guardarlos en el pedido necesitaría un cambio en la base).
  `db/cargar-localidades-de-envio.sql` carga las de la zona de una vez.

## Pedidos sin pagar que no traban el stock

Cada pedido descuenta las unidades al crearse. Sin un límite, alguien podía crear pedidos
sin pagarlos y dejar una prenda "agotada". Por eso, un pedido **de pago online** (tarjeta o
Mercado Pago) que nadie paga se **cancela solo a las 48 horas** y devuelve su stock, con su
movimiento de *Devolución*. Las horas se cambian en el panel (Configuración → *Pedidos sin
pagar*; 0 = no vencen). Los de efectivo o transferencia **no** vencen solos, porque se arreglan
con el local y pueden tardar: esos los cancela una persona desde Pedidos.

La limpieza la corre la propia compra (`crear_pedido` llama a `vencer_pedidos_sin_pago()`), así
que no hace falta ningún horario programado.

- **Para activarlo**, en el SQL Editor y en este orden: `db/pagos-seguros.sql`, luego
  `db/crear_pedido.sql`, y mirar que `db/verificar-pagos-seguros.sql` dé todo en `true`.
  Después, volver a desplegar `payway-pagar`. **El orden importa:** `crear_pedido.sql` usa lo que
  crea `pagos-seguros.sql`, y la tienda nueva espera el código de pago.
- Probado en `db/probar-local.sh` (código equivocado, inexistente, 3 intentos, vencimiento que
  sólo toca lo de pago online sin pagar y no devuelve dos veces) y en
  `supabase/functions/payway-pagar/prueba.ts`.

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

La identidad visible usa el logo de Zero Indumentaria en
`public/images/zero-indumentaria-logo.png` y una paleta neutra. Los colores
principales están en `:root`, en `src/styles.css`.
## Configuración del local

Esto antes vivía en el código y había que tocar archivos y volver a publicar
el sitio para cambiar un alias. Ahora se carga **desde el panel**, en
*Configuración*, y vive en el servidor: el WhatsApp, la dirección y los
horarios, las formas de pago, las zonas de envío y la política de
devoluciones.

Si el servidor no contesta, la tienda usa los valores de fábrica. Una
configuración a medias no puede dejar la tienda sin zonas ni sin dirección:
lo que no se entiende se reemplaza por el valor de fábrica, prenda por prenda.

**El WhatsApp activa el botón de consulta.** Cada prenda de hombre (en la
tarjeta y en la galería) tiene un botón **Consultar por WhatsApp** que abre el
chat del local con el mensaje ya escrito: el nombre de la prenda (que incluye el
código), la marca y el precio que ve el cliente, incluido el *Precio Zero* y,
si está en oferta, de cuánto era ("$ 29.600 (antes $ 32.900)"). Así
quien atiende sabe de cuál se trata sin preguntar. El botón **sólo aparece si
hay un WhatsApp cargado**, igual que los otros botones de WhatsApp del sitio; un
número que no es un teléfono (vacío, "123") tampoco lo muestra, para no mandar
al cliente a un desconocido. El armado del enlace está en `src/whatsapp.mjs`.

**Nada de secretos acá.** La tabla `settings` se lee pública, porque la tienda
tiene que mostrar los alias y las zonas. Es lo mismo que le darías a un cliente
por WhatsApp.

## Envíos

Zonas de fábrica: **Ensenada, Berisso, La Plata y el resto de la Provincia de
Buenos Aires**. Se agregan y se sacan desde el panel; cada una tiene nombre,
costo y si va por reparto propio o por Correo Argentino.

- **Quién paga el envío.** Lo paga quien compra, y el checkout lo dice con todas las letras
  (`textoQuienPagaEnvio`): pasado el monto del envío gratis, lo pagamos nosotros. El texto
  toma el monto de la configuración, así no promete uno distinto del que cobra la base.
- **El envío se suma en la bolsa, no recién en el checkout.** La bolsa pregunta "¿Cómo lo
  recibís?" (retiro o envío a una zona), muestra el costo de esa zona, cuánto falta para el
  envío sin cargo y el total con envío. La elección se recuerda en la pestaña
  (`src/zonaElegida.ts`) y el checkout arranca desde ahí. El cálculo es el mismo de siempre
  (`costoEnvio`), y el que manda al cobrar es `crear_pedido`.
- **La zona sale del código postal.** Cada zona puede decir qué códigos cubre
  (*Configuración → Envíos → Códigos postales que cubre*, por ejemplo `1923, 1925, 1900-1909`).
  Si alguna zona los tiene, la bolsa y el checkout piden el código postal del cliente (acepta
  `1925`, `B1925` y `B1925ABC`) y la zona, con su costo, salen solas. Si dos zonas cubren el mismo
  código gana la primera de la lista (poné la más específica arriba). Un código que ninguna zona
  cubre no se acepta: el aviso manda a WhatsApp y no se puede continuar, en vez de inventar un
  precio. Si ninguna zona tiene códigos, queda el desplegable de siempre. Pasa por
  `zonaPorCodigoPostal` (`src/settingsMap.mjs`).
  *Límite:* el costo lo sigue cobrando la base por **nombre de zona**; el código postal sólo
  ayuda a elegirla, así que quien prepara el pedido tiene que mirar que la dirección que pasa el
  cliente corresponda a la zona. Los códigos hay que cargarlos y verificarlos en el panel; el
  código no trae ninguno de fábrica.
- **La ficha de producto** (`/producto/:id`) sigue el estilo de las tiendas de las marcas: precio
  grande con las promos al lado (cuotas sin interés y descuento por transferencia o efectivo,
  `src/promos.mjs`), el envío gratis, color y talle, "¡No te lo pierdas, es el último!" cuando queda
  una unidad, y bloques desplegables de **Medios de pago**, **Medios de envío** y **Descripción**.
  Las promos salen **sólo de lo que el local configuró** (*Configuración → Pagos*): sin cuotas ni
  descuento cargados no aparece ninguna. En *Medios de envío* el cliente escribe su código postal y ve
  el costo y el plazo antes de comprar (`CalculadoraDeEnvio`, la misma cuenta del checkout); la
  zona queda guardada para la bolsa. Las prendas de marca muestran la descripción, el material y la
  tabla de talles de la marca (`FichaDeMarca`).
- **Los cambios se avisan en cada ficha.** Una nota corta (`NotaDeCambios`) con el plazo y las
  condiciones, enlazada a `/devoluciones`. El plazo (`cambioDias`) se carga en *Configuración*.
- **Una zona sin costo cargado no sale gratis.** El checkout dice "a coordinar
  por WhatsApp", que es mejor que inventarle un número al cliente. Con `0`
  dice "sin cargo" y con un número lo cobra.
- **Envío sin cargo desde un monto.** De fábrica, $100.000 (o sea, por encima de $99.999). Se mira contra las
  prendas, sin el envío: si no, el propio envío ayudaría a alcanzar el umbral.
  Con `0`, el envío gratis no existe.
- **El costo lo pone la base.** La cuenta la hace `crear_pedido` al cobrar y
  queda guardada en el pedido, en su propia columna: `total` es lo que paga el
  cliente y `envio` dice cuánto de eso es el envío. El navegador hace la misma
  cuenta sólo para mostrarla, y si la zona no está entre las configuradas el
  servidor rechaza el pedido.
- **Plazo estimado de entrega.** Cada zona tiene un texto de plazo que el
  cliente lee en el checkout al elegirla. Las zonas de Correo Argentino traen el
  de **Paq.ar Clásico**, el servicio que usa el local: *2 a 5 días hábiles*. El
  Correo lo cuenta desde la imposición, o sea desde que le entregan el paquete,
  no desde la compra, así que el checkout dice "desde que despachamos tu
  pedido". Es el rango general del servicio: la tabla del Correo da plazos más
  finos por ciudad, pero no trae Ensenada ni Berisso, y no se inventan. Se
  ajusta por zona desde el panel; dejarlo vacío a propósito no dice ningún
  plazo, y una zona de reparto propio no inventa uno. No hace falta tocar la
  base: el plazo vive dentro de la configuración que ya se guarda.
- **Correo Argentino cotiza por peso y código postal**, así que no hay un
  precio fijo que poner en el código: conviene cotizar en el sitio del Correo y
  cargar un promedio, o dejarlo vacío y cobrarlo al coordinar.

El local está en La Merced 327, Ensenada (CP 1925). Esa dirección también va
en los datos estructurados de `index.html`, que es lo que lee Google.

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

**2. Modo demo (apagado en producción).** Sirve para trabajar o mostrar el panel sin conexión, en tu
computadora: se prende con `VITE_PANEL_DEMO=1` (por ejemplo `VITE_PANEL_DEMO=1 pnpm dev`, o en un archivo
`.env.local`). Abre el panel con una contraseña local pero **no publica nada**: los cambios se guardan en ese
navegador, y el panel lo dice arriba, en la chapita y en el cartel. **En la producción no se define esa variable**:
si el servidor no contesta, el panel dice "sin conexión" y no ofrece otra entrada.

La contraseña del modo demo ya no viene en el código: sale de `VITE_PANEL_DEMO_HASH` y `VITE_PANEL_DEMO_SALT`.
Para generarla:

```sh
node scripts/clave-admin.mjs "la clave"
```

El script imprime las tres variables para pegar en `.env.local`; sin argumento inventa una contraseña y la
muestra. Con el modo demo prendido y sin hash, el panel de demo abre sin contraseña (sólo para desarrollo).

> **Sobre la contraseña de fábrica anterior.** Estuvo escrita en este README y su hash en el código, y sigue en
> el historial de git. Si se usó en algún otro lado, **cambiala ahí**: tomala por pública.

Lo que esto cuida: antes, cualquiera que bajara el sitio tenía el hash para probar contraseñas sin límite. Ahora
la producción no tiene ninguna entrada que no sea el usuario y la contraseña verificados en el servidor, donde
los permisos de la base deciden qué se puede leer y escribir. Los datos de la demo viven en el `localStorage` del
navegador y se leen sin contraseña: la contraseña tapa la pantalla, no los datos.

## Formas de pago

Se prenden y se apagan desde el panel. Lo que quede vacío no se muestra, y el
pedido sigue saliendo por WhatsApp. La forma elegida queda guardada en el
pedido, se ve en el panel y viaja en el mensaje.

Están separadas porque **no cuestan lo mismo ni funcionan igual**, y el panel
lo dice al lado de cada campo:

| Forma | Cómo funciona | Qué le cuesta al local |
|---|---|---|
| **Mercado Pago** | Link de pago (monto fijo) o alias para transferir. | Comisión por venta, y el plazo de acreditación que elijas: cuanto antes querés la plata, más caro sale. El número exacto está en *Tu negocio → Costos* de tu cuenta; cambia, así que no está escrito acá. |
| **Cuenta DNI** | Alias para transferir, o **el QR cargado desde el panel**. | Una transferencia entre cuentas no tiene comisión. El QR de comercio, el que acredita directo, se pide en Banco Provincia dándose de alta como comercio. |
| **Transferencia bancaria** | Alias o CBU. | Sin comisión: lo más barato. Lo más trabajoso de controlar, porque hay que cruzar comprobantes. |
| **Efectivo** | Al retirar en el local. | Nada. |
| **Débito** | Posnet del local, en un pago. | Comisión y plazo del que te dio la terminal. |
| **Crédito** | Posnet del local, con las cuotas que configures. | Comisión, más el costo de financiar. **Las cuotas sin interés las banca el local**: si ofrecés tres, el banco descuenta el costo y cobrás menos. Las cuotas "con interés del banco" no cuestan nada extra al local, pero el cliente paga más. |

**Por qué hay descuento por contado y no recargo por tarjeta.** Cobrar más por
pagar con tarjeta está prohibido: la Ley 25.065 de tarjetas de crédito, en su
artículo 37, obliga al comercio a no hacer diferencias de precio entre
operaciones al contado y con tarjeta, y Defensa del Consumidor labra actas por
eso. La promo por pago en efectivo o transferencia es la forma en que se hace
la misma diferencia. Por eso el campo del panel es un **descuento por
contado**: el sitio muestra el precio de lista, avisa el descuento, y el local
lo aplica al cobrar. Antes de fijar porcentajes conviene pasarlo por el
contador.

**Toda venta necesita factura o ticket**, cobres como cobres. El medio de pago
no cambia eso.

**Sin servidor no se puede cobrar el total exacto de la bolsa de forma
automática.** Un link de pago lleva el monto fijo con el que se creó, así que
sirve para una seña o un precio redondo; para cobrar el importe exacto están el
alias (el cliente transfiere y manda el comprobante) o el cobro en el local. El
checkout de Mercado Pago que arma el cobro solo necesita un servidor que hable
con Mercado Pago, porque el token de la cuenta no puede vivir en el navegador.
El servidor que ya hay guarda el catálogo; no cobra.

Mientras los precios y el stock sean de ejemplo, conviene dejar el link y el
alias vacíos: con uno cargado, un visitante puede pagar de verdad.

## Legales

Lo que la ley argentina le exige a quien vende ropa por internet, y dónde está
cada cosa en el sitio. **Esto es un resumen armado sobre las normas citadas,
no asesoramiento legal**: antes de abrir la tienda de verdad conviene que lo
lea un abogado.

| Qué | Dónde está | De dónde sale |
|---|---|---|
| **Botón de arrepentimiento** | `/arrepentimiento`, enlazado desde el pie de **todas** las pantallas | Disposición 954/2025, que reemplazó a la Resolución 424/2020 |
| **Política de devoluciones y garantía** | `/devoluciones` | Ley 24.240, arts. 34 y 11 |
| **Tabla de medidas corporales** | `/talles`, enlazada desde el pie y desde cada prenda | Ley 27.521 (SUNITI) y Decreto 375/2021 |
| **Términos y condiciones** | `/terminos` | Ley 24.240 · Disposición 377/2026 sobre cláusulas abusivas |
| **Política de privacidad** | `/privacidad` | Ley 25.326 y Decreto 1558/2001 |
| **Quién vende** (nombre, CUIT, domicilio) | pie de todas las pantallas y pie de cada página legal | Ley 24.240, art. 4 |
| **Contacto para consultas y reclamos** | pie y páginas legales | Ley 24.240 |
| **Enlace a Defensa del Consumidor** | pie, en Legales | Ventanilla Federal Única |
| **Precios finales en pesos** | aclarado en el pie y en los términos | Régimen de exhibición de precios |

### Tres decisiones que vale la pena explicar

**El botón de arrepentimiento está en el pie de todo, no adentro de una
página.** La Disposición 954/2025 pide que el link esté *a simple vista, en
lugar destacado y en el primer acceso*, y que usarlo no obligue a registrarse
ni a hacer ningún otro trámite. Por eso es una página propia, el link se llama
exactamente así, y el formulario no pide cuenta ni login.

**Las páginas legales no inventan datos.** Si falta el CUIT o el nombre de
quien vende, la página lo muestra como pendiente, resaltado, en vez de
completarlo con algo verosímil. Un dato legal inventado es peor que uno vacío:
el vacío se nota y se corrige, el inventado se publica.

**Los términos no tienen cláusulas abusivas, y eso fue a propósito.** La
Disposición 377/2026 actualizó el listado de cláusulas prohibidas en contratos
de consumo apuntando especialmente a la contratación digital. En `/terminos`
no hay ninguna que le dé al local el derecho exclusivo de interpretar el
contrato, que lo autorice a modificarlo unilateralmente, que le permita
rescindir sin causa, que limite su responsabilidad por una prenda fallada, o
que haga renunciar al cliente al arrepentimiento o a la garantía. Ninguna de
esas vale, y ponerlas igual es lo que convierte unos términos en un problema.

### Lo que el sistema no puede resolver solo

El panel, en *Configuración*, muestra arriba de todo **qué falta para estar en
condiciones de vender**, con el motivo legal de cada punto. La lista sale de
`faltaParaVender()` en `src/settingsMap.mjs`, que está probada.

Lo que sólo puede cargar el local: el nombre o razón social, el CUIT, el
domicilio, un contacto, y **la tabla de medidas corporales**. Esa última es
la más importante para una tienda de ropa y la única que el sistema no podría
completar ni queriendo: son medidas del cuerpo, y inventarlas es exactamente
lo que la ley de talles vino a evitar.

### Lo que queda fuera de la página

Tener el sitio en orden no alcanza para vender legalmente. Fuera del alcance
de este código quedan la inscripción fiscal, la facturación (ver más abajo),
el etiquetado de las prendas —cada prenda tiene que llevar su talle
identificado con pictograma, y eso pasa en el taller, no en la web— y, si se
guardan datos de clientes en forma de base destinada a dar informes, la
inscripción ante la AAIP.

## Cambios y devoluciones

La tienda publica la política en **`/devoluciones`**, enlazada desde el pie y
desde el checkout. Los números (días, monto, dirección) se cargan desde el
panel.

Están separadas en tres cosas, porque legalmente **no son lo mismo**, y
mezclarlas es como se termina en Defensa del Consumidor:

| | Plazo | Quién paga el envío de vuelta |
|---|---|---|
| **Arrepentimiento** (sin motivo) | 10 días corridos, mínimo legal | **El local, siempre.** No se puede poner monto mínimo ni condiciones. |
| **Prenda fallada** (garantía legal) | 6 meses para prendas nuevas | **El local, siempre.** |
| **Cambio por talle o color** | 30 días corridos desde que se recibe el pedido (configurable, aparte del arrepentimiento), con la prenda sin uso, con etiquetas y en su bolsa original; sujeto a stock; el valor es el que se pagó (la diferencia se abona); no aplica a ropa interior ni medias | **Siempre el cliente** (ida y vuelta, cualquier cambio). El campo "Cambio con envío sin cargo desde" queda en 0; con un monto, el primer cambio de una compra grande lo paga el local. El arrepentimiento y la garantía siguen a cargo del local: lo manda la ley (24.240, art. 34 y 11 a 17) |

El derecho de arrepentimiento está en el artículo 34 de la Ley 24.240 de
Defensa del Consumidor: diez días corridos, y los gastos de devolución a
cargo del vendedor. No se puede renunciar ni condicionar, así que **no hay un
campo en el panel para cambiarlo**: el único umbral configurable es el del
cambio por gusto, que sí es una cortesía del local. El Código Civil y
Comercial lo acompaña en su artículo 1112, y la garantía legal de seis meses
está en el artículo 11 de la misma ley.

La Resolución 424/2020 de la Secretaría de Comercio Interior exige que las
ventas por internet tengan un **botón de arrepentimiento** a la vista, y que
el comercio conteste con un código de identificación dentro de las 24 horas.
El sitio lo tiene arriba de todo en `/devoluciones`: se completa el nombre y
el número de pedido y se abre el mensaje listo para enviar. **Contestar con el
código dentro de las 24 horas es parte de la obligación y lo tiene que hacer
una persona**, no el sitio.

Esto es un resumen hecho sobre las normas citadas, no asesoramiento legal:
antes de publicarlo como política definitiva conviene que lo lea un abogado o
el contador del local.

### Registrar una devolución

En el panel, pestaña *Devoluciones*: se busca el pedido, se marca cuántas
unidades vuelven y el stock se acomoda. Lo importante es la distinción que
hace:

- **Vuelve en buen estado** → vuelve al stock, con un movimiento "Devolución".
- **Vuelve fallada** → deja dos movimientos: entra como "Devolución" y sale
  como "Rotura". El stock no se mueve en limpio y el historial cuenta las dos
  cosas que pasaron de verdad, en vez de una sola a medias.

Si vuelve todo el pedido, queda marcado como **Devuelto**.

## Reportes

Pestaña *Reportes* del panel, con períodos de 7, 30 y 90 días. Todo sale de
datos que el sistema ya guardaba: no hay nada que cargar aparte.

Qué muestra: unidades vendidas, pedidos de la web, facturado, cobrado, ticket
promedio, la plata parada en el perchero, un gráfico de unidades por día, lo
que más se vende, los talles que salen, **lo que conviene reponer** (se
vendió y quedan 5 o menos) y **lo que no se movió** (publicado, con stock y
sin una sola venta, ordenado por cuánta plata tiene dormida).

Tres cosas que el reporte no mezcla, porque mezclarlas da un número lindo y
falso:

- **Unidades ≠ facturación.** "Unidades vendidas" incluye el mostrador;
  "facturado" no. La venta del mostrador se carga para saber el stock y no
  tiene importe, así que sumarla a la facturación sería inventarla.
- **Facturado ≠ cobrado.** Lo segundo es sólo lo que Mercado Pago confirmó.
- **Lo que volvió no se vendió.** Las unidades son netas: descuentan
  devoluciones y cancelaciones. El gráfico por día sí muestra lo bruto, porque
  una devolución de hoy no cambia lo que pasó el martes; por eso la tarjeta
  aclara cuántas volvieron.

Y una advertencia que está también en pantalla: la columna **Valor** de "lo
que más se vende" está calculada al precio de hoy. El historial de movimientos
no guarda a cuánto estaba la prenda cuando se vendió, así que es una
referencia, no la facturación.

La cuenta vive en `src/reportes.mjs`, separada de la pantalla y con pruebas:
un reporte que suma mal es peor que no tener reporte, porque el dueño decide
con eso qué comprar.

## Mail de confirmación

Cuando el cliente deja su mail en el checkout, recibe la confirmación del
pedido con el detalle, el total y cómo sigue. Lo manda la función
`enviar-mail` por SMTP.

**Por SMTP y no con un servicio** porque los servicios tipo Resend piden un
dominio propio verificado, y el sitio vive en vercel.app. Con SMTP se puede
usar el Gmail del local con una contraseña de aplicación: no cuesta nada y no
necesita dominio. El día que haya dominio, se cambian los secretos y listo.

Se configura en Supabase → Edge Functions → Secrets:

| Secreto | Ejemplo |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | el mail del local |
| `SMTP_PASS` | una **contraseña de aplicación**, no la del mail |
| `SMTP_DESDE` | `Zero Indumentaria <elmail@gmail.com>` |

**Un pedido se confirma una sola vez.** Sin ese freno, alguien podría llamar a
la función mil veces con el mismo número de pedido y usarla para bombardear el
mail del cliente. La función anota cuándo mandó y no manda de nuevo.

## Facturación

**No está hecho, y no es una tarde de trabajo.** Esto es lo que hay que saber
antes de decidir:

- La factura electrónica se emite contra los web services de ARCA (ex AFIP), y
  para eso hace falta un **certificado digital** atado al CUIT del local, que
  se tramita en ARCA con clave fiscal nivel 3. Ese certificado y su clave
  privada tienen que vivir del lado del servidor.
- Un monotributista emite **comprobantes clase C**. Desde noviembre de 2026 la
  factura electrónica pasa a ser obligatoria para monotributistas sociales y
  del Monotributo Promovido, y en marzo de 2027 para el resto de los no
  alcanzados por IVA (RG 5893/2026).
- Un error acá no es un bug: es un problema con ARCA. Una factura mal emitida
  hay que anularla con una nota de crédito.

Tres caminos, de menos a más:

1. **Como ahora, asistido.** Emitir desde *Comprobantes en línea* de ARCA, que
   es gratuito, y anotar el número de comprobante en el pedido. Cuesta cero y
   no tiene riesgo fiscal. Para el volumen de un local chico, alcanza.
2. **Con un servicio de terceros** (Facturante, TusFacturasAPP y parecidos).
   Es lo más rápido de integrar, pero son **pagos por mes**, y eso iba en
   contra de no gastar de más.
3. **Contra ARCA directo.** Sin costo mensual, pero es el trabajo más grande de
   todo lo que tiene el sistema: autenticación con certificado, el web service
   de facturación, numeración de puntos de venta, y manejo de errores que
   tienen consecuencias fiscales.

Mi recomendación: dejarlo en el camino 1 hasta que el volumen justifique el
3. Si en algún momento se hace, conviene que lo mire el contador del local
antes de emitir la primera factura de verdad.

## Alcance de la demo

El catálogo, el stock, el historial y los pedidos cargados desde el panel
viven en el servidor. Lo que queda en `localStorage` (`mistral-local-demo-v1`)
es la bolsa, los favoritos, los pedidos hechos desde la tienda y todo lo que
se edite en modo demo.

El cobro online y el mail de confirmación requieren los secretos del local en
Supabase. Mientras no estén configurados, siguen disponibles las formas de
pago y contacto configuradas para coordinar el pedido.

Precios, imágenes y talles cargados hoy en el servidor vienen del catálogo
nacional como referencia; **el stock es ficticio** hasta que el dueño cargue
el suyo desde el panel. Las direcciones, los horarios, las condiciones de entrega y los medios de pago deben confirmarse con el dueño. No se inventaron direcciones locales.

Para reiniciar la demo, borrar los datos de este sitio en el navegador. No ingresar datos personales reales durante la presentación.

## Publicación (Cloudflare Pages o Vercel)

El código vive en [`FrancoMalacalza01/zero-indumentaria-ensenada`](https://github.com/FrancoMalacalza01/zero-indumentaria-ensenada), un repositorio **privado de la cuenta personal** de GitHub del dueño (antes estaba en la organización `Solia-laplata`, que quedó como archivo). Dos formas de publicarlo:

**Cloudflare Pages (gratis y permite uso comercial; recomendado).** En dash.cloudflare.com: *Workers & Pages → Create → Pages → Connect to Git*, elegir el repo (hay que darle acceso a la app de Cloudflare a ese repo), comando de build `pnpm build`, carpeta de salida `dist`. Cada merge a `main` publica la producción y cada rama tiene su vista previa. Las cabeceras de seguridad salen de `public/_headers`, y las rutas del sitio (`/admin`, `/producto/…`) las resuelve Pages solo mientras **no exista `public/404.html`** (modo SPA).

**Vercel.** Importar el repo, raíz, preset **Vite**; `vercel.json` trae el comando de build, la salida `dist`, las rutas y las cabeceras. Ojo con el plan: el gratis (Hobby) es sólo para uso no comercial, así que para vender hace falta Pro. (Con el repo en una organización, además, ni siquiera deja importarlo.)

En los dos casos el servidor Supabase puede configurarse con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`, o con las claves públicas de respaldo en `src/server.ts` (no hace falta ninguna variable). **`vercel.json` y `public/_headers` dicen lo mismo y `tests/despliegue.test.mjs` lo comprueba**: la CSP permite hablar con Supabase y con Payway (el navegador manda la tarjeta directo a Payway), y nada más.

El sitio queda fuera de los buscadores con `noindex,nofollow` y
`public/robots.txt` mientras los precios y el inventario de Zero estén
pendientes de confirmar. Se retiraron las URL canónicas y los datos de negocio
que apuntaban a un despliegue anterior. Al publicar en un dominio propio,
completar esos datos con información confirmada del local.

## Validación

`pnpm test` ejecuta 310 pruebas, todas sin navegador ni red:

| Archivo | Qué cubre | |
|---|---|---|
| `commerce.test.mjs` | la transacción de compra: inventario por talle, duplicados, stock insuficiente, productos ocultos o eliminados, cantidades inválidas y conservación del estado al rechazar una operación | 19 |
| `serverSync.test.mjs` | lo que se le manda al servidor: que un producto, un movimiento y un pedido vayan y vuelvan iguales, que los valores que la base no acepta se corten antes de salir, que un talle con coma no parta el filtro de borrado y que se guarde el origen y la marca | 21 |
| `reportes.test.mjs` | las cuentas de los reportes: los días en hora argentina (una venta de las 22 es de hoy, no de mañana), lo que volvió descontado de lo vendido, los cancelados fuera de la facturación, y qué conviene reponer | 17 |
| `catalogMap.test.mjs` | lo que llega del servidor: filas incompletas, columnas en `null`, cantidades basura | 10 |
| `menOverrides.test.mjs` | precios propios y bajas del catálogo de hombre: una baja conserva el precio puesto, una prenda vuelta a fábrica pierde su excepción, el precio se lee como se escribe (`32.900`) pero no se adivina (centavos, ceros, basura), y avisa un cambio de -90%; y las ofertas: el precio anterior sólo existe si es mayor al precio, terminar una oferta, que cambiar el precio la termine sólo si alcanza al anterior, y que ida y vuelta con el servidor dé lo mismo | 23 |
| `importarCatalogo.test.mjs` | preparación de fichas importadas: fotos, ajustes, stock sin inventar unidades y visibilidad de fichas administradas y productos nuevos | 12 |
| `paginar.test.mjs` | consulta todas las páginas de productos y stock y rechaza respuestas inválidas | 2 |
| `modelos.test.mjs` | qué prendas son el mismo modelo: el nombre sin el código del final (`Remera Blank MC - 10206-5` es `Remera Blank MC`), sin confundir un guion del nombre, que cuente la tienda y el catálogo de hombre, la vista previa de todas las versiones, fin de ofertas y coincidencia con el precio de marca | 9 |
| `ordenProductos.test.mjs` | el orden por precio de las prendas de hombre: menor a mayor y al revés, que con precios iguales se conserve el orden del catálogo, que una prenda sin precio válido vaya al final y que no se modifique la lista original | 5 |
| `priceTools.test.mjs` | las cuentas de los cambios de precio: cada operación y su redondeo (terminado en 900 incluido), que una regla imposible (bajar 100%, restar más de lo que cuesta) avise y no deje un precio en cero, la vista previa, que deshacer devuelva todo exactamente como estaba (tienda y hombre), el tope del historial y que el CSV no deje colar fórmulas; y las ofertas: que repetir una no acumule descuentos, que un redondeo que se come el descuento avise, y que terminar o deshacer una oferta devuelva tienda y hombre exactamente como estaban | 36 |
| `whatsapp.test.mjs` | el enlace de consulta por WhatsApp: el mensaje con tildes, saltos de línea y símbolos que romperían una URL, que un número inválido no dé enlace (no manda al cliente a un desconocido) y que falte la marca o el precio no rompa el mensaje; y que una prenda en oferta diga de cuánto era | 9 |
| `settingsMap.test.mjs` | la configuración del local: una config vacía o con basura no puede dejar la tienda sin zonas, el costo del envío, los topes que no se pueden bajar (los 10 días de la ley) y **qué falta para estar en condiciones de vender**, con su motivo legal; y el plazo de entrega: el de Paq.ar Clásico de fábrica en las zonas de Correo, el vacío a propósito que se respeta, la basura que se ignora y la frase que lee el cliente; y las horas para que venza un pedido sin pagar (48 de fábrica, 0 = nunca, con tope); y las localidades del envío (nombre y código de 4 dígitos, sin repetir ni basura) | 40 |
| `tablasTalle.test.mjs` | qué tabla de talles se muestra en cada prenda de hombre: las medidas de la ficha de esa prenda (Mistral o Brooksfield), la imagen general de Brooksfield por tipo de prenda (y la de jeans por nombre) cuando la ficha no trae medidas, la tabla de referencia (con aviso) para lo que no tiene la suya, incluidas las prendas de Mistral sin medidas, que sin tabla equivalente no se invente una, y que las imágenes existan | 11 |
| `detallesPrenda.test.mjs` | lo que cuenta la marca de una prenda (material, color, características y cuidados): que se junte bien, que la composición no se repita, que sin ficha igual se muestre el color, que los párrafos de la marca salgan tal cual, que los renglones repetidos salgan una vez y que los textos rotos se descarten | 6 |
| `payway.test.mjs` | las cuentas y reglas del cobro con tarjeta por Payway: el número de tarjeta y el vencimiento, que la tarjeta sólo viaje a una dirección https de Payway, el identificador de cada operación, el importe en centavos, el cuerpo exacto de `/payments`, los medios permitidos cómo se interpreta la respuesta (aprobado, rechazado con su motivo, y que un estado raro nunca se dé por pagado) y la anulación (el id del pago sale de `pago_ref`, la dirección de `/refunds` y que sólo un estado de anulado confirmado cuente) | 17 |
| `codigoDePago.test.mjs` | el código de pago del pedido: que abra sólo con el código exacto y que un pedido sin código, vacío, en mayúsculas, de otro largo o de otro tipo no abra nunca; y que el monto de Mercado Pago coincida con el del pedido al centavo | 3 |
| `ofertas.test.mjs` | las ofertas con fecha de fin: el último segundo del día elegido en hora de Argentina, qué fechas se rechazan, que una oferta vencida vuelva al precio de antes (en la tienda, en los precios propios de hombre y en los precios en masa), que una sin fecha o con fecha ilegible nunca venza, y que el vencimiento se guarde, se borre y se restaure al deshacer | 17 |
| `codigoPostal.test.mjs` | el envío por código postal: cómo se lee lo que escribe el cliente (`1925`, `B1925`, `B1925ABC`), la lista de códigos de una zona (sueltos y rangos, lo ilegible se ignora), que cada código caiga en su zona y gane la primera si dos lo cubren, que uno no cubierto no tenga zona y que sólo se pida el código si el local cargó alguno | 6 |
| `promos.test.mjs` | las promos junto al precio en la ficha: cuotas sin interés (precio dividido, sólo con tarjeta de crédito y más de una cuota), descuento por transferencia o efectivo (sólo si hay un medio que lo admita), que sin nada configurado no se muestre ninguna y el texto del envío gratis | 7 |
| `despliegue.test.mjs` | que las cabeceras de `public/_headers` (Cloudflare Pages) digan lo mismo que `vercel.json`, que la CSP deje hablar sólo con Supabase y Payway, que no exista un `public/404.html` (rompería las rutas del sitio en Cloudflare) y que los assets con hash se cacheen | 4 |
| `pedidosActivos.test.mjs` | qué pedidos cuentan como activos en el menú y el Resumen del panel (pendiente, preparando, listo para retirar) y que lo cancelado o devuelto no sume ni como pedido activo ni como venta | 5 |
| `mostrarMas.test.mjs` | las listas largas del panel "de a 50": se muestran los primeros 50, se avisa cuántos faltan, "mostrar más" suma de a 50 y una lista corta no muestra el botón | 4 |
| `storefront.test.mjs` | qué se publica en la tienda: sólo prendas de hombre publicadas; Accesorios, categorías desconocidas, productos sin publicar y datos rotos no se muestran ni rompen nada | 6 |
| `migrate.test.mjs` | la conversión de una demo guardada con la forma vieja (stock por sucursal) a la actual | 8 |

`pnpm build` comprueba TypeScript y genera el paquete de producción.

El login, la publicación y la compra se probaron además **en un navegador
real**, contra un servidor que habla el mismo protocolo que Supabase y con los
headers de producción puestos. 111 comprobaciones en cinco tandas:

- *Panel* (20): contraseña mal puesta, cuenta sin permiso, entrada del dueño,
  publicar y ocultar, venta del mostrador bajando stock y dejando movimiento,
  barrido de talles viejos, sesión que sobrevive a recargar, cierre de sesión,
  un guardado rechazado por el servidor mostrando el cartel rojo.
- *Compra* (16): la compra que entra, el total calculado por el servidor, dos
  navegadores peleando por la última prenda (el segundo rebota con el motivo
  exacto y el stock queda en cero, no en negativo), una compra sin conexión que
  avisa en vez de festejar y no descuenta nada, y el pedido apareciendo en el
  panel del dueño.

Ninguna llamada bloqueada por la CSP en ninguna de las dos.

`./db/probar-local.sh` levanta un Postgres de juguete, arma la base con esos
dos archivos y larga **diez compradores al mismo tiempo contra cuatro
unidades**. Tienen que comprar cuatro y rebotar seis, con el stock en cero y
no en negativo. Es la única forma de probar de verdad el caso de dos personas
comprando lo último, porque hacen falta dos conexiones a la vez. Probado
también a mano: con el primer comprador reteniendo la traba tres segundos, el
segundo esperó exactamente esos segundos y recién entonces rebotó, leyendo lo
que había quedado.

La función de la compra se probó además **contra la base de producción**, en
transacciones que se deshacen: compra normal, precio y nombre falsificados
desde el navegador, renglones repetidos que se suman, pedir más de lo que hay,
producto despublicado, producto y talle inexistentes, bolsa vacía, entrega y
forma de pago inventadas, cantidades en cero, negativas, con coma, absurdas y
que no son números, 41 renglones, nombre de 300 letras, el tope de 50 unidades
y el freno de diez pedidos por minuto. En todos los rechazos se comprobó que
el stock quedó como estaba.

## Imágenes y referencias

Logo: Zero Indumentaria, aportado por el dueño. Fotografías de las marcas
[Mistral Argentina](https://www.mistral.com.ar/) y
[Brooksfield](https://www.brooksfieldstore.com/). Contacto local:
[@mistral.zero.indumentaria](https://www.instagram.com/mistral.zero.indumentaria/).
La procedencia de las fotos previas está en `docs/asset-sources.json`; su uso
en una tienda pública debe estar autorizado por las marcas.

El relevamiento de `/hombre` se genera con `scripts/scrape-men.py` a partir de
las páginas públicas de [Mistral Hombre](https://www.mistral.com.ar/hombre/)
y [Brooksfield Hombre](https://www.brooksfieldstore.com/3-hombre-brooksfield).
Sus fichas, categorías, precios y enlaces de origen a todas las fotos observadas
están en `src/men-catalog.json`; una portada optimizada por ficha está en
`public/men-images` y todas las fotos de las galerías en `public/men-gallery`.
El catálogo
de Hombre aún no se mezcla con los productos publicados en Supabase ni permite
comprar o consultar stock, porque faltan los precios y existencias propios de
Zero. Para regenerarlo hacen falta Python, `lxml` y
`Pillow`: primero ejecutar `scripts/scrape-men.py` y luego
`scripts/download-men-covers.py` y `scripts/download-men-gallery.py`.

Las tres funciones del servidor están **desplegadas y probadas**: contestan y
avisan qué les falta. Lo que falta para que cobren y manden mails son los
secretos, que son del local y nadie más puede cargar: el token de Mercado Pago
y las credenciales del correo.

Falta el catálogo real del local y los datos que sólo el dueño puede dar:
el WhatsApp, los alias de pago, el QR de Cuenta DNI, los horarios y los costos
de envío por zona. Todo eso se carga desde el panel. Cobrar dentro del sitio
requiere un servidor que hable con Mercado Pago.

### Normas citadas

Las reglas de devoluciones y de formas de pago que el sitio publica salen de
estas normas. Son la base del resumen de arriba; para una política definitiva
conviene que las lea un abogado.

- Ley 24.240 de Defensa del Consumidor, art. 34 (revocación, diez días
  corridos, gastos de devolución a cargo del vendedor) y art. 11 (garantía
  legal, seis meses para bienes nuevos).
- Código Civil y Comercial, art. 1112 (cómo se notifica la revocación).
- Resolución 424/2020 de la Secretaría de Comercio Interior (botón de
  arrepentimiento y código de identificación dentro de las 24 horas) —
  [resumen](https://ligadelconsorcista.org/consumidores-boton-de-arrepentimiento-reolucion-424-2020).
- Ley 25.065 de Tarjetas de Crédito, art. 37 inc. c (no hacer diferencias de
  precio entre operaciones al contado y con tarjeta) —
  [nota](https://www.cronista.com/informacion-gral/cambian-las-compras-en-el-supermercado-la-ley-n-25065-que-prohibe-la-avivada-mas-comun-cuando-pagas/),
  y [actas de Defensa del Consumidor por cobrar recargos](https://consumidorsalta.gob.ar/defensa-del-consumidor-infracciono-a-dos-comercios-por-cobrar-recargos-indebidos-en-pagos-con-tarjeta-de-credito/).
- Tarifas de Correo Argentino: dependen del peso, las medidas y el código
  postal, así que no hay un número fijo para poner en el código. Se cotizan en
  el sitio del Correo ([encomienda clásica](https://www.correoargentino.com.ar/servicios/paqueteria/encomienda-correo-clasica)).

### Catálogo importado editable

Los artículos de hombre aparecen en **Productos y stock**. Al editar por primera
vez uno importado se crea su ficha administrada: conserva su nombre, marca,
sección, colores, fotos y ajustes de precio, pero sus cantidades empiezan en
cero. Los talles importados sólo son sugerencias; el local debe revisarlos y
cargar sus propias cantidades. Si una ficha no trae talles o color, el editor
pide completarlos. La ficha importada no se puede borrar: se puede ocultar.
Las prendas con stock tienen un enlace a la ficha de compra. Los productos
nuevos se crean con **Nuevo producto**.

Antes de publicar este cambio, una persona debe revisar y ejecutar
`db/catalogo-editable.sql` en el SQL Editor de Supabase, y comprobar que las
filas de `db/verificar-catalogo-editable.sql` devuelvan `true`. Sin ese paso la
nueva consulta de prendas ocultas falla y el catálogo de hombre no se muestra,
para no volver a publicar prendas ocultadas. El SQL no importa los productos ni
escribe stock. Al guardar stock, el servidor comprueba que no haya cambiado
desde que se abrió el editor; si hubo una compra, rechaza el cambio y pide
recargar para evitar sobrescribir unidades vendidas. El ensayo de permisos está en `db/probar-catalogo-editable.sql`
y forma parte de `db/probar-local.sh`.
La prueba de navegador `tests/catalogo-navegador.cjs` usa una base simulada y
bloquea las conexiones externas: levantá `pnpm dev --host 127.0.0.1 --port 5174`
y ejecutá `node tests/catalogo-navegador.cjs`. Usa el Chromium de Playwright o,
si hace falta, la ruta indicada en `CHROME_PATH`.

### Textos legales (términos, privacidad, cambios)

Las tres páginas (`/terminos`, `/privacidad`, `/devoluciones`) se armaron sobre los textos de las marcas con las que se
trabaja, **adaptados a los datos del local** (razón social, CUIT, domicilio, mail y WhatsApp salen de *Configuración*; si
falta uno, la página lo dice en vez de inventarlo). Dos decisiones que conviene saber:

- **Devoluciones a cargo del cliente, con un límite legal.** El envío de los cambios por talle o color es siempre del
  cliente. El arrepentimiento (10 días) y la garantía legal (6 meses) **no**: la ley obliga a que el vendedor pague el
  envío de vuelta y una cláusula en contrario no vale (y puede traer problemas con Defensa del Consumidor).
- **Privacidad: plazos de la Ley 25.326.** El acceso a los datos se responde en 10 días corridos y la corrección o baja
  en 5 días hábiles (art. 14 y 16). Se dejaron afuera cláusulas de otros textos que no corresponden: compartir datos con
  empresas de "evaluación de conductas", no retener la información por ningún plazo y deslindar toda responsabilidad.

Son un punto de partida, **no asesoramiento legal**: antes de abrir la tienda de verdad conviene que los lea un abogado o
contador.
