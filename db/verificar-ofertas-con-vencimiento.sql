-- Comprueba que db/ofertas-con-vencimiento.sql (y los dos archivos que van con él)
-- quedaron bien aplicados.
--
-- Sólo lee: no cambia nada, se puede correr cuantas veces haga falta.
-- Para correrlo en Supabase: SQL Editor, pegar y ejecutar.
--
-- Resultado: una fila por cosa que se mira. Está todo bien cuando la columna `ok`
-- es true en TODAS. Si alguna dice false, `chequeo` dice qué paso falta:
-- las 1 a 4 son de ofertas-con-vencimiento.sql, la 5 de catalogo-editable.sql
-- y la 6 de crear_pedido.sql (la que importa: sin ella se cobra mal).
select orden, chequeo, ok
from (
  select 1 as orden, 'products tiene la columna offer_until' as chequeo,
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'products'
                    and column_name = 'offer_until') as ok
  union all
  select 2, 'catalog_overrides tiene la columna offer_until',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'catalog_overrides'
                    and column_name = 'offer_until')
  union all
  select 3, 'Existe la función precio_vigente()',
         to_regprocedure('public.precio_vigente(integer,integer,timestamptz)') is not null
  union all
  select 4, 'Tiene las reglas: un vencimiento exige un precio anterior (en las dos tablas)',
         (select count(*) from pg_constraint
           where conname in ('products_vencimiento_con_oferta', 'catalog_overrides_vencimiento_con_oferta')) = 2
  union all
  select 5, 'guardar_producto_con_stock guarda offer_until (paso 2: catalogo-editable.sql)',
         coalesce((select pg_get_functiondef(p.oid) like '%offer_until%'
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'guardar_producto_con_stock'), false)
  union all
  select 6, 'crear_pedido cobra precio_vigente() (paso 3: crear_pedido.sql)',
         coalesce((select pg_get_functiondef(p.oid) like '%precio_vigente%'
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'crear_pedido'), false)
) c
order by orden;
