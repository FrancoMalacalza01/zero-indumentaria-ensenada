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
  brand       text not null default '',
  source_catalog_id text,
  category    text not null check (category in ('Hombre', 'Accesorios')),
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

-- ---------------------------------------------------------------------------
-- Ajustes del catálogo de hombre
-- ---------------------------------------------------------------------------
-- El catálogo de hombre viene armado dentro del sitio (src/men-catalog.json).
-- Esta tabla guarda sólo lo que el local cambia sobre él: un precio propio, la
-- baja de una prenda que no tiene, o una oferta (un precio propio con el precio
-- anterior, que la tienda muestra tachado). Una prenda sin fila se muestra tal
-- como viene. No hay clave foránea: el catálogo no está en la base.
create table if not exists public.catalog_overrides (
  product_id text primary key,
  price      integer check (price is null or (price > 0 and price <= 10000000)),
  old_price  integer check (old_price is null or (old_price > 0 and old_price <= 10000000)),
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint catalog_overrides_oferta
    check (old_price is null or (price is not null and old_price > price))
);

-- Si la tabla ya se había creado antes de que existieran las ofertas, le faltan
-- el precio anterior y su regla. Esto las agrega y no hace nada si ya están.
alter table public.catalog_overrides
  add column if not exists old_price integer
  check (old_price is null or (old_price > 0 and old_price <= 10000000));
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'catalog_overrides_oferta'
       and conrelid = 'public.catalog_overrides'::regclass
  ) then
    alter table public.catalog_overrides
      add constraint catalog_overrides_oferta
      check (old_price is null or (price is not null and old_price > price));
  end if;
end $$;

alter table public.catalog_overrides enable row level security;

-- La tienda necesita leerla para saber qué ocultar y qué precio mostrar.
-- Sólo hay ids, precios y un sí/no: nada que un cliente no pueda ver ya.
drop policy if exists ajustes_publico on public.catalog_overrides;
create policy ajustes_publico on public.catalog_overrides
  for select to anon, authenticated using (true);
drop policy if exists ajustes_admin_alta on public.catalog_overrides;
create policy ajustes_admin_alta on public.catalog_overrides
  for insert to authenticated with check (private.es_admin());
drop policy if exists ajustes_admin_edicion on public.catalog_overrides;
create policy ajustes_admin_edicion on public.catalog_overrides
  for update to authenticated using (private.es_admin()) with check (private.es_admin());
drop policy if exists ajustes_admin_baja on public.catalog_overrides;
create policy ajustes_admin_baja on public.catalog_overrides
  for delete to authenticated using (private.es_admin());

comment on table public.catalog_overrides is
  'Cambios del local sobre el catálogo de hombre: precio propio, bajas y ofertas (old_price es el precio de antes, el que se muestra tachado). Se lee pública a propósito. Una prenda sin fila se muestra como viene.';


-- Complemento para identificar fichas importadas y consultar bajas.
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
