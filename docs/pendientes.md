# Pendientes del proyecto

Esto está escrito para que lo lea una persona o una IA (Claude, ChatGPT) que llega
sin contexto y tiene que saber **qué está hecho, qué falta y cómo pedirlo**.

Estado al **30/10/2026**. Antes de actuar sobre algo, comprobalo: `git log` y los
pull requests abiertos dicen más que este archivo si pasaron días.

## Cómo usarlo con tu IA

1. Abrí la IA en la carpeta del repo.
2. Pedile una tarea por vez, con este formato (cambiá el número):

   > Leé `AGENTS.md` y `docs/pendientes.md`. Hacé la **Tarea 3**, en una rama
   > nueva desde `main`, y abrí un pull request.

3. Las reglas de `AGENTS.md` valen igual para ella: una rama por tema, nada
   directo a `main`, y **la base de producción la toca una persona**: ninguna IA
   aplica cambios a Supabase sin que se lo pidas en ese momento.

Cada tarea dice **por qué**, **qué hacer**, **dónde**, **cuándo está lista** y el
**ojo** que hay que tener. Las del bloque A son de datos del local y no se
resuelven con código.

---

## Lo que ya está hecho (no lo rehagas)

| | Dónde |
|---|---|
| Pestaña **Precios** del panel: todos los artículos en una tabla, edición en la celda (Enter guarda y baja), cambios en bloque con vista previa y redondeo, deshacer/rehacer, orden, filtros, exportar CSV, tarjetas en el celular | `src/AdminPrecios.tsx` |
| **Ofertas**: precio rebajado con el anterior tachado y etiqueta de descuento, poner y terminar en la fila o en bloque | `src/AdminPrecios.tsx`, `src/priceTools.mjs` |
| Las cuentas (porcentajes, redondeo, historial de deshacer, CSV) | `src/priceTools.mjs` (pura, con pruebas) |
| Precios propios y bajas del catálogo de hombre | `src/menOverrides.mjs`, tabla `catalog_overrides` |
| Productos de la base: validación del precio, aviso de cambios grandes, **Dar de baja** | `src/Admin.tsx` (`ProductEditor`, `darDeBaja`) |
| Tabla de medidas: `faltaParaVender()` exige al menos una medida real | `src/settingsMap.mjs` |
| Botón **Consultar por WhatsApp** en las prendas de hombre | `src/whatsapp.mjs`, `src/MenCatalog.tsx` |
| **Plazo de entrega** por zona (Paq.ar Clásico: 2 a 5 días hábiles) | `src/settingsMap.mjs`, checkout en `src/App.tsx` |
| Chequeo automático en cada PR (`pnpm test` y `pnpm build`) | `.github/workflows/pruebas.yml` |
| Prueba del SQL de ajustes en un Postgres local, y verificador de solo lectura | `db/probar-ajustes.sh`, `db/verificar-ajustes-catalogo.sql` |

Además, ya en `main`:

| | Dónde |
|---|---|
| Tienda con **solo New in y Hombre** (Accesorios queda en la base y el panel, pero no se publica; la ropa de mujer se sacó del todo, ver `db/sin-mujer.sql`). Para reactivar una categoría: `CATEGORIAS_EN_TIENDA` | `src/storefront.mjs` |
| **Orden por precio** (menor a mayor, mayor a menor) en `/hombre` y en la colección de la portada | `src/ordenProductos.mjs`, `src/MenCatalog.tsx` |
| Logo sin el texto "ENSENADA" debajo; las ofertas del catálogo de hombre conservan el precio anterior al recargar | `src/App.tsx`, `src/server.ts` |

Los pull requests que traen todo esto: **#2** (Precios, ofertas, medidas, reglas),
**#3** (plazo de envío), **#4** (botón de WhatsApp), **#5** (solo New in y
Hombre), **#6** (logo y ofertas al recargar), **#7** (orden por precio) y **#8** (precio por
modelo). Franco
los mergeó sin que los revisara la otra persona: conviene que los mires.

