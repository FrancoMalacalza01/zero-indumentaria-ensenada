# Cobrar con Mercado Pago: paso a paso, de cero y sin saltear nada

Esta guía está pensada para hacerla **de corrido, con la computadora, sin saber nada técnico**. Cada paso dice
exactamente dónde hacer clic y qué tendrías que ver. Si algo no coincide con lo que ves, **no sigas**: sacá una
captura (tapando los números secretos) y mandala.

> **Aviso sobre los menús.** Mercado Pago y Supabase cambian los nombres y la ubicación de sus botones seguido.
> Los pasos son los que conocemos; si un botón se llama distinto, buscá el que más se parezca.

---

## 0. Qué vamos a lograr

Cuando un cliente compre en tu tienda, toca **"Pagar ahora"**, va a Mercado Pago, paga (con tarjeta de débito,
de crédito, dinero en cuenta, en **1 o en 3 cuotas**), vuelve a tu tienda y el pedido queda **pagado solo**.

Para eso hacen falta **tres llaves** que se cargan en **tres lugares distintos**:

| Qué es | De dónde sale | Dónde se pega |
|---|---|---|
| **Access Token** (una clave larga y secreta) | Mercado Pago → tu aplicación → Credenciales | Supabase → Edge Functions → Secrets → `MP_ACCESS_TOKEN` |
| **Dirección de tu tienda** | La conocés: `https://zero-indumentaria-ensenada-gules.vercel.app` | Supabase → Edge Functions → Secrets → `SITIO_URL` |
| **Interruptor "Cobrar online"** | — | Panel de tu tienda `/admin` → Configuración |

**Reglas de oro**
1. El Access Token es como la contraseña de tu cuenta de cobros. **Nunca** lo pegues en el chat, en el panel de la
   tienda, en un mail ni en una captura.
2. Hacé todo con **la misma cuenta** de Mercado Pago, la del negocio.
3. Primero se prueba con credenciales de **prueba** (no se cobra plata de verdad). Recién después, las de producción.

---

## 1. Antes de empezar: lista de cosas listas

Marcá cada una:

- [ ] Estoy en una **computadora** (no en el celular).
- [ ] Tengo usuario y contraseña de **Mercado Pago** (la cuenta del negocio) y puedo recibir el código de
      verificación en mi celular o mail.
- [ ] Tengo usuario y contraseña de **Supabase** (con 2FA, ya lo tenés).
- [ ] Tengo usuario y contraseña del **panel de la tienda** (`/admin`).
- [ ] Tengo abierta la tienda: https://zero-indumentaria-ensenada-gules.vercel.app
- [ ] Mi cuenta de Mercado Pago está **verificada** (identidad confirmada). Si no, hacelo antes: Mercado Pago te
      lo pide en la app, en *Perfil → Datos personales / Verificación*.

---

## 2. Entrar a tu aplicación de Mercado Pago

La aplicación ya la creaste (**Checkout Pro**, con **API de Preferences**). Para entrar:

1. Abrí el navegador (Chrome) y escribí en la barra de arriba: `mercadopago.com.ar/developers/panel/app`
   y apretá **Enter**.
2. Si te pide iniciar sesión, iniciá con la cuenta del negocio y poné el código que te llega.
3. Vas a ver una lista de **"Tus integraciones"** (o "Tus aplicaciones"). Tocá la que se llama
   **Zero Indumentaria tienda** (o el nombre que le pusiste).
4. Dentro de la aplicación, mirá el **menú de la izquierda**. Tiene que haber una opción **Credenciales**.
   Tocala.

**Si no ves ninguna aplicación:** hay que crearla. Tocá **Crear aplicación**, ponele el nombre
`Zero Indumentaria tienda`, elegí **Pagos online**, después **Checkout Pro**, en "Tipo de API" elegí
**API de Preferences** (no "Orders": nuestro código usa Preferences), aceptá los términos y creala.

---

## 3. Las credenciales de PRUEBA (empezamos por acá)

En la pantalla **Credenciales** vas a ver dos grupos: **Credenciales de prueba** y **Credenciales de producción**.

1. Tocá **Credenciales de prueba** (puede ser una pestaña o un título).
2. Vas a ver varios datos. **El único que necesitamos se llama `Access Token`.** Empieza con **`TEST-`**.
   - La *Public Key* y el *Client ID* / *Client Secret* **no** los vamos a usar. No los copies.
3. Al lado del Access Token hay un ícono de **copiar** (dos hojitas). Tocalo. Ya está copiado en el portapapeles.
4. **No lo pegues en ningún lado todavía.** Seguí con la sección 5.

