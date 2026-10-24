-- Esquema de la base de Zero Indumentaria.
--
-- Esto es el estado al que hay que llegar, armado para poder correrlo de
-- nuevo sin romper nada: sirve para levantar la base de cero, para revisar
-- qué permisos hay sin entrar al panel de Supabase, y para que el repo no
-- dependa de que el proyecto de Supabase siga existiendo.
--
-- Lo que NO está acá: los productos. Los carga el dueño desde el panel.
-- Tampoco los usuarios: se crean en Supabase (Authentication → Users) y se
-- agregan a mano a la tabla `admins`.
--
-- Para correrlo en Supabase: SQL Editor, pegar y ejecutar.

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  category    text not null check (category in ('Hombre', 'Mujer', 'Accesorios')),
  type        text not null,
  price       integer not null check (price >= 0),
  old_price   integer check (old_price >= 0),
  image       text not null,
  images      text[] not null default '{}',
  color       text not null,
  color_hex   text not null,
  sizes       text[] not null default '{}',
  is_new      boolean not null default false,
  active      boolean not null default true,
  description text not null default '',
  -- El orden de la lista lo decide el panel, no el id.
  position    integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- Una fila por talle. Un solo local, un solo stock.
create table if not exists public.stock (
  product_id text not null references public.products (id),
  size       text not null,
  qty        integer not null default 0 check (qty >= 0),
  primary key (product_id, size)
);

-- ---------------------------------------------------------------------------
-- Quién puede escribir
-- ---------------------------------------------------------------------------
-- La regla de fondo: estar logueado NO alcanza. Para escribir hay que estar
-- en esta tabla, que se carga a mano. Si alguna vez quedan los registros
-- abiertos, una cuenta nueva ve lo mismo que un visitante.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nota       text not null default '',
  created_at timestamptz not null default now()
);

-- Una política sobre `admins` que consulte `admins` se muerde la cola, así
-- que la consulta vive en una función que corre con los permisos del dueño de
-- la base. Y vive en un esquema que la API no expone: en `public`, PostgREST
-- la publicaría como /rest/v1/rpc/es_admin.
create schema if not exists private;
grant usage on schema private to authenticated;

-- search_path vacío a propósito: así nadie puede colgarle un esquema propio
-- adelante y hacer que mire otra tabla.
create or replace function private.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;
revoke all on function private.es_admin() from public;
grant execute on function private.es_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Historial y pedidos
-- ---------------------------------------------------------------------------
-- A propósito sin clave foránea a `products`: el historial tiene que
-- sobrevivir a que se borre un producto. Por eso guarda el nombre.
create table if not exists public.movements (
  id           text primary key,
  fecha        timestamptz not null default now(),
  product_id   text not null,
  product_name text not null default '',
  size         text not null,
  delta        integer not null,
  reason       text not null,
  order_id     text,
  created_at   timestamptz not null default now(),
  constraint movements_reason_check check (
    reason in ('Ingreso', 'Venta', 'Ajuste', 'Rotura', 'Devolución')
  )
);
create index if not exists movements_fecha_idx on public.movements (fecha desc);
create index if not exists movements_product_idx on public.movements (product_id);

