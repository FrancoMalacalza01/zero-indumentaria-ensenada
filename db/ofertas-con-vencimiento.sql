-- Ofertas que terminan solas en una fecha.
--
-- Ejecutar en el SQL Editor de Supabase, DESPUÉS de revisarlo, y en este orden:
--   1. este archivo (agrega la columna y la regla del precio),
--   2. db/catalogo-editable.sql (el panel guarda la fecha al guardar un producto),
--   3. db/crear_pedido.sql (la compra cobra el precio que vale ahora).
-- Después, db/verificar-ofertas-con-vencimiento.sql dice si quedó todo (sólo lee).
-- Se puede volver a correr sin problema.
--
-- Mientras no se corra el paso 3, las ofertas vencidas se ven con el precio de antes
-- pero la compra cobraría el rebajado: por eso no hay que usar fechas hasta terminarlo.
--
-- ---------------------------------------------------------------------------
-- Ofertas con fecha de fin
--
-- Una oferta es un precio bajo (price) con el de antes (old_price, que la tienda
-- muestra tachado). `offer_until` dice hasta cuándo: pasado ese momento vale el
-- precio de antes. No hay un proceso que "termine" la oferta ni hay que acordarse
-- de nada: el precio que vale se calcula en el momento, con precio_vigente().
--
-- OJO: esta regla también está escrita en src/ofertas.mjs (lo que ve el cliente).
-- Si se cambia una, se cambia la otra: la tienda no puede mostrar un precio y la
-- base cobrar otro. tests/ofertas.test.mjs y db/probar-local.sh fijan las dos.
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists offer_until timestamptz;
alter table public.catalog_overrides add column if not exists offer_until timestamptz;

do $$
begin
  -- Un vencimiento sin precio anterior no es una oferta: no habría a qué volver.
  if not exists (select 1 from pg_constraint
                  where conname = 'products_vencimiento_con_oferta'
                    and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_vencimiento_con_oferta
      check (offer_until is null or (old_price is not null and old_price > price));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'catalog_overrides_vencimiento_con_oferta'
                    and conrelid = 'public.catalog_overrides'::regclass) then
    alter table public.catalog_overrides add constraint catalog_overrides_vencimiento_con_oferta
      check (offer_until is null or old_price is not null);
  end if;
end $$;

-- El precio que vale ahora. Con oferta vencida es el de antes; en cualquier otro
-- caso, el precio guardado. `stable` y no `immutable`: depende de la hora.
create or replace function public.precio_vigente(p_price integer, p_old_price integer, p_offer_until timestamptz)
returns integer
language sql stable set search_path = ''
as $$
  select case
    when p_old_price is not null and p_old_price > p_price
         and p_offer_until is not null and p_offer_until <= pg_catalog.now()
    then p_old_price
    else p_price
  end
$$;
grant execute on function public.precio_vigente(integer, integer, timestamptz) to anon, authenticated;
