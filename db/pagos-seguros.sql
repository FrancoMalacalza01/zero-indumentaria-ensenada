-- Pagos más seguros y pedidos que no traban el stock.
--
-- Ejecutar en el SQL Editor de Supabase, DESPUÉS de revisarlo, y en este orden:
--   1. este archivo (columnas y funciones nuevas),
--   2. db/crear_pedido.sql (la compra devuelve un código de pago y libera el stock vencido).
-- Después, db/verificar-pagos-seguros.sql dice si quedó todo (sólo lee). Se puede volver a correr.
--
-- Y hay que volver a desplegar la función `payway-pagar` (supabase/functions/payway-pagar),
-- que ahora pide ese código de pago.
--
-- QUÉ ARREGLA
--
-- 1. Cualquiera podía mandarle a la función de cobro el número de un pedido ajeno y un token de tarjeta
--    (los números de pedido son correlativos: M-00012, M-00013…). Servía para "probar" tarjetas robadas.
--    Ahora cada pedido nace con un **código de pago** al azar que sólo recibe quien lo hizo, y cobrar
--    exige ese código. Además cada pedido admite un máximo de intentos de cobro.
-- 2. Un script podía crear pedidos sin pagarlos y dejar el local sin stock (cada pedido descuenta las
--    unidades). Ahora un pedido **sin pagar vence solo** (48 horas de fábrica, se cambia desde el
--    panel) y devuelve el stock. Eso vale para los pedidos de pago online (tarjeta, Mercado Pago); los de
--    efectivo o transferencia los sigue cancelando una persona, porque pueden tardar legítimamente.

alter table public.orders add column if not exists pago_token text;
alter table public.orders add column if not exists pago_intentos integer not null default 0;

comment on column public.orders.pago_token is
  'Código al azar que recibe sólo quien hizo el pedido y que hace falta para cobrarlo. No se muestra en la tienda ni se manda por mail.';

-- Ayuda a encontrar rápido los pedidos que pueden vencer.
create index if not exists orders_pendientes_idx on public.orders (fecha) where status = 'Pendiente';

-- ---------------------------------------------------------------------------
-- Vencimiento de pedidos sin pagar
-- ---------------------------------------------------------------------------
-- Cancela los pedidos que siguen "Pendiente" y sin pagar pasadas N horas, devolviendo las unidades al
-- stock y dejando el movimiento (lo mismo que hace cancelar_pedido, pero sin pedir ser admin: lo llama
-- la compra y, si hace falta, un horario programado). N sale de la configuración
-- (`pedidos.vencenEnHoras`); sin dato, 48; con 0, los pedidos no vencen.
--
-- NO toca: pedidos de efectivo, transferencia o pago en el local, pedidos ya pagados, con un cobro en revisión, ni los que el local ya empezó a preparar.
create or replace function public.vencer_pedidos_sin_pago()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_horas integer;
  v_n     integer := 0;
  r       record;
begin
  select case
           when (datos->'pedidos'->>'vencenEnHoras') ~ '^[0-9]{1,4}$'
             then (datos->'pedidos'->>'vencenEnHoras')::integer
           else 48
         end
    into v_horas
    from public.settings
   where id = 'local';
  v_horas := coalesce(v_horas, 48);
  if v_horas <= 0 then
    return 0;
  end if;

  for r in
    select id, items
      from public.orders
     where status = 'Pendiente'
       and payment_status in ('sin_pago', 'rechazado')
       -- Sólo los de pago online. Los de efectivo o transferencia se arreglan con el local y pueden
       -- tardar: esos los cancela una persona desde el panel.
       and payment in ('mercadopago', 'credito', 'debito')
       and fecha < now() - pg_catalog.make_interval(hours => v_horas)
       for update skip locked
  loop
    insert into public.stock (product_id, size, qty)
    select it->>'productId', it->>'size', (it->>'quantity')::int
      from pg_catalog.jsonb_array_elements(r.items) it
     where exists (select 1 from public.products p where p.id = it->>'productId')
    on conflict (product_id, size)
      do update set qty = public.stock.qty + excluded.qty;

    insert into public.movements (id, fecha, product_id, product_name, size, delta, reason, order_id)
    select r.id || '-vence-' || (ord - 1),
           now(),
           it->>'productId',
           it->>'name',
           it->>'size',
           (it->>'quantity')::int,
           'Devolución',
           r.id
      from pg_catalog.jsonb_array_elements(r.items) with ordinality as t(it, ord)
    on conflict (id) do nothing;

    update public.orders
       set status = 'Cancelado',
           payment_status = 'rechazado'
     where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$fn$;

revoke all on function public.vencer_pedidos_sin_pago() from public, anon, authenticated;

comment on function public.vencer_pedidos_sin_pago() is
  'Cancela los pedidos sin pagar que pasaron las horas de la configuración y devuelve su stock. La llama crear_pedido; no es pública.';

-- ---------------------------------------------------------------------------
-- Reservar el cobro de un pedido
-- ---------------------------------------------------------------------------
-- Lo único que le permite a la función `payway-pagar` empezar a cobrar. Todo en una sola operación
-- (con el pedido trabado): que exista, que el código de pago sea el suyo, que siga activo, que no esté
-- pagado ni con un cobro en curso, que sea reciente, que no haya agotado sus intentos. Si pasa, lo deja
-- "pendiente" y cuenta el intento. Sólo la puede llamar la función del servidor (service_role).
create or replace function public.reservar_cobro(p_pedido text, p_codigo text, p_tx text, p_max_intentos integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_pedido for update;
  -- Pedido inexistente y código equivocado dan la MISMA respuesta: no se puede usar esto para ir
  -- descubriendo qué números de pedido existen.
  if not found or v.pago_token is null or p_codigo is null or v.pago_token <> p_codigo then
    return jsonb_build_object('error', 'no_encontrado');
  end if;
  if v.status in ('Cancelado', 'Devuelto') then
    return jsonb_build_object('error', 'inactivo');
  end if;
  if v.payment_status = 'aprobado' then
    return jsonb_build_object('error', 'pagado');
  end if;
  if v.payment_status not in ('sin_pago', 'rechazado') then
    return jsonb_build_object('error', 'en_curso');
  end if;
  if v.fecha < now() - interval '2 hours' then
    return jsonb_build_object('error', 'vencido');
  end if;
  if v.pago_intentos >= p_max_intentos then
    return jsonb_build_object('error', 'intentos');
  end if;
  if v.total <= 0 then
    return jsonb_build_object('error', 'monto');
  end if;

  update public.orders
     set payment_status = 'pendiente',
         pago_ref = 'payway-tx:' || p_tx,
         pago_intentos = pago_intentos + 1
   where id = p_pedido;

  return jsonb_build_object('ok', true, 'total', v.total, 'id', v.id);
end;
$fn$;

revoke all on function public.reservar_cobro(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.reservar_cobro(text, text, text, integer) to service_role;

comment on function public.reservar_cobro(text, text, text, integer) is
  'Reserva un pedido para cobrarlo (código de pago, estado, antigüedad, intentos) en un solo paso. Sólo service_role.';
