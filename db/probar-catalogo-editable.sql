-- Se ejecuta sólo en la base de prueba creada por probar-local.sh.
begin;
insert into public.products (id, name, brand, source_catalog_id, category, type, price, image, color, color_hex, sizes, active)
values ('prueba-catalogo-visible', 'Visible', 'Mistral', 'test-visible', 'Hombre', 'Remera', 1000, '/a.webp', 'Azul', '#000000', array['M'], true),
       ('prueba-catalogo-oculta', 'Oculta', 'Mistral', 'test-oculta', 'Hombre', 'Remera', 1000, '/b.webp', 'Azul', '#000000', array['M'], false);
-- Una compra que reduce stock mientras el editor está abierto no puede
-- sobrescribirse al guardar. El error debe revertir también el precio.
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000011','prueba@example.invalid');
insert into public.admins(user_id) values ('00000000-0000-0000-0000-000000000011');
insert into public.stock(product_id,size,qty) values ('prueba-catalogo-visible','M',3);
grant select, insert, update, delete on public.products, public.stock to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $$ declare fila jsonb; n integer; begin
  select to_jsonb(p) || '{"price":2000}'::jsonb into fila from public.products p where p.id='prueba-catalogo-visible';
  begin
    perform public.guardar_producto_con_stock(fila, '{"M":4}'::jsonb, '{"M":4}'::jsonb);
    raise exception 'Se aceptó un stock anterior a una compra';
  exception when raise_exception then
    if sqlerrm not like 'El stock cambió%' then raise; end if;
  end;
  select price into n from public.products where id='prueba-catalogo-visible';
  if n <> 1000 then raise exception 'Se guardó parte del cambio rechazado'; end if;
  perform public.guardar_producto_con_stock(fila, '{"M":2}'::jsonb, '{"M":3}'::jsonb);
  select qty into n from public.stock where product_id='prueba-catalogo-visible' and size='M';
  if n <> 2 then raise exception 'No se guardó el stock correcto'; end if;
end $$;
reset role;
grant select, update on public.products to anon;
do $$ begin
  begin
    insert into public.products (id, name, source_catalog_id, category, type, price, image, color, color_hex, sizes)
      values ('prueba-duplicada', 'Duplicada', 'test-visible', 'Hombre', 'Remera', 1000, '/a.webp', 'Azul', '#000000', array['M']);
    raise exception 'El origen duplicado fue aceptado';
  exception when unique_violation then null;
  end;
end $$;
set local role anon;
do $$ declare ids text[]; n integer; begin
  if has_function_privilege('anon', 'public.guardar_producto_con_stock(jsonb,jsonb,jsonb)', 'EXECUTE') then raise exception 'El visitante puede guardar productos'; end if;
  select array_agg(source_catalog_id) into ids from public.catalogo_importado_oculto();
  if ids is distinct from array['test-oculta'] then raise exception 'Los identificadores ocultos son incorrectos: %', ids; end if;
  select count(*) into n from public.products where id = 'prueba-catalogo-oculta';
  if n <> 0 then raise exception 'El visitante puede leer el producto oculto'; end if;
  update public.products set name = 'No permitido' where id = 'prueba-catalogo-visible';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'El visitante pudo modificar un producto'; end if;
end $$;
reset role;
rollback;
