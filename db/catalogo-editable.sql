-- Preparar fichas importadas para edición y compra. Ejecutar sólo después de revisión.
alter table public.products add column if not exists brand text not null default '';
alter table public.products add column if not exists source_catalog_id text;
create unique index if not exists products_source_catalog_id_unique on public.products(source_catalog_id) where source_catalog_id is not null;

-- La tienda sólo necesita conocer qué fichas importadas fueron ocultadas; no
-- exponemos el resto de los datos de productos inactivos.
create or replace function public.catalogo_importado_oculto()
returns table(source_catalog_id text)
language sql stable security definer set search_path = ''
as $$ select p.source_catalog_id from public.products p where p.source_catalog_id is not null and not p.active $$;
revoke all on function public.catalogo_importado_oculto() from public;
grant execute on function public.catalogo_importado_oculto() to anon, authenticated;

-- Guarda la ficha y el stock juntos, y rechaza una edición basada en un stock
-- que ya cambió por una compra o por otra persona.
create or replace function public.guardar_producto_con_stock(
  p_producto jsonb, p_stock jsonb default null, p_stock_esperado jsonb default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v public.products%rowtype;
  v_actual jsonb;
begin
  if not private.es_admin() then raise exception 'Sólo un administrador puede guardar productos.'; end if;
  v := pg_catalog.jsonb_populate_record(null::public.products, p_producto);
  if v.id is null or v.id = '' then raise exception 'Falta el identificador del producto.'; end if;
  perform 1 from public.products p where p.id = v.id for update;
  if p_stock_esperado is not null then
    if pg_catalog.jsonb_typeof(p_stock_esperado) is distinct from 'object' or pg_catalog.jsonb_typeof(p_stock) is distinct from 'object' then
      raise exception 'El stock no tiene el formato esperado.';
    end if;
    perform 1 from public.stock s where s.product_id = v.id order by s.size for update;
    select coalesce(pg_catalog.jsonb_object_agg(s.size, s.qty), '{}'::jsonb) into v_actual from public.stock s where s.product_id = v.id;
    if exists (
      select 1 from (
        select key from pg_catalog.jsonb_object_keys(v_actual) as k(key)
        union select key from pg_catalog.jsonb_object_keys(p_stock_esperado) as k(key)
      ) claves where coalesce((v_actual ->> key)::integer, 0) <> coalesce((p_stock_esperado ->> key)::integer, 0)
    ) then raise exception 'El stock cambió mientras editabas. Recargá y revisá las cantidades antes de guardar.'; end if;
  end if;
  insert into public.products (id,name,brand,source_catalog_id,category,type,price,old_price,image,images,color,color_hex,sizes,is_new,active,description,position,updated_at)
  values (v.id,v.name,coalesce(v.brand,''),v.source_catalog_id,v.category,v.type,v.price,v.old_price,v.image,coalesce(v.images,'{}'),v.color,v.color_hex,coalesce(v.sizes,'{}'),v.is_new,v.active,coalesce(v.description,''),v.position,now())
  on conflict (id) do update set name=excluded.name, brand=excluded.brand, source_catalog_id=excluded.source_catalog_id,
    category=excluded.category, type=excluded.type, price=excluded.price, old_price=excluded.old_price,
    image=excluded.image, images=excluded.images, color=excluded.color, color_hex=excluded.color_hex,
    sizes=excluded.sizes, is_new=excluded.is_new, active=excluded.active, description=excluded.description,
    position=excluded.position, updated_at=excluded.updated_at;
  if p_stock_esperado is not null then
    insert into public.stock (product_id, size, qty)
      select v.id, key, value::integer from pg_catalog.jsonb_each_text(p_stock)
      where key = any(v.sizes)
      on conflict (product_id, size) do update set qty = excluded.qty;
    delete from public.stock s where s.product_id = v.id and not (s.size = any(v.sizes));
  end if;
end $$;
revoke all on function public.guardar_producto_con_stock(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.guardar_producto_con_stock(jsonb,jsonb,jsonb) to authenticated;