Cómo reconocerlo: es **largo** (unos 70 caracteres), tiene letras, números y guiones, y empieza con `TEST-`.

---

## 4. (Después, al final) Las credenciales de PRODUCCIÓN

Esto lo hacés **recién cuando las pruebas de la sección 8 salieron bien**. Se explica completo en la sección 10.

---

## 5. Pegar el Access Token en Supabase

1. En el navegador, abrí `supabase.com/dashboard` e iniciá sesión.
2. Tocá el proyecto **mistral-ensenada**.
3. En el menú de la izquierda tocá **Edge Functions**.
4. Arriba de la pantalla hay pestañas. Tocá **Secrets** (puede decir "Manage secrets").
5. Vas a ver un cuadro **"Add or replace secrets"** con dos casilleros: **Name** y **Value**.
6. En **Name** escribí exactamente (copiá y pegá): `MP_ACCESS_TOKEN`
7. En **Value** pegá el Access Token con **Ctrl+V**.
   - Tocá el **ojito** de la derecha para ver lo que pegaste y comprobar que empieza con `TEST-`.
   - **No tiene que tener espacios** al principio ni al final.
8. Tocá **Add another** (agregar otro).
9. En el segundo **Name** escribí: `SITIO_URL`
10. En el segundo **Value** escribí: `https://zero-indumentaria-ensenada-gules.vercel.app`
    (sin barra `/` al final y sin espacios).
11. Tocá **Save** (el botón verde).
12. Comprobá: en la lista tienen que aparecer **`MP_ACCESS_TOKEN`** y **`SITIO_URL`**. Los valores quedan
    ocultos: es normal.

> Si ya existía `MP_ACCESS_TOKEN` con otro valor, al guardar **se reemplaza**. Así se cambia de prueba a producción.

---

## 6. Dejar la tienda lista: desplegar las funciones

Las funciones del servidor tienen que estar con la última versión. Si seguiste las instrucciones anteriores ya lo
hiciste. Para estar seguro, en **Edge Functions** tienen que estar: `crear-pago`, `pago-aviso`, `payway-pagar`,
`enviar-mail`, `payway-anular`.

**Esta vez hay un cambio nuevo en `crear-pago`** (limita las cuotas a las que vos ofrecés). Hay que volver a
desplegarla con el archivo que te pasa Claude (`crear-pago-index.ts`):

1. Edge Functions → **crear-pago** → pestaña **Code**.
2. Seleccioná todo (Ctrl+A) y borrá.
3. Abrí el archivo, copiá **todo** (Ctrl+A, Ctrl+C) y pegalo (Ctrl+V). Mirá que la **última línea** sea `});`.
4. Tocá **Deploy updates**.
5. **Verify JWT debe estar apagado** en `crear-pago` y en `pago-aviso`.

---

## 7. Configurar la tienda (panel `/admin`)

1. Abrí `zero-indumentaria-ensenada-gules.vercel.app/admin` e iniciá sesión.
2. En el menú de la izquierda, bajá hasta **Configuración** y tocala. (Si no la ves, achicá el zoom del
   navegador con **Ctrl y la tecla `-`**.)
3. Buscá el bloque **"Cobrar antes de entregar"**.
4. Prendé el interruptor **"Cobrar online el monto exacto de la bolsa"**.
5. Bajá al bloque **"Cobrar en el local"** y buscá el campo **"Cuotas sin interés que bancás"**: poné **3**.
   Dejá **"Cuotas máximas del posnet"** en **0** (o en 3 si querés el mismo tope). Eso es lo que la tienda anuncia
   **y lo que le pide a Mercado Pago como tope de cuotas**: el más alto de los dos campos.
6. Bajá hasta el final de la pantalla y tocá **Guardar**.
7. Verificá que quedó: recargá la página (F5) y mirá que el interruptor siga prendido.

### Muy importante: las cuotas "sin interés"

La tienda le dice a Mercado Pago **"ofrecé hasta 3 cuotas"**. Pero que esas 3 cuotas sean **sin interés para el
cliente** (las paga el negocio) **se activa en tu cuenta de Mercado Pago**, no en la tienda:

1. Abrí la **app de Mercado Pago** o la web, entrá a tu cuenta.
2. Andá a **Tu negocio → Costos y cuotas** (en la app: *Perfil → Costos y cuotas*).
3. Buscá la opción de **cuotas sin interés** / **"Ofrecé cuotas sin interés"** y elegí **3 cuotas**.
4. Mirá cuánto te cuesta: Mercado Pago cobra una comisión mayor por cada venta en cuotas sin interés, porque el
   costo de financiarlas lo asumís vos. **Ese número exacto está en tu cuenta**; no lo inventamos acá.
