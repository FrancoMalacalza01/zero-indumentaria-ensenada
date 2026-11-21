-- Factura y dirección de entrega en el pedido.
--
-- Ejecutar en el SQL Editor de Supabase, DESPUÉS de revisarlo, y en este orden:
--   1. este archivo (agrega las columnas al pedido),
--   2. db/crear_pedido.sql (la compra recibe y valida la factura, el mail y la dirección).
-- Después, db/verificar-factura-y-direccion.sql dice si quedó todo (sólo lee). Se puede volver a correr.
--
-- IMPORTANTE: correr estos dos ANTES de publicar la tienda nueva. La tienda nueva manda datos que la
-- función vieja no conoce, y la compra fallaría hasta que se corran.
alter table public.orders add column if not exists factura boolean not null default false;
alter table public.orders add column if not exists direccion jsonb;
alter table public.orders add column if not exists email text;

comment on column public.orders.factura is 'El cliente pidió factura: el mail es obligatorio y ahí se le manda.';
comment on column public.orders.direccion is 'Dirección de entrega de un envío a domicilio: calle, numero, piso, localidad, cp, referencia.';
