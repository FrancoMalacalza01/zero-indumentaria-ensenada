-- Comprobaciones de sólo lectura. Ejecutar después de aplicar catalogo-editable.sql.
select 'products.brand' as chequeo, exists (
  select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='brand'
) as ok
union all select 'products.source_catalog_id', exists (
  select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='source_catalog_id'
)
union all select 'origen único', exists (
  select 1 from pg_indexes where schemaname='public' and tablename='products' and indexname='products_source_catalog_id_unique'
)
union all select 'función de ocultos', to_regprocedure('public.catalogo_importado_oculto()') is not null
union all select 'visitante puede consultar identificadores', coalesce(has_function_privilege('anon', to_regprocedure('public.catalogo_importado_oculto()'), 'EXECUTE'), false)
union all select 'función de guardado seguro', to_regprocedure('public.guardar_producto_con_stock(jsonb,jsonb,jsonb)') is not null
union all select 'visitante no puede guardar', coalesce(not has_function_privilege('anon', to_regprocedure('public.guardar_producto_con_stock(jsonb,jsonb,jsonb)'), 'EXECUTE'), false);
