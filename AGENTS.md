# Cómo trabajamos en este repo

Lo leen las dos herramientas que se usan acá (ChatGPT/Codex y Claude) y las
personas. Si algo de esto deja de ser verdad, se arregla acá, no se discute en
el chat.

## El proyecto

Tienda y panel de administración de Zero Indumentaria (Ensenada). React,
TypeScript y Vite; la base y las funciones viven en Supabase; se publica en
Cloudflare Pages (o Vercel). El `README.md` explica cómo anda cada parte y por qué.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev      # servidor local
pnpm test     # pruebas (node --test)
pnpm build    # tsc + vite build
```

**Qué sigue:** lo pendiente, con el contexto de cada cosa y cómo pedírselo a la IA,
está en [`docs/pendientes.md`](docs/pendientes.md). Si vas a empezar algo, mirá
ahí primero: puede que ya esté hecho o que haya una decisión pendiente.

## Reglas de trabajo

1. **`main` es lo que se publica.** Nadie escribe directo en `main`, ni una
   persona ni una IA. Todo entra por pull request.
2. **Una rama por tema, desde el `main` más nuevo.** Nombres tipo
   `feat/tienda-filtros`, `fix/precio-redondeo`. Un PR hace una cosa: si salen
   dos, son dos PR.
3. **Antes de abrir el PR:** traer `main` a la rama (`git merge origin/main`,
   sin rebase ni `--force` sobre una rama ya subida), resolver conflictos y
   correr `pnpm test` y `pnpm build`. GitHub corre lo mismo en cada PR; si da
   rojo, se arregla antes de mergear.
4. **Lo mergea el dueño del repo**, mirando el PR en GitHub, o la IA cuando el
   dueño se lo pide (por ejemplo, "mergealo cuando dé verde"). La IA no mergea
   por su cuenta un PR que ella escribió.
5. **No se reescribe historia publicada.** Nada de `push --force`, `rebase` ni
   `commit --amend` sobre commits que ya están en GitHub.
6. **Si dos ramas tocan el mismo archivo, se avisa** antes de seguir, no
   después del conflicto.

## Cosas que se rompen fácil

- **La base es una sola y es la de producción.** Un cambio de tablas o permisos
  va como archivo SQL en `db/` (y se suma a `db/esquema.sql`), y **lo corre una
  persona** en el SQL Editor de Supabase, después de revisarlo. Ninguna IA
  aplica cambios a la base sin que se lo pidan en ese momento.
  Los SQL se prueban antes en un Postgres local (`db/probar-local.sh` y
  `db/probar-ajustes.sh`); si agregás uno, agregá también su prueba y, si se puede,
  un verificador de sólo lectura como `db/verificar-ajustes-catalogo.sql`.
- **Claves.** La clave *publishable* de Supabase es pública a propósito y está
  en el código. Nunca van al repo: la `service_role`, los tokens de Mercado
  Pago, las credenciales de SMTP. Esas viven en Supabase o en Vercel.
- **Datos legales y medidas no se inventan.** CUIT, razón social, domicilio y la
  tabla de medidas las carga el local. El código no tiene valores por defecto
  para eso a propósito (ver *Legales* en el README).
- **La lógica que importa va en `.mjs` con pruebas** (`tests/*.test.mjs`), no
  adentro de un componente. Si se agrega o cambia lo que hace una prueba, se
  actualiza la tabla de pruebas del README.
- **Los comentarios explican el porqué**, en español, como el resto del código.

## Publicación

El host (Cloudflare Pages o Vercel) publica `main` como producción y cada rama
como una vista previa con su propia dirección. Hay que mirar la vista previa del
PR antes de mergear. Producción tiene que salir de **un solo** proyecto; si hay
dos apuntando a este repo, uno se desconecta. Cómo se configura, en el
`README.md` (*Publicación*).
