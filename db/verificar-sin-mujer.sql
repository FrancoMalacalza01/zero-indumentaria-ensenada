-- Comprueba que db/sin-mujer.sql quedó aplicado. Sólo lee.
-- Tienen que dar true las tres.
select 'no quedan fichas de mujer' as chequeo,
       not exists (select 1 from public.products where category = 'Mujer') as ok
union all
select 'no queda stock de fichas que no existen',
       not exists (select 1 from public.stock s where not exists (select 1 from public.products p where p.id = s.product_id))
union all
select 'la categoría Mujer ya no se acepta',
       exists (select 1 from pg_constraint
                where conrelid = 'public.products'::regclass and conname = 'products_category_check'
                  and pg_get_constraintdef(oid) not like '%Mujer%');