**#8** (ya mergeado) — un precio u oferta nuevo llega a todas las versiones del
mismo modelo: la *Remera Blank MC* de la tienda y sus 14 colores en `/hombre`
eran filas separadas y no se enteraban una de la otra. Hay una casilla en la
pestaña Precios para apagarlo; la lógica está en `src/modelos.mjs`.

**#10 y #11 (30/10/2026, de Juan) — ya mergeados.** El #10 corrige los cambios y
ofertas por modelo (la vista previa incluye todas las versiones y terminar una
oferta restaura cada una). El #11 deja **administrar y vender el catálogo
importado**: las fichas importadas aparecen en *Productos y stock* para editar
nombre, marca, categoría, descripción, fotos, precio y stock por talle, y se
pueden agregar productos nuevos. Una ficha importada no trae stock inventado:
hay que cargar las unidades reales para que se pueda comprar. Guardar ficha y
stock va en una sola transacción que rechaza un stock viejo (si alguien compró
mientras editabas). Lógica en `src/importarCatalogo.mjs`; SQL en
`db/catalogo-editable.sql`.

**Base de datos, hecho el 29/10/2026:**

- Se aplicó `db/ajustes-catalogo.sql` (Tarea 0) y las 9 comprobaciones del
  verificador dan `true`.
- **30/10:** se aplicó `db/catalogo-editable.sql` (columnas `brand` y
  `source_catalog_id`, índice único, `catalogo_importado_oculto()` y
  `guardar_producto_con_stock()`); las 7 filas de
  `db/verificar-catalogo-editable.sql` dan `true`. Antes se probó en un Postgres
  local: diez compradores a la vez por 4 unidades dieron 4 ventas, y 40 rondas de
  guardar una ficha mientras alguien compra no perdieron ninguna venta.
- Se arregló el login del admin. La cuenta `admin@mistralensenada.com.ar` tenía
  vacíos `confirmation_token`, `recovery_token`, `email_change` y
  `email_change_token_new` en `auth.users`, y Supabase respondía **500** al
  iniciar sesión (el panel se quedaba en modo local y los cambios no se
  guardaban). Se completaron con texto vacío. Si se crea otro admin con SQL,
  hay que cuidar eso: lo normal es crearlo desde *Authentication* en Supabase.

---

## Tarea 0 · Aplicar el SQL del catálogo de hombre — **HECHA el 29/10/2026**

> Ya está aplicada y verificada (9 de 9 en `true`). Lo que sigue es por si hace
> falta repetirla en otra base.

**Por qué.** Los precios propios, las bajas y las ofertas del catálogo de hombre
se guardan en una tabla nueva, `catalog_overrides`. Mientras no exista, el panel
muestra los cambios en pantalla pero **no se guardan en el servidor** y avisa.
Los 12 productos de la tienda no dependen de esta tabla.

**Qué hacer.** Correr `db/ajustes-catalogo.sql` en la base de Supabase, proyecto
**`mistral-ensenada`**. Solo agrega esa tabla: no toca nada existente, y se puede
correr más de una vez (también sobre una versión anterior de la tabla). Es seguro
aplicarlo antes de mergear el código: nadie la usa hasta que se publique.

Dos formas, la que ande:

- **SQL Editor de Supabase** (la que no falla): abrir el proyecto, *SQL Editor*,
  pegar el contenido del archivo, *Run*. Tiene que decir *Success*.
- **Con una IA que tenga el conector de Supabase**: pedirle "aplicá
  `db/ajustes-catalogo.sql` en `mistral-ensenada`". La herramienta muestra una
  **pregunta de confirmación en la pantalla de quien la usa** y espera 60
  segundos: si no se contesta a tiempo, se cancela sola y no se aplica nada. Hay
  que tener la pantalla a la vista y aceptar.

**Cómo saber que está lista.** Correr `db/verificar-ajustes-catalogo.sql`
(solo lee): las **9 filas** tienen que decir `ok = true`. Si alguna dice `false`,
la columna `chequeo` dice qué falta; lo normal es volver a correr el SQL.

