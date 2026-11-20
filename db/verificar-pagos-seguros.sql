-- Verificador de sólo lectura de db/pagos-seguros.sql: todo tiene que dar `true`.
select 1 as orden, 'orders.pago_token existe' as chequeo,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='pago_token') as ok
union all select 2, 'orders.pago_intentos existe',
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='pago_intentos')
union all select 3, 'existe reservar_cobro',
  exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='reservar_cobro')
union all select 4, 'reservar_cobro no la puede llamar anon ni authenticated',
  not has_function_privilege('anon','public.reservar_cobro(text,text,text,integer)','execute')
  and not has_function_privilege('authenticated','public.reservar_cobro(text,text,text,integer)','execute')
union all select 5, 'reservar_cobro la puede llamar service_role',
  has_function_privilege('service_role','public.reservar_cobro(text,text,text,integer)','execute')
union all select 6, 'vencer_pedidos_sin_pago existe y no es pública',
  exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='vencer_pedidos_sin_pago')
  and not has_function_privilege('anon','public.vencer_pedidos_sin_pago()','execute')
union all select 7, 'crear_pedido ya devuelve el código de pago',
  (select pg_get_functiondef(p.oid) like '%pagoToken%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='crear_pedido' limit 1)
order by orden;
