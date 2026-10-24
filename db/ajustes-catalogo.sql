-- Ajustes del catálogo de hombre: la parte nueva de esquema.sql, sola, para
-- correrla en la base que ya existe sin tocar nada de lo demás.
-- Sólo agrega una tabla; se puede correr más de una vez.
-- Para correrlo en Supabase: SQL Editor, pegar y ejecutar.

-- ---------------------------------------------------------------------------
-- Ajustes del catálogo de hombre
-- ---------------------------------------------------------------------------
-- El catálogo de hombre viene armado dentro del sitio (src/men-catalog.json).
-- Esta tabla guarda sólo lo que el local cambia sobre él: un precio propio, o
-- la baja de una prenda que no tiene. Una prenda sin fila se muestra tal como
-- viene. No hay clave foránea: el catálogo no está en la base.
create table if not exists public.catalog_overrides (
  product_id text primary key,
  price      integer check (price is null or (price > 0 and price <= 10000000)),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.catalog_overrides enable row level security;

-- La tienda necesita leerla para saber qué ocultar y qué precio mostrar.
-- Sólo hay ids, precios y un sí/no: nada que un cliente no pueda ver ya.
drop policy if exists ajustes_publico on public.catalog_overrides;
create policy ajustes_publico on public.catalog_overrides
  for select to anon, authenticated using (true);
drop policy if exists ajustes_admin_alta on public.catalog_overrides;
create policy ajustes_admin_alta on public.catalog_overrides
  for insert to authenticated with check (private.es_admin());
drop policy if exists ajustes_admin_edicion on public.catalog_overrides;
create policy ajustes_admin_edicion on public.catalog_overrides
  for update to authenticated using (private.es_admin()) with check (private.es_admin());
drop policy if exists ajustes_admin_baja on public.catalog_overrides;
create policy ajustes_admin_baja on public.catalog_overrides
  for delete to authenticated using (private.es_admin());

comment on table public.catalog_overrides is
  'Cambios del local sobre el catálogo de hombre: precio propio y bajas. Se lee pública a propósito. Una prenda sin fila se muestra como viene.';