create table if not exists public.orders (
  id         text primary key,
  fecha      timestamptz not null default now(),
  customer   text not null default '',
  items      jsonb not null default '[]'::jsonb,
  -- `total` es lo que paga el cliente, con envío incluido; `envio` dice
  -- cuánto de eso es el envío, para no tener que recalcularlo después.
  total      integer not null default 0 check (total >= 0),
  envio      integer not null default 0 check (envio >= 0),
  -- El estado del cobro va aparte del estado del pedido: son dos cosas. Un
  -- pedido puede estar pagado y sin preparar, o preparado y sin pagar.
  payment_status text not null default 'sin_pago',
  -- El id que devolvió la pasarela, para cruzarlo con el resumen.
  pago_ref   text,
  -- El mail del cliente y cuándo salió su confirmación. Lo segundo también
  -- evita que la función de mail se use para bombardear a alguien.
  email      text,
  mail_enviado_at timestamptz,
  delivery   text not null default 'pickup',
  zone       text,
  payment    text,
  status     text not null default 'Pendiente',
  created_at timestamptz not null default now(),
  constraint orders_delivery_check check (delivery in ('pickup', 'shipping')),
  constraint orders_status_check check (
    status in ('Pendiente', 'Preparando', 'Listo para retirar', 'Completado',
               -- Un pedido devuelto o cancelado es un estado, no un pedido
               -- borrado: el historial tiene que poder explicar por qué
               -- volvió el stock.
               'Devuelto', 'Cancelado')
  ),
  constraint orders_payment_status_check check (
    payment_status in ('sin_pago', 'pendiente', 'aprobado', 'rechazado', 'devuelto')
  )
);
create index if not exists orders_fecha_idx on public.orders (fecha desc);
create index if not exists orders_pago_idx on public.orders (payment_status);

-- Los números de pedido los da la base, no el navegador.
create sequence if not exists public.pedidos_web_seq;

-- ---------------------------------------------------------------------------
-- Configuración del local
-- ---------------------------------------------------------------------------
-- Lo que el dueño carga desde el panel y antes vivía en el código: whatsapp,
-- dirección, formas de pago, zonas de envío y política de devoluciones.
-- Una sola fila: es configuración del local, no una lista de cosas.
--
-- OJO: se lee pública, porque la tienda necesita mostrar los alias y las
-- zonas. No guardar acá nada que no pueda ver un cliente.
create table if not exists public.settings (
  id         text primary key default 'local' check (id = 'local'),
  datos      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, datos) values ('local', '{}'::jsonb)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
alter table public.products  enable row level security;
alter table public.stock     enable row level security;
alter table public.admins    enable row level security;
alter table public.movements enable row level security;
alter table public.orders    enable row level security;
alter table public.settings  enable row level security;

-- Leer el catálogo publicado: cualquiera, sin cuenta. Es una tienda.
drop policy if exists catalogo_publico on public.products;
create policy catalogo_publico on public.products
  for select to anon, authenticated using (active);

drop policy if exists stock_publico on public.stock;
create policy stock_publico on public.stock
  for select to anon, authenticated using (
    exists (select 1 from public.products p
             where p.id = stock.product_id and p.active)
  );

-- El panel ve también lo despublicado, que la tienda no muestra; si no, no
-- habría forma de volver a publicarlo.
drop policy if exists productos_admin_lectura on public.products;
create policy productos_admin_lectura on public.products
  for select to authenticated using (private.es_admin());
drop policy if exists productos_admin_alta on public.products;
create policy productos_admin_alta on public.products
  for insert to authenticated with check (private.es_admin());
drop policy if exists productos_admin_edicion on public.products;
create policy productos_admin_edicion on public.products
  for update to authenticated using (private.es_admin()) with check (private.es_admin());
drop policy if exists productos_admin_baja on public.products;
create policy productos_admin_baja on public.products
  for delete to authenticated using (private.es_admin());

drop policy if exists stock_admin_lectura on public.stock;
create policy stock_admin_lectura on public.stock
  for select to authenticated using (private.es_admin());
drop policy if exists stock_admin_alta on public.stock;
create policy stock_admin_alta on public.stock
  for insert to authenticated with check (private.es_admin());
drop policy if exists stock_admin_edicion on public.stock;
create policy stock_admin_edicion on public.stock
  for update to authenticated using (private.es_admin()) with check (private.es_admin());
drop policy if exists stock_admin_baja on public.stock;
create policy stock_admin_baja on public.stock
  for delete to authenticated using (private.es_admin());

-- Un admin ve la lista de admins. Nadie más, ni para leer.
drop policy if exists admins_lectura on public.admins;
create policy admins_lectura on public.admins
  for select to authenticated using (private.es_admin());

-- El historial dice cuánto entra y cuánto se vende; los pedidos tienen datos
-- de clientes. Ninguna de las dos es pública.
drop policy if exists movimientos_admin on public.movements;
create policy movimientos_admin on public.movements
  for all to authenticated using (private.es_admin()) with check (private.es_admin());