**Ojo.** Este SQL está probado en un Postgres local con
`./db/probar-ajustes.sh` (necesita PostgreSQL instalado; no toca la base real).
Prueba tres situaciones (tabla nueva, tabla ya existente y tabla de la versión
anterior, sin perder filas), las reglas de acceso (los visitantes leen y no
escriben; una cuenta que no es admin tampoco; el admin sí) y las reglas de las
ofertas, y comprueba que el verificador marque falta cuando falta la tabla. Si
cambiás ese SQL, corré ese script antes de pedirle a nadie que lo aplique.

---

## A · Datos del local (los carga el dueño en el panel)

Estos puntos **impiden abrir la tienda de verdad** y no son código. En el panel,
*Configuración*, aparece la lista con el motivo legal de cada uno
(`faltaParaVender()`). Al 28/10 estaban vacíos:

- **CUIT** y el **mail de contacto**.
- **WhatsApp**, con código de país y sin el "+" (ej. `5492211234567`). Además de
  ser un contacto obligatorio, **activa el botón "Consultar por WhatsApp"**: sin
  número no se muestra. Hoy el checkout dice "costo a coordinar por WhatsApp" y
  no hay a qué número escribir.
- **Horarios** del local.
- **Tabla de medidas corporales** (S a XXXXL vienen sin medidas). Son medidas del
  cuerpo: no se inventan (Ley 27.521).
- **Alias de pago**: el de Mercado Pago y el del banco.

Y dos decisiones:

- **Qué proyecto de Vercel es el de producción.** Hoy publica el de Juan
  (`zero-indumentaria-ensenada`, su cuenta). El de la otra cuenta
  (`mistral-la-plata`) no está conectado a este repo: Vercel no deja conectar un
  repo **privado de una organización** en el plan Hobby. Tiene que salir de uno
  solo.
- **Cuándo sacar el `noindex`** de `index.html` y `public/robots.txt`: mientras el
  catálogo no tenga precios reales, Google no debería indexarlo.

También: los secretos de las funciones (`MP_ACCESS_TOKEN`, `SMTP_*`, `SITIO_URL`)
viven en Supabase, no en Vercel. Desde el repo no se puede ver cuáles están
cargados; hay que mirarlos en Supabase (*Edge Functions*, *Secrets*) antes de
cobrar de verdad.

---

## B · Tareas de código

### Tarea 1 · Prueba automática del panel en cada PR

**Por qué.** Hoy el chequeo de GitHub corre las pruebas de lógica y el build, pero
**nadie prueba el panel en un navegador**. Con dos personas y dos IA cambiando
el mismo código, es lo que evita romper la pestaña de precios sin darse cuenta.

**Qué hacer.** Agregar pruebas de navegador con Playwright (ya es una
dependencia de desarrollo) y sumarlas al workflow `.github/workflows/pruebas.yml`.

**Cómo probar sin tocar nada real** (así se hizo a mano):
- Levantar el sitio construido con `pnpm build` y `pnpm exec vite preview`.
- **Bloquear Supabase** con `page.route("**/*.supabase.co/**", r => r.abort())`.
  Así el panel entra en modo demo y todo queda en el navegador.
- Entrar al panel: poner `sessionStorage["mistral-admin-unlocked"] = "1"` antes de
  cargar `/admin` (con `addInitScript`), y enviar el formulario de login con
  cualquier usuario y contraseña. Sin servidor, la puerta abre en modo demo.
- Para simular un WhatsApp cargado, responder a `/rest/v1/settings` con
  `[{ "datos": { "whatsapp": "5492211234567" } }]`.
- Ojo: en los datos de demostración el talle M del producto 1 no tiene stock;
  para comprar en el checkout hay que elegir otro.

**Qué cubrir** (son los recorridos que se probaron a mano):
- *Precios*: Enter guarda y baja a la fila siguiente; Tab, ↓, Esc y clic afuera;
  un precio inválido (`12,5`) se rechaza en la celda; el aviso de un cambio de
  -90%; deshacer y rehacer con botones y con Ctrl+Z.
- *Cambios en bloque*: vista previa antes de aplicar, subir 10% con redondeo a
  900 sobre 3 artículos, **un solo Deshacer** los revierte, "bajar 100%" se rechaza.