5. Guardá.

Si no activás esto, el cliente igual va a poder pagar en 3 cuotas, pero **con el interés del banco**.

---

## 8. Las pruebas (hacelas todas, en este orden)

**Antes de empezar**, para probar necesitás que el token cargado sea el de **prueba** (`TEST-…`). Con ese token no
se cobra plata real.

### 8.1 Qué hace falta para pagar "de mentira"

Mercado Pago pide que para probar uses **cuentas de prueba** (una de vendedor y una de comprador):

1. En `mercadopago.com.ar/developers/panel/app` → tu aplicación → buscá **Cuentas de prueba** (puede estar en el
   menú izquierdo, o en "Tu integración → Cuentas de prueba").
2. Creá **un usuario comprador de prueba** (te da un usuario y una contraseña). Anotalos.
3. Para pagar como ese comprador, abrí una **ventana de incógnito** del navegador (Ctrl+Shift+N) así no se
   mezcla con tu sesión real.

> Si tu cuenta no tiene "Cuentas de prueba" o la prueba te da problemas, también se puede probar con
> **producción y un monto mínimo**, pagando con tu tarjeta real y devolviéndote el dinero (sección 10).

### 8.2 Tarjetas de prueba

Mercado Pago publica tarjetas de prueba en su documentación (buscá **"Tarjetas de prueba"**). Las habituales para
Argentina son (**verificalas en su documentación, por si cambiaron**):

| Tarjeta | Número | Código | Vencimiento |
|---|---|---|---|
| Mastercard crédito | 5031 7557 3453 0604 | 123 | 11/30 |
| Visa crédito | 4509 9535 6623 3704 | 123 | 11/30 |
| Mastercard débito | 5287 3383 1025 3304 | 123 | 11/30 |
| Visa débito | 4002 7686 9439 5619 | 123 | 11/30 |

En el campo **Nombre del titular** el nombre decide **qué resultado da** el pago de prueba:

| Nombre del titular | Resultado |
|---|---|
| `APRO` | Pago **aprobado** |
| `FUND` | Rechazado por **fondos insuficientes** |
| `OTHE` | Rechazado por error general |
| `CONT` | Queda **pendiente** de pago |

Como **DNI** podés poner `12345678`.

### 8.3 Las pruebas, una por una

Para cada prueba hacé primero un pedido en la tienda: agregá una prenda **barata** a la bolsa, andá a **Comprar**,
elegí **Retiro en el local**, poné tu nombre y confirmá. En la pantalla **"Pedido tomado"** tocá **"Pagar … ahora"**.

| # | Prueba | Qué hacés en Mercado Pago | Qué tiene que pasar en la tienda |
|---|---|---|---|
| 1 | **Compra sin pagar online** | No toques "Pagar ahora", elegí Efectivo | El pedido aparece en `/admin → Pedidos` como pendiente |
| 2 | **Tarjeta de DÉBITO** | Pagá con la tarjeta de débito de prueba, titular `APRO` | Vuelve a tu tienda; el pedido queda **pagado** y en **Preparando** |
| 3 | **Tarjeta de CRÉDITO en 1 cuota** | Crédito de prueba, titular `APRO`, elegí **1 cuota** | Igual: pagado y en Preparando |
| 4 | **CRÉDITO en 3 cuotas fijas** | Crédito de prueba, titular `APRO`, elegí **3 cuotas** | Pagado. Mirá que la pantalla ofrezca **hasta 3** cuotas y no más |
| 5 | **Dinero en cuenta** | Pagá con el saldo del usuario comprador de prueba | Pagado y en Preparando |
| 6 | **Rechazo** | Titular `FUND` | Mercado Pago avisa el rechazo; el pedido **no** queda pagado |
| 7 | **Pendiente** | Titular `CONT` | El pedido queda pendiente; no pasa a Preparando |
| 8 | **Devolución** | En tu cuenta, devolvé el pago de la prueba 2 | Más tarde, el pedido figura como devuelto |

Después de **cada** prueba, miralo en tres lugares:
1. **Tu tienda**: pantalla final.
2. **`/admin → Pedidos`**: el estado del cobro y el del pedido (puede tardar **hasta un minuto**).
3. **Mercado Pago** (tu cuenta de prueba): que aparezca el cobro.

