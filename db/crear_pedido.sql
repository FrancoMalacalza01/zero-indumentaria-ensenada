-- La compra, hecha por la base en un solo paso.
--
-- Por qué está acá y no en el navegador: dos personas comprando la última
-- prenda al mismo tiempo. Si la cuenta la hace el navegador, los dos leen
-- "queda 1", los dos compran y el local vendió algo que no tiene. Acá la fila
-- del stock queda trabada mientras se resuelve el pedido: el segundo espera,
-- lee lo que quedó y rebota con el motivo exacto.
--
-- Dos cosas más que importan:
--
-- 1. Los precios los pone esta función, leyéndolos de la base. No viajan
--    desde el navegador. Si alguien edita el pedido antes de mandarlo, cambia
--    lo que pide, no lo que paga.
-- 2. Todo o nada. Un pedido de tres prendas donde la tercera no alcanza deja
--    el stock de las dos primeras como estaba.
--
-- La puede llamar cualquiera que entre a la tienda, sin cuenta: es la única
-- forma de que un cliente compre. Por eso valida todo adentro y por eso tiene
-- topes y un freno por minuto.
--
-- Devuelve {"order": {...}} o {"error": "motivo en castellano"}.

create or replace function public.crear_pedido(
  p_items   jsonb,
  p_cliente text,
  p_entrega text,
  p_zona    text default null,
  p_pago    text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_cliente  text := btrim(coalesce(p_cliente, ''));
  v_zona     text := btrim(coalesce(p_zona, ''));
  v_lineas   int;
  v_unidades int := 0;
  v_total    int := 0;
  v_items    jsonb := '[]'::jsonb;
  v_id       text;
  v_fecha    timestamptz := now();
  l          record;
  v_p        record;
  v_hay      int;
  v_cfg      jsonb;
  v_zonas    jsonb;
  v_envio    int := 0;
  v_gratis   int;
  v_costo    text;
begin
  -- Lo que se puede rechazar sin tocar nada, se rechaza antes de tocar nada.
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'El pedido llegó vacío.');
  end if;
  if v_cliente = '' then
    return jsonb_build_object('error', 'Falta el nombre de quien compra.');
  end if;
  if p_entrega not in ('pickup', 'shipping') then
    return jsonb_build_object('error', 'La forma de entrega no es válida.');
  end if;
  if p_entrega = 'shipping' and v_zona = '' then
    return jsonb_build_object('error', 'Falta la zona de envío.');
  end if;
  if p_pago is not null and p_pago not in
     -- 'tarjeta' queda por los pedidos viejos, de cuando debito y credito
     -- eran una sola opcion.
     ('mercadopago', 'cuentadni', 'transferencia', 'efectivo',
      'debito', 'credito', 'tarjeta') then
    return jsonb_build_object('error', 'La forma de pago no es válida.');
  end if;
  v_cliente := left(v_cliente, 80);
  v_zona := left(v_zona, 60);

  -- La configuracion del local: zonas de envio y desde cuanto sale gratis.
  select datos into v_cfg from public.settings where id = 'local';
  v_zonas := coalesce(v_cfg->'envio'->'zonas', '[]'::jsonb);
  -- Si el local tiene zonas cargadas, la zona del pedido tiene que ser una de
  -- ellas. Si todavia no cargo ninguna, se acepta lo que venga, como antes.
  if p_entrega = 'shipping' and jsonb_array_length(v_zonas) > 0
     and not exists (select 1 from jsonb_array_elements(v_zonas) z
                      where z->>'nombre' = v_zona) then
    return jsonb_build_object('error', 'No hacemos envíos a esa zona.');
  end if;

  select count(distinct (x->>'productId', x->>'size')) into v_lineas
    from jsonb_array_elements(p_items) x;
  if v_lineas > 40 then
    return jsonb_build_object('error', 'El pedido tiene demasiados renglones.');
  end if;

  -- Freno de mano. Esta función la puede llamar cualquiera que entre a la
  -- tienda, y descuenta stock: un script podría dejar el local en cero sin
  -- comprar nada. Diez pedidos por minuto no le molestan a nadie que esté
  -- comprando de verdad, y a un script lo cortan en seco.
  if (select count(*) from public.orders
        where fecha > v_fecha - interval '1 minute') >= 10 then
    return jsonb_build_object(
      'error', 'Hay muchos pedidos entrando ahora mismo. Probá de nuevo en un minuto.');
  end if;

  -- De acá en adelante sí se escribe, así que un problema tiene que deshacer
  -- todo lo anterior. Por eso se levanta una excepción en vez de devolver:
  -- este bloque es un punto de retorno, y devolver a secas dejaría el stock
  -- descontado a medias.
  begin
    for l in
      select (x->>'productId')::text as product_id,
             (x->>'size')::text      as size,
             -- Nada de castear a ciegas lo que manda el navegador: un
             -- "quantity": "muchas" reventaba la función con un error crudo
             -- de Postgres. Lo que no sea un número entra como -1 y lo
             -- rechaza el control de abajo, con un motivo en castellano.
             sum(
               case
                 when (x->>'quantity') ~ '^[0-9]+(\.[0-9]+)?$'
                   then trunc((x->>'quantity')::numeric)::int
                 else -1
               end
             ) as cantidad
        from jsonb_array_elements(p_items) x
       group by 1, 2
       -- Orden fijo: dos pedidos al mismo tiempo se traban en el mismo
       -- sentido y no se quedan esperándose uno al otro para siempre.
       order by 1, 2
    loop
      if l.product_id is null or l.size is null or l.size = '' then
        raise exception using errcode = 'P0001',
          message = 'Uno de los renglones del pedido está incompleto.';
      end if;
      if l.cantidad <= 0 then
        raise exception using errcode = 'P0001',
          message = 'Hay una cantidad que no se entiende.';
      end if;
      if l.cantidad > 20 then
        raise exception using errcode = 'P0001',
          message = 'Para llevar más de 20 unidades de un talle, escribinos.';
      end if;
      v_unidades := v_unidades + l.cantidad;

      -- El precio sale de la base, nunca de lo que mandó el navegador.
      -- precio_vigente: una oferta con fecha de fin que ya pasó cobra el precio de antes.
      -- Es la misma regla con la que la tienda muestra el precio (src/ofertas.mjs).
      select p.id, p.name, public.precio_vigente(p.price, p.old_price, p.offer_until) as price,
             p.image, p.sizes, p.active
        into v_p
        from public.products p
       where p.id = l.product_id;
      if not found or not v_p.active then
        raise exception using errcode = 'P0001',
          message = 'Una de las prendas ya no está disponible.';
      end if;
      if not (l.size = any(v_p.sizes)) then
        raise exception using errcode = 'P0001',
          message = format('El talle %s ya no está en %s.', l.size, v_p.name);
      end if;

      -- Acá es donde se juega todo: la fila del stock queda trabada hasta el
      -- final. El segundo pedido espera, y cuando entra lee lo que quedó.
      select s.qty into v_hay
        from public.stock s
       where s.product_id = l.product_id and s.size = l.size
         for update;
      if not found then
        v_hay := 0;
      end if;
      if v_hay < l.cantidad then
        raise exception using errcode = 'P0001',
          message = format('Quedan %s de %s talle %s.', v_hay, v_p.name, l.size);
      end if;

      update public.stock
         set qty = qty - l.cantidad
       where product_id = l.product_id and size = l.size;

      v_total := v_total + v_p.price * l.cantidad;
      -- El nombre, el precio y la foto quedan copiados en el pedido: dentro
      -- de un mes el producto puede cambiar y el pedido tiene que seguir
      -- diciendo qué se vendió y a cuánto.
      v_items := v_items || jsonb_build_object(
        'productId', v_p.id,
        'size',      l.size,
        'quantity',  l.cantidad,
        'name',      v_p.name,
        'price',     v_p.price,
        'image',     v_p.image);
    end loop;

    if v_unidades > 50 then
      raise exception using errcode = 'P0001',
        message = 'Es un pedido muy grande para la web; escribinos y lo armamos.';
    end if;

    -- El envio, recien ahora que se sabe el subtotal. Una zona sin costo
    -- cargado vale cero: el checkout dice que se coordina por WhatsApp, y es
    -- mejor eso que inventarle un numero al cliente.
    if p_entrega = 'shipping' then
      select z->>'costo' into v_costo
        from jsonb_array_elements(v_zonas) z
       where z->>'nombre' = v_zona
       limit 1;
      if v_costo ~ '^[0-9]+$' then
        v_envio := v_costo::int;
      end if;
      v_gratis := case
        when (v_cfg->'envio'->>'envioGratisDesde') ~ '^[0-9]+$'
          then (v_cfg->'envio'->>'envioGratisDesde')::int
        else null
      end;
      -- El umbral se mira contra las prendas, no contra el total con envio:
      -- si no, el propio envio ayudaria a alcanzarlo.
      if v_gratis is not null and v_gratis > 0 and v_total >= v_gratis then
        v_envio := 0;
      end if;
    end if;

    v_id := 'M-' || lpad(nextval('public.pedidos_web_seq')::text, 5, '0');

    insert into public.orders (id, fecha, customer, items, total, envio, delivery, zone, payment, status)
    values (v_id, v_fecha, v_cliente, v_items, v_total + v_envio, v_envio, p_entrega,
            case when p_entrega = 'shipping' then v_zona end,
            p_pago, 'Pendiente');

    insert into public.movements (id, fecha, product_id, product_name, size, delta, reason, order_id)
    select v_id || '-' || (ord - 1),
           v_fecha,
           it->>'productId',
           it->>'name',
           it->>'size',
           -((it->>'quantity')::int),
           'Venta',
           v_id
      from jsonb_array_elements(v_items) with ordinality as t(it, ord);

  exception
    when sqlstate 'P0001' then
      -- El bloque se deshace solo: no quedó stock descontado ni pedido a medias.
      return jsonb_build_object('error', sqlerrm);
    when others then
      -- Red de contención: un error que no previmos no tiene que llegarle al
      -- cliente como un mensaje de Postgres, ni dejar medio pedido hecho.
      raise warning 'crear_pedido falló: % (%)', sqlerrm, sqlstate;
      return jsonb_build_object(
        'error', 'No pudimos tomar el pedido. Escribinos por WhatsApp y lo resolvemos.');
  end;

  return jsonb_build_object('order', jsonb_build_object(
    'id',       v_id,
    'date',     to_char(v_fecha at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'items',    v_items,
    -- `subtotal` son las prendas; `total` es lo que paga, con envio.
    'subtotal', v_total,
    'envio',    v_envio,
    'total',    v_total + v_envio,
    'delivery', p_entrega,
    'status',   'Pendiente',
    'customer', v_cliente,
    'payment',  p_pago,
    'zone',     case when p_entrega = 'shipping' then v_zona end));
end;
$fn$;

revoke all on function public.crear_pedido(jsonb, text, text, text, text) from public;
grant execute on function public.crear_pedido(jsonb, text, text, text, text) to anon;
grant execute on function public.crear_pedido(jsonb, text, text, text, text) to authenticated;

comment on function public.crear_pedido(jsonb, text, text, text, text) is
  'Crea un pedido y descuenta el stock en un solo paso. Devuelve {order} o {error}. Los precios salen de la base; el navegador solo dice qué y cuánto.';
