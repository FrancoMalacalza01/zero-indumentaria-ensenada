-- Saca de la base todo lo de mujer: el local no vende ropa de mujer por ahora.
-- Borra las fichas de la categoría 'Mujer' y su stock, y deja de aceptar esa
-- categoría para que no se vuelva a cargar. El historial de movimientos y los
-- pedidos no se tocan: no tienen clave foránea a propósito, porque son el
-- registro de lo que pasó. Se puede correr más de una vez.
-- Para correrlo en Supabase: SQL Editor, pegar y ejecutar.
-- Para comprobar: db/verificar-sin-mujer.sql
-- IMPORTANTE: correrlo ANTES de publicar el código que ya no conoce 'Mujer'.
-- Si quedara una ficha de mujer, ese código la mostraría como de Hombre.
begin;
delete from public.stock
 where product_id in (select id from public.products where category = 'Mujer');
delete from public.products where category = 'Mujer';
alter table public.products drop constraint if exists products_category_check;
alter table public.products
  add constraint products_category_check check (category in ('Hombre', 'Accesorios'));
commit;
