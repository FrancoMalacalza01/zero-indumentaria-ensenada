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
## Configuración del local

Esto antes vivía en el código y había que tocar archivos y volver a publicar
el sitio para cambiar un alias. Ahora se carga **desde el panel**, en
*Configuración*, y vive en el servidor: el WhatsApp, la dirección y los
horarios, las formas de pago, las zonas de envío y la política de
devoluciones.

Si el servidor no contesta, la tienda usa los valores de fábrica. Una
configuración a medias no puede dejar la tienda sin zonas ni sin dirección:
lo que no se entiende se reemplaza por el valor de fábrica, prenda por prenda.

**Nada de secretos acá.** La tabla `settings` se lee pública, porque la tienda
tiene que mostrar los alias y las zonas. Es lo mismo que le darías a un cliente
por WhatsApp.

## Envíos

Zonas de fábrica: **Ensenada, Berisso, La Plata y el resto de la Provincia de
Buenos Aires**. Se agregan y se sacan desde el panel; cada una tiene nombre,
costo y si va por reparto propio o por Correo Argentino.

- **Una zona sin costo cargado no sale gratis.** El checkout dice "a coordinar
  por WhatsApp", que es mejor que inventarle un número al cliente. Con `0`
  dice "sin cargo" y con un número lo cobra.
- **Envío sin cargo desde un monto.** De fábrica, $99.999. Se mira contra las
  prendas, sin el envío: si no, el propio envío ayudaría a alcanzar el umbral.
  Con `0`, el envío gratis no existe.
- **El costo lo pone la base.** La cuenta la hace `crear_pedido` al cobrar y
  queda guardada en el pedido, en su propia columna: `total` es lo que paga el
  cliente y `envio` dice cuánto de eso es el envío. El navegador hace la misma
  cuenta sólo para mostrarla, y si la zona no está entre las configuradas el
  servidor rechaza el pedido.
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
| **Cambio por talle o color** | El que el local decida | El cliente, salvo que la compra pase el monto configurado (de fábrica, $99.999). |

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
| `SMTP_DESDE` | `Mistral Ensenada <elmail@gmail.com>` |

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

Lo que el sitio **no** hace: cobrar (las formas de pago son un link y unos
datos para transferir; el sitio no cobra) ni mandar correos.

Precios, imágenes y talles cargados hoy en el servidor vienen del catálogo
nacional como referencia; **el stock es ficticio** hasta que el dueño cargue
el suyo desde el panel. Las direcciones, los horarios, las condiciones de entrega y los medios de pago deben confirmarse con el dueño. No se inventaron direcciones locales.

Para reiniciar la demo, borrar los datos de este sitio en el navegador. No ingresar datos personales reales durante la presentación.

## Publicación en Vercel

El proyecto es [`mistral-la-plata`](https://vercel.com/frannn-m/mistral-la-plata), conectado a `FrancoMalacalza01/Mistral-la-plata`. Producción: https://mistral-la-plata-lime.vercel.app/ (sale de `main`). Para rearmarlo: importar `FrancoMalacalza01/Mistral-la-plata`, usar la raíz del repositorio, preset **Vite**, comando `pnpm build` y salida `dist`. `vercel.json` ya configura el frontend y las rutas de la aplicación. No requiere variables de entorno.

El sitio es indexable: el `noindex,nofollow` se sacó al agregar el SEO local. `public/robots.txt` pide no indexar `/admin`, lo que no constituye control de acceso. Para volver a esconderlo de los buscadores, agregar `<meta name="robots" content="noindex,nofollow" />` en `index.html`. Conviene hacerlo mientras el catálogo sea de ejemplo y no esté confirmado el uso del nombre y las fotos de Mistral.

## Validación

`pnpm test` ejecuta 103 pruebas, todas sin navegador ni red:

| Archivo | Qué cubre | |
|---|---|---|
| `commerce.test.mjs` | la transacción de compra: inventario por talle, duplicados, stock insuficiente, productos ocultos o eliminados, cantidades inválidas y conservación del estado al rechazar una operación | 19 |
| `serverSync.test.mjs` | lo que se le manda al servidor: que un producto, un movimiento y un pedido vayan y vuelvan iguales, que los valores que la base no acepta se corten antes de salir, y que un talle con coma no parta el filtro de borrado | 20 |
| `reportes.test.mjs` | las cuentas de los reportes: los días en hora argentina (una venta de las 22 es de hoy, no de mañana), lo que volvió descontado de lo vendido, los cancelados fuera de la facturación, y qué conviene reponer | 17 |
| `catalogMap.test.mjs` | lo que llega del servidor: filas incompletas, columnas en `null`, cantidades basura | 10 |
| `settingsMap.test.mjs` | la configuración del local: una config vacía o con basura no puede dejar la tienda sin zonas, el costo del envío, los topes que no se pueden bajar (los 10 días de la ley) y **qué falta para estar en condiciones de vender**, con su motivo legal | 23 |
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

Marca y fotografías: [Mistral Argentina](https://www.mistral.com.ar/). Contacto local: [@mistral.zero.indumentaria](https://www.instagram.com/mistral.zero.indumentaria/). La procedencia detallada está en `docs/asset-sources.json`; las fotos usadas están en `public/images`. Su uso aquí es para la presentación del prototipo; confirmar con la marca el uso en la tienda final.

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