**En la prueba 4 mirá específicamente:**
- Que la pantalla de Mercado Pago muestre un **máximo de 3 cuotas** (nuestro tope).
- Que el total de las 3 cuotas sea igual al precio (si activaste "sin interés" en tu cuenta) o con interés (si no).

---

## 9. Si algo falla (tabla de errores)

Para ver qué pasó: Supabase → **Edge Functions** → la función → pestaña **Logs**.

| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| Debajo del botón: **"Mercado Pago no pudo armar el cobro"** y en los logs `403 … PolicyAgent … UNAUTHORIZED` | Mercado Pago no le da permiso a ese token para cobrar | Verificá tu cuenta, **activá las credenciales de producción** o probá con el token `TEST-`. Si sigue, consultá al soporte de desarrolladores de Mercado Pago |
| Logs con `401` o `invalid access token` | El token está mal copiado o es de otra cuenta | Copiá de nuevo el Access Token y reemplazá `MP_ACCESS_TOKEN` (sin espacios) |
| **"El cobro online todavía no está configurado"** | Falta `MP_ACCESS_TOKEN` o tiene un error de tipeo en el nombre | Revisá en Secrets que el nombre sea `MP_ACCESS_TOKEN` exacto |
| No aparece el botón **"Pagar ahora"** | El interruptor del panel está apagado o no guardaste | Sección 7. Después Ctrl+F5 |
| Dice **"No encontramos ese pedido"** | El pedido es de hace más de 2 horas o `crear-pago` está con la versión vieja | Hacé un pedido nuevo; revisá el despliegue |
| Pagaste pero el pedido sigue sin pagar | El aviso de Mercado Pago no llegó o el monto no coincide | Edge Functions → `pago-aviso` → Logs |
| El cliente vuelve a la raíz de Mercado Pago, no a tu tienda | Falta `SITIO_URL` | Sección 5, pasos 8 a 11 |
| La compra falla **antes** de llegar a pagar | Es otro tema (la base de datos), no Mercado Pago | Mirá F12 → Network → `crear_pedido` y pasá el mensaje |

---

## 10. Pasar a producción (vender de verdad)

Hacelo **sólo cuando todas las pruebas de la sección 8 salieron bien**.

### 10.1 Activar las credenciales de producción
1. `mercadopago.com.ar/developers/panel/app` → tu aplicación → **Credenciales** → **Credenciales de producción**.
2. Si hay un botón o aviso **"Activar credenciales"**, tocalo y completá lo que pida: **rubro** (ropa y
   accesorios), **sitio web** (`https://zero-indumentaria-ensenada-gules.vercel.app`) y aceptá los términos.
3. Si te pide verificar la cuenta, hacelo.
4. Cuando esté activa, copiá el **Access Token** de producción (empieza con **`APP_USR-`**).

### 10.2 Cambiarlo en Supabase
1. Supabase → Edge Functions → Secrets.
2. Name: `MP_ACCESS_TOKEN`, Value: el token de producción (reemplaza al de prueba). **Save**.
3. Esperá **un minuto**.

### 10.3 El primer pago real, mínimo
1. Hacé un pedido con la prenda más barata.
2. Pagá con **tu propia tarjeta** (en 1 cuota).
3. Mirá que quede **pagado** y en **Preparando** en `/admin → Pedidos`.
4. **Devolvé el dinero:** en tu cuenta de Mercado Pago → *Actividad* → ese pago → **Devolver dinero**.
5. Recién ahí, la tienda está lista para vender.

---

## 11. Si se filtra el token

Si pegaste el Access Token por error en un chat, mail o captura:
1. Mercado Pago → tu aplicación → Credenciales → **renovar / regenerar** el Access Token.
2. Reemplazá `MP_ACCESS_TOKEN` en Supabase por el nuevo.
3. El anterior queda inservible.

---

## 12. Resumen de una página

1. Mercado Pago → tu aplicación → **Credenciales de prueba** → copiar **Access Token** (`TEST-…`).
2. Supabase → Edge Functions → Secrets → `MP_ACCESS_TOKEN` = el token; `SITIO_URL` = la dirección de la tienda → **Save**.
3. Desplegar `crear-pago` con el archivo nuevo.
4. Panel de la tienda → Configuración → prender **"Cobrar online…"**, poner **3 cuotas** → **Guardar**.
5. Mercado Pago → *Costos y cuotas* → activar **3 cuotas sin interés** (si querés que no paguen interés).
6. Probar los 8 casos de la sección 8.
7. Cambiar a las **credenciales de producción** y hacer **un pago real mínimo** con devolución.