- *Ofertas*: poner en oferta desde la fila, repetir **no acumula** descuentos,
  un redondeo que se come el descuento avisa, terminar la oferta, y que la tienda
  muestre el tachado y la etiqueta (`/tienda`, `/producto/1`, `/hombre`).
- *Persistencia*: todo sigue después de recargar.
- *Botón de WhatsApp*: con número cargado, vacío e inválido; con precio propio el
  mensaje lleva el precio de Zero.
- *Celular* (390 px): sin scroll horizontal, el precio visible en la tabla.
- Que no haya errores de JavaScript en la consola.

**Cuándo está lista.** El workflow corre las pruebas de navegador y el PR no se
puede mergear si fallan. **Ojo:** hay que cachear/instalar el Chromium de
Playwright en el workflow; en el entorno de Claude ya viene instalado.

### Tarea 2 · Historial de precios guardado

**Por qué.** El "deshacer" de la pestaña Precios vive en memoria: se pierde al
recargar. No queda registro de quién cambió un precio, de cuánto a cuánto ni
cuándo.

**Qué hacer.** Una tabla `price_history` (artículo, origen, precio anterior,
precio nuevo, quién, cuándo) que se escriba en cada cambio desde el panel, y una
vista en el panel para consultarla. Solo la lee y escribe un admin (mismo patrón
de políticas que `catalog_overrides`, con `private.es_admin()`).

**Dónde.** SQL nuevo en `db/` (y sumado a `db/esquema.sql`), escritura en
`src/serverWrite.ts` y `src/useServerPanel.ts`, UI en el panel.

**Cuándo está lista.** Un cambio de precio, una oferta y un cambio en bloque
dejan filas; el SQL se verifica con un script como
`db/verificar-ajustes-catalogo.sql`. **Ojo:** el SQL lo aplica una persona.

### Tarea 3 · Ofertas que vencen solas — hecho

Una oferta puede tener fecha de fin (`offer_until`): ese día a las 23:59 vuelve sola
al precio de antes, y `crear_pedido` cobra lo mismo que muestra la tienda. Cómo
funciona y cómo activarlo (3 archivos SQL, en orden, y un verificador): README,
*Precios → Ofertas con fecha de fin*. **Falta que una persona corra esos SQL.**

### Tarea 4 · Comprar prendas de hombre online

**Por qué.** Las 950 prendas son hoy una vidriera: se consulta por WhatsApp. Para
venderlas online hacen falta **stock por talle** y precio propio confirmado.

**Qué hacer.** Decidir primero el modelo (cargar el stock de las que el local
realmente tiene, probablemente pocas, como productos de la base) y no al revés.
Los talles del catálogo salen de las marcas, no del stock de Zero, y vienen
desordenados y repetidos (`XXXXL` y `3XL`).

**Ojo.** Es una decisión de negocio antes que técnica: preguntarle al dueño cuántas
prendas tiene de verdad y si va a vender solo esas.

### Tarea 5 · Costo de envío real por Correo Argentino

**Por qué.** Hoy cada zona tiene un costo fijo o "a coordinar". El Correo cotiza
por **peso y código postal**.

**Qué hacer.** Un peso por producto (y por talle si cambia) y una tabla de
tarifas por zona y rango de peso. Los rangos del Correo: 0,5 · 1 · 2 · 3 · 5 · 10 ·
15 · 20 · 25 · 30 · 35 · 40 · 50 kg (límite 50 kg).

**Qué falta para empezar.** **Las tarifas del local**: son una negociación
comercial y no están en el documento del Correo. La alternativa es integrar la API
de Mi Correo, que pide contrato y credenciales.

### Tarea 6 · Plazo de preparación visible

**Por qué.** El checkout dice "Plazo estimado: 2 a 5 días hábiles **desde que
despachamos tu pedido**", pero la tienda no dice cuánto tarda en despachar.

**Qué hacer.** Un campo en *Configuración, Envíos* ("Preparamos tu pedido en…") y
mostrarlo junto al plazo del Correo. **Ojo:** el número lo define el local.

### Tarea 7 · Texto legal: si el cliente no está

**Por qué.** Con Paq.ar Clásico, si no hay nadie en el domicilio se deja un aviso
y el paquete **espera 5 días hábiles en la sucursal**; después **vuelve al
remitente**. Eso afecta al cliente y tiene que estar en los términos.

