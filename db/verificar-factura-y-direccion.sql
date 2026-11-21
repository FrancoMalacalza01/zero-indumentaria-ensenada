-- Verificador de sólo lectura de db/factura-y-direccion.sql: todo tiene que dar `true`.
select 1 as orden, 'orders.factura existe' as chequeo,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='factura') as ok
union all select 2, 'orders.direccion existe',
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='direccion')
union all select 3, 'orders.email existe',
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='email')
union all select 4, 'hay UNA sola función crear_pedido',
  (select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='crear_pedido') = 1
union all select 5, 'crear_pedido recibe factura, mail y dirección',
  exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='crear_pedido' and p.pronargs = 8)
order by orden;
