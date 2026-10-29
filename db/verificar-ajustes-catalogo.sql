-- Comprueba que db/ajustes-catalogo.sql quedó bien aplicado.
--
-- Sólo lee: no cambia nada, se puede correr cuantas veces haga falta.
-- Para correrlo en Supabase: SQL Editor, pegar y ejecutar.
--
-- Resultado: una fila por cosa que se mira. Está todo bien cuando la columna
-- `ok` es true en TODAS. Si alguna dice false, la columna `chequeo` dice qué
-- falta; lo normal es volver a correr db/ajustes-catalogo.sql, que se puede
-- repetir sin problema.
select orden, chequeo, ok
from (
  select 1 as orden,
         'La tabla catalog_overrides existe' as chequeo,
         to_regclass('public.catalog_overrides') is not null as ok
  union all
  select 2, 'Tiene la seguridad por fila (RLS) activada',
         coalesce((select relrowsecurity from pg_class
                    where oid = to_regclass('public.catalog_overrides')), false)
  union all
  select 3, 'Tiene las 5 columnas: product_id, price, old_price, active, updated_at',
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'catalog_overrides'
             and column_name in ('product_id','price','old_price','active','updated_at')) = 5
  union all
  select 4, 'Tiene la regla de ofertas (el precio anterior tiene que ser mayor al precio)',
         exists (select 1 from pg_constraint
                  where conname = 'catalog_overrides_oferta'
                    and conrelid = to_regclass('public.catalog_overrides'))
  union all
  select 5, 'Tiene sus 4 políticas de acceso',
         (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'catalog_overrides'
             and policyname in ('ajustes_publico','ajustes_admin_alta',
                                'ajustes_admin_edicion','ajustes_admin_baja')) = 4
  union all
  select 6, 'La tienda (visitantes sin cuenta) puede LEER la tabla',
         exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'catalog_overrides'
                    and cmd = 'SELECT' and roles && array['anon','public']::name[])
  union all
  select 7, 'Los visitantes sin cuenta NO pueden escribir (ninguna política de escritura para ellos)',
         -- Sin la tabla no hay políticas y esto daría true por vacío: no vale.
         to_regclass('public.catalog_overrides') is not null
         and not exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'catalog_overrides'
                            and cmd in ('INSERT','UPDATE','DELETE','ALL')
                            and roles && array['anon','public']::name[])
  union all
  select 8, 'Escribir exige ser admin: las 3 políticas de escritura usan private.es_admin()',
         (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'catalog_overrides'
             and cmd in ('INSERT','UPDATE','DELETE')
             and coalesce(qual, '') || coalesce(with_check, '') like '%es_admin%') = 3
  union all
  select 9, 'Existe la función private.es_admin() que usan las políticas',
         to_regprocedure('private.es_admin()') is not null
) c
order by orden;