**Qué hacer.** Redactarlo en `/terminos` o `/devoluciones` (`src/Legales.tsx`).
**Ojo:** es un texto legal y los datos del vendedor no se inventan; lo tiene que
definir el local, idealmente con un contador o abogado. También hay que definir
**quién paga** el reenvío.

### Tarea 8 · Seguridad menor

**Por qué.** Las advertencias de Supabase (*Advisors*) marcan dos cosas, ninguna
urgente:
- **`cancelar_pedido` es ejecutable por visitantes anónimos.** Se verificó leyendo
  la función: **no es un riesgo real**, porque lo primero que hace es comprobar
  `private.es_admin()` y devolver un error. Es un candado de más que se puede
  aflojar. La advertencia de `crear_pedido` es esperable: es el checkout.
- **Protección contra contraseñas filtradas desactivada.** La cuenta de admin es
  la llave de todo.

**Qué hacer.**
- Activar la protección en el panel de Supabase (no es código): el aviso en
  *Advisors* trae el enlace con los pasos.
- Opcional: `revoke execute on function public.cancelar_pedido(text, text) from anon;`
  como archivo en `db/`, y comprobar que el panel sigue pudiendo cancelar (lo
  hace con la sesión del admin, no como anónimo).

**Ojo.** El `revoke` es un cambio en producción: lo aplica una persona.

### Tarea 9 · Fotos y precios de Mistral y Brooksfield

**Por qué.** El catálogo de hombre se armó con `scripts/scrape-men.py`, que baja
fotos y precios de **mistral.com.ar** y **brooksfieldstore.com**: unas 10.000
imágenes que son de terceros, dentro del repo (`public/men-gallery/`,
`public/men-images/`) y publicadas en el sitio. Es el **riesgo legal más grande**
de la tienda hoy, y hace pesado al repo (más de 160 MB de historia).

**Novedad (29/10/2026).** Franco informó que **tiene autorización de las marcas**. Falta dejarla **por escrito** (mail o documento firmado) y guardarla fuera del repo; con eso la salida de abajo queda resuelta, pero el peso del repo sigue siendo un tema.

**Qué hacer.** Esto es una **decisión de Juan y del dueño** antes que una tarea.
Las salidas posibles: fotos propias, o una autorización de las marcas (si el local
es revendedor oficial, suelen tener material para distribuidores). **No** hacer
público el repo mientras estas imágenes estén adentro.

### Tarea 10 · Selector de talle en la consulta por WhatsApp

**Por qué.** Hoy el mensaje pregunta "¿tienen disponibilidad y en qué talles?".

**Qué hacer.** Unos botones de talle en la galería que se sumen al mensaje.
**Ojo:** los talles del catálogo son los de las marcas, no el stock de Zero (ver
Tarea 4), así que el mensaje podría pedir un talle que el local no tiene. Conviene
resolver la Tarea 4 antes.

---

## Mapa rápido del código del panel de precios

- `src/AdminPrecios.tsx`: la pantalla (tabla, edición en la celda, panel de cambios
  en bloque, deshacer). Recibe los productos y las excepciones, y le avisa a
  `Admin.tsx` qué cambió (`onAplicar`); `Admin.tsx` lo pone en pantalla y lo manda
  al servidor.
- `src/priceTools.mjs`: las cuentas (puras): `calcularPrecio`, `vistaPrevia`,
  `aplicarCambios`, `capturar`/`aplicarFoto` (deshacer), `filasACsv`.
- `src/menOverrides.mjs`: las excepciones del catálogo de hombre (precio propio,
  baja, oferta) y su ida y vuelta con la tabla `catalog_overrides`.
- `src/serverWrite.ts` (`publicarAjustes`) y `src/useServerPanel.ts`: la escritura
  al servidor, con la sesión del admin.
- `src/Store.tsx`: guarda las excepciones en el navegador (clave
  `zero-ajustes-hombre-v1`) además de pedirlas al servidor.
- Pruebas: `tests/priceTools.test.mjs`, `tests/menOverrides.test.mjs`. Se corren
  con `pnpm test`.