drop policy if exists pedidos_admin on public.orders;
create policy pedidos_admin on public.orders
  for all to authenticated using (private.es_admin()) with check (private.es_admin());

-- La configuración la lee cualquiera (son los alias y las zonas que el
-- cliente necesita ver) y la escribe sólo un admin.
drop policy if exists settings_publico on public.settings;
create policy settings_publico on public.settings
  for select to anon, authenticated using (true);
drop policy if exists settings_admin_edicion on public.settings;
create policy settings_admin_edicion on public.settings
  for update to authenticated using (private.es_admin()) with check (private.es_admin());

comment on table public.settings is
  'Configuración del local. Se lee pública a propósito: la tienda muestra los alias y las zonas. No guardar secretos acá.';
comment on table public.admins is
  'Quiénes pueden escribir. Estar logueado no alcanza: hay que estar en esta tabla.';
comment on function private.es_admin() is
  'true si el usuario de la sesión está en admins. La usan todas las políticas de escritura.';
comment on table public.movements is
  'Cada cambio de stock deja rastro. Sin clave foránea a products a propósito: el historial sobrevive al borrado de un producto, por eso guarda el nombre.';
comment on table public.orders is
  'Pedidos de la tienda. Privado: tiene datos de clientes.';

-- ---------------------------------------------------------------------------
-- Cancelar un pedido
-- ---------------------------------------------------------------------------
-- La compra descuenta el stock al crearse, que es lo que evita sobrevender.
-- Esto es el otro lado: un pedido que nadie paga tiene que poder devolver sus
-- unidades. Las tres cosas pasan juntas —el stock vuelve, queda el movimiento
-- y el pedido cambia de estado— porque de a una, un corte en el medio dejaría
-- el stock devuelto y el pedido todavía activo.
--
-- Solo admins, e idempotente: cancelar dos veces no devuelve el stock dos
-- veces, porque mira el estado antes de tocar nada.
create or replace function public.cancelar_pedido(p_id text, p_motivo text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_pedido public.orders;
  v_items  jsonb;
begin
  if not private.es_admin() then
    return jsonb_build_object('error', 'No tenés permiso para cancelar pedidos.');
  end if;

  select * into v_pedido from public.orders where id = p_id for update;
  if not found then
    return jsonb_build_object('error', 'No encontramos ese pedido.');
  end if;
  if v_pedido.status in ('Cancelado', 'Devuelto') then
    return jsonb_build_object(
      'error', format('El pedido ya está %s.', lower(v_pedido.status)));
  end if;

  v_items := v_pedido.items;

  insert into public.stock (product_id, size, qty)
  select it->>'productId', it->>'size', (it->>'quantity')::int
    from jsonb_array_elements(v_items) it
   where exists (select 1 from public.products p where p.id = it->>'productId')
  on conflict (product_id, size)
    do update set qty = public.stock.qty + excluded.qty;

  insert into public.movements (id, fecha, product_id, product_name, size, delta, reason, order_id)
  select p_id || '-cancel-' || (ord - 1),
         now(),
         it->>'productId',
         it->>'name',
         it->>'size',
         (it->>'quantity')::int,
         'Devolución',
         p_id
    from jsonb_array_elements(v_items) with ordinality as t(it, ord)
  on conflict (id) do nothing;

  update public.orders
     set status = 'Cancelado',
         payment_status = case
           when payment_status = 'aprobado' then 'devuelto'
           else 'rechazado'
         end
   where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'unidades', (select coalesce(sum((it->>'quantity')::int), 0)
                   from jsonb_array_elements(v_items) it),
    'motivo', p_motivo);
end;
$fn$;

revoke all on function public.cancelar_pedido(text, text) from public;
grant execute on function public.cancelar_pedido(text, text) to authenticated;

comment on function public.cancelar_pedido(text, text) is
  'Cancela un pedido y devuelve su stock en un solo paso. Solo admins. Idempotente.';