---

## Para empezar (resumen del 29/10/2026)

Lo que sigue, en este orden:

1. **Cargar la configuración del local** en el panel (Configuración): WhatsApp
   (con código de país y sin el "+", por ejemplo `5492211234567`), CUIT, razón
   social, domicilio, mail, horarios, tabla de medidas y alias de pago. Sin esto
   la tienda no puede vender legalmente y no aparece el botón de WhatsApp.
2. ~~Sacar de `/hombre` la sección Accesorios~~ — hecho: los 11 artículos ya no están
   en el catálogo (ni en `scripts/scrape-men.py`, que los descarta).
3. **Vercel:** dejar un solo proyecto apuntando al repo para producción (hoy sale
   de `zero-indumentaria-ensenada.vercel.app`).
4. **Tarea 5** (costo de envío real) y
   **Tarea 7** (texto legal si el cliente no está).
5. Guardar por escrito la autorización de las marcas (Tarea 9).

---

## Payway (cobro con tarjeta) — hecho en Sandbox, falta probarlo de verdad

Está programado y probado **con Payway simulado** (`tests/payway.test.mjs` y
`supabase/functions/payway-pagar/prueba.ts`). **No se probó contra el Sandbox real de
Payway**: no teníamos claves. Cómo está armado y cómo se prende: README, *Cobro con
tarjeta por Payway*. Lo que falta, en orden:

1. **Desplegar** `payway-pagar` (`supabase functions deploy payway-pagar --no-verify-jwt`) y
   `payway-anular` (`supabase functions deploy payway-anular`, **sin** `--no-verify-jwt`) y cargar
   `PAYWAY_PRIVATE_API_KEY`. Hoy no están desplegadas.
2. **Probar en Sandbox** con las claves reales. Dudas que sólo el Sandbox responde:
   - La respuesta de `POST /tokens`: se lee el campo `id` (lo que dice la documentación
     de `/payments` sobre el token de 36 caracteres). Si viene con otro nombre, es un
     cambio de una línea en `src/PagoPayway.tsx`.
   - Si `/tokens` exige más datos que los que mandamos (la documentación de ejemplo
     manda también fecha de nacimiento y número de puerta; no los pedimos).
   - Un rechazo, ¿llega como HTTP 402 o como 200 con `status: rejected`? Está
     contemplado de las dos formas.
3. **Casos de prueba de Payway**: aprobado ($10.000 en 1 cuota y $30.000 en 3), rechazo
   05 y 51, débito (id 31) y **anulación**. Payway no habilita producción hasta aprobarlos.
4. **Anulación: hecha** (`payway-anular`, enganchada al botón *Cancelar* de un pedido pagado por
   Payway; probada con Payway simulado). Dudas para el Sandbox: qué `status` devuelve Payway al
   anular (se da por anulado sólo con `annulled`, `cancelled`, `refunded` y parecidos; con otro
   estado el panel dice "incierto" y no cancela). **Falta la devolución parcial o posterior al
   cierre de lote** (mismo endpoint con `{"amount": N}`): no se programó porque la documentación no
   dice si el monto va en centavos o en pesos, y equivocarse devolvería una fracción. Tampoco está
   enganchada la pestaña *Devoluciones* (prendas devueltas después de entregadas).
5. **Consulta de estado** (`GET /payments` con `siteOperationId`): para resolver los
   pedidos que quedan *pendientes* por falta de respuesta o por `review`. Hoy se revisan
   a mano en el backoffice de Payway. No se programó porque no tenemos la forma exacta de
   la respuesta.
6. **Más medios de pago y cuotas**: hoy Visa crédito y débito, una cuota. Los ids de los
   otros medios están en "Medios de pago disponibles" de Payway: se suman en `MEDIOS`.
7. **Producción**: claves nuevas, dirección `https://ventasonline.payway.com.ar/api/v2`
   (panel y secreto `PAYWAY_URL`) y un primer pago real de monto mínimo.
8. **Cierre de lote** (conciliación): lo hace Payway solo cada noche; el archivo llega por
   mail o FTP si se coordina con el focal técnico. No requiere código de la tienda.
