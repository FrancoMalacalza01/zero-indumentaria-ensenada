#!/usr/bin/env bash
# Levanta un Postgres de juguete, arma la base con los archivos de esta
# carpeta y prueba lo único que no se puede probar con una sola conexión:
# dos personas comprando la última prenda al mismo tiempo.
#
#   ./db/probar-local.sh
#
# Necesita PostgreSQL instalado (initdb, pg_ctl, psql) y correr como un
# usuario común: Postgres se niega a arrancar como root. No toca la base de
# producción: arma una aparte en una carpeta temporal y la borra al terminar.
set -euo pipefail

BIN=${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}
RAIZ=$(mktemp -d)
PUERTO=${PG_PORT:-5440}
AQUI=$(cd "$(dirname "$0")" && pwd)
limpiar() {
  "$BIN/pg_ctl" -D "$RAIZ/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$RAIZ"
}
trap limpiar EXIT

psqlm() { psql -h "$RAIZ" -p "$PUERTO" -U postgres -d mistral -tA "$@"; }

echo "→ armando un Postgres en $RAIZ"
"$BIN/initdb" -D "$RAIZ/data" -U postgres --auth=trust >"$RAIZ/initdb.log" 2>&1
"$BIN/pg_ctl" -D "$RAIZ/data" -o "-p $PUERTO -k $RAIZ" -l "$RAIZ/pg.log" start >/dev/null
psql -h "$RAIZ" -p "$PUERTO" -U postgres -qc "create database mistral"

# Lo mínimo de Supabase que el esquema necesita. En producción ya existe.
psqlm -q -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon, authenticated;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
SQL

echo "→ aplicando esquema.sql y crear_pedido.sql"
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/esquema.sql" 2>/dev/null
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/crear_pedido.sql" 2>/dev/null
echo "→ aplicando pagos-seguros.sql (también sobre una base que ya lo tiene)"
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/pagos-seguros.sql" 2>/dev/null
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/pagos-seguros.sql" 2>/dev/null
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/crear_pedido.sql" 2>/dev/null
echo "→ aplicando ofertas-con-vencimiento.sql (también sobre una base que ya lo tiene)"
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/ofertas-con-vencimiento.sql" 2>/dev/null
echo "→ y de nuevo, para ver que se puede volver a correr"
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/esquema.sql" 2>/dev/null
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/crear_pedido.sql" 2>/dev/null

echo "→ el verificador de ofertas con vencimiento: todo en true"
falla=$(psqlm -F '|' -f "$AQUI/verificar-ofertas-con-vencimiento.sql" | grep -c '|f$' || true)
if [ "$falla" != "0" ]; then echo "✘ el verificador de ofertas marca $falla chequeos en false"; exit 1; fi
echo "→ comprobando catálogo editable y permisos"
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/probar-catalogo-editable.sql"

psqlm -q <<'SQL'
insert into public.products (id,name,category,type,price,image,color,color_hex,sizes)
values ('a','Campera Última','Hombre','Campera',100000,'/a.webp','Azul','#132457',array['M']);
insert into public.stock (product_id,size,qty) values ('a','M',4);
SQL

echo
echo "→ diez compradores a la vez, cuatro unidades"
for i in $(seq 1 10); do
  psqlm -c "select public.crear_pedido(
    '[{\"productId\":\"a\",\"size\":\"M\",\"quantity\":1}]'::jsonb,
    'Comprador $i','pickup')::text" > "$RAIZ/c$i.out" 2>&1 &
done
wait
cat "$RAIZ"/c*.out | sed 's/{"order".*/compró/; s/{"error": "\(.*\)"}/rebotó: \1/' | sort | uniq -c

echo
echo "→ el envío: zonas, costo y el gratis por monto"
psqlm -q <<'SQL'
update public.settings set datos = jsonb_build_object(
  'envio', jsonb_build_object(
    'envioGratisDesde', 99999,
    'zonas', jsonb_build_array(
      jsonb_build_object('nombre','Ensenada','costo',0),
      jsonb_build_object('nombre','Resto de la Provincia de Buenos Aires','costo',8000)
    )
  )
) where id = 'local';
insert into public.products (id,name,category,type,price,image,color,color_hex,sizes)
values ('e','Remera Envío','Hombre','Remera',30000,'/e.webp','Azul','#132457',array['M']),
       ('f','Campera Caro','Hombre','Campera',120000,'/f.webp','Azul','#132457',array['M']);
insert into public.stock (product_id,size,qty) values ('e','M',10),('f','M',10);
SQL
envio_cerca=$(psqlm -c "select (public.crear_pedido(
  '[{\"productId\":\"e\",\"size\":\"M\",\"quantity\":1}]'::jsonb,
  'Vecina','shipping','Ensenada')->'order'->>'envio')")
envio_lejos=$(psqlm -c "select (public.crear_pedido(
  '[{\"productId\":\"e\",\"size\":\"M\",\"quantity\":1}]'::jsonb,
  'Lejana','shipping','Resto de la Provincia de Buenos Aires')->'order'->>'envio')")
total_lejos=$(psqlm -c "select total from public.orders order by fecha desc, id desc limit 1")
envio_gratis=$(psqlm -c "select (public.crear_pedido(
  '[{\"productId\":\"f\",\"size\":\"M\",\"quantity\":1}]'::jsonb,
  'Compra grande','shipping','Resto de la Provincia de Buenos Aires')->'order'->>'envio')")
zona_rara=$(psqlm -c "select public.crear_pedido(
  '[{\"productId\":\"e\",\"size\":\"M\",\"quantity\":1}]'::jsonb,
  'De otra provincia','shipping','Ushuaia')->>'error'")
echo "Ensenada (costo 0): envío \$$envio_cerca"
echo "Resto de la provincia, \$30.000 de prendas: envío \$$envio_lejos · total \$$total_lejos"
echo "Resto de la provincia, \$120.000 de prendas: envío \$$envio_gratis"
echo "Zona que el local no cubre: $zona_rara"
if [ "$envio_cerca" = "0" ] && [ "$envio_lejos" = "8000" ] && \
   [ "$total_lejos" = "38000" ] && [ "$envio_gratis" = "0" ] && \
   [ "$zona_rara" = "No hacemos envíos a esa zona." ]; then
  echo "✔ el envío se cobra, se suma al total y se regala pasando el umbral"
else
  echo "✘ el envío no está saliendo como debería"
  exit 1
fi

echo
echo "→ ofertas con fecha de fin: lo que se cobra"
# El freno de diez pedidos por minuto no tiene que cortar esta prueba: se "envejecen" los de antes.
psqlm -q -c "update public.orders set fecha = fecha - interval '10 minutes'"
psqlm -q <<'SQL'
insert into public.products (id,name,category,type,price,old_price,offer_until,image,color,color_hex,sizes)
values ('of1','Oferta vigente','Hombre','Remera',8000,10000, now() + interval '2 days','/o.webp','Azul','#132457',array['M']),
       ('of2','Oferta vencida','Hombre','Remera',8000,10000, now() - interval '1 minute','/o.webp','Azul','#132457',array['M']),
       ('of3','Oferta sin fecha','Hombre','Remera',8000,10000, null,'/o.webp','Azul','#132457',array['M']),
       ('of4','Sin oferta','Hombre','Remera',8000,null, null,'/o.webp','Azul','#132457',array['M']);
insert into public.stock (product_id,size,qty) values ('of1','M',9),('of2','M',9),('of3','M',9),('of4','M',9);
SQL
cobra() { psqlm -c "select (public.crear_pedido(
  '[{\"productId\":\"$1\",\"size\":\"M\",\"quantity\":1}]'::jsonb,
  'Oferta $1','pickup')->'order'->'items'->0->>'price')"; }
c1=$(cobra of1); c2=$(cobra of2); c3=$(cobra of3); c4=$(cobra of4)
echo "vigente: \$$c1 · vencida: \$$c2 · sin fecha: \$$c3 · sin oferta: \$$c4"
if [ "$c1" = "8000" ] && [ "$c2" = "10000" ] && [ "$c3" = "8000" ] && [ "$c4" = "8000" ]; then
  echo "✔ la oferta vencida cobra el precio de antes; las demás, lo que dicen"
else
  echo "✘ el precio cobrado no coincide con la regla de las ofertas"
  exit 1
fi
total_vencida=$(psqlm -c "select total from public.orders where customer='Oferta of2'")
if [ "$total_vencida" != "10000" ]; then echo "✘ el total del pedido no usa el precio vigente: $total_vencida"; exit 1; fi
# La base y la tienda tienen que decir lo mismo: los mismos casos que tests/ofertas.test.mjs.
casos=$(psqlm -c "select concat_ws(',',
  public.precio_vigente(80,100, now() + interval '1 day')::text,
  public.precio_vigente(80,100, now() - interval '1 day')::text,
  public.precio_vigente(80,100,null)::text,
  public.precio_vigente(80,null, now() - interval '1 day')::text,
  public.precio_vigente(80,80, now() - interval '1 day')::text,
  public.precio_vigente(80,50,null)::text)")
if [ "$casos" = "80,100,80,80,80,80" ]; then
  echo "✔ precio_vigente coincide con la regla de la tienda en los casos de borde"
else
  echo "✘ precio_vigente difiere de src/ofertas.mjs: $casos"
  exit 1
fi
rechaza_venc=$(psqlm -c "insert into public.products (id,name,category,type,price,offer_until,image,color,color_hex,sizes) values ('z','Z','Hombre','Remera',100,now(),'/z','a','#000',array['M'])" 2>&1 || true)
case "$rechaza_venc" in *products_vencimiento_con_oferta*) echo "✔ no se guarda un vencimiento sin precio anterior";; *) echo "✘ aceptó un vencimiento sin oferta: $rechaza_venc"; exit 1;; esac

echo
compraron=$(psqlm -c "select count(*) from public.orders where customer like 'Comprador%'")
quedan=$(psqlm -c "select qty from public.stock where product_id='a'")
deltas=$(psqlm -c "select coalesce(sum(delta),0) from public.movements where product_id='a'")
echo
echo "pedidos: $compraron · stock final: $quedan · suma de movimientos: $deltas"
if [ "$compraron" = "4" ] && [ "$quedan" = "0" ] && [ "$deltas" = "-4" ]; then
  echo "✔ se vendieron exactamente las cuatro que había, ni una más"
else
  echo "✘ la cuenta no cierra: se vendió algo que no estaba"
  exit 1
fi

echo
echo "→ pagos seguros: código de pago, intentos y vencimiento"
psqlm -q -c "update public.orders set fecha = fecha - interval '10 minutes'"
psqlm -q <<'SQL'
insert into public.products (id,name,category,type,price,image,color,color_hex,sizes)
values ('ps','Prenda pagos','Hombre','Remera',5000,'/p.webp','Azul','#132457',array['M']);
insert into public.stock (product_id,size,qty) values ('ps','M',10);
SQL
nuevo() { psqlm -c "select public.crear_pedido('[{\"productId\":\"ps\",\"size\":\"M\",\"quantity\":1}]'::jsonb,'$1','pickup',null,'$2')"; }
r1=$(nuevo 'Pago A' credito)
id1=$(echo "$r1" | python3 -c "import sys,json;print(json.load(sys.stdin)['order']['id'])")
tok1=$(echo "$r1" | python3 -c "import sys,json;print(json.load(sys.stdin)['pagoToken'])")
if [ "${#tok1}" -ge 40 ]; then echo "✔ el pedido nuevo trae un código de pago"; else echo "✘ sin código de pago"; exit 1; fi
rc() { psqlm -c "select public.reservar_cobro('$1','$2','tx$3',3)->>'error'"; }
e=$(rc "$id1" "equivocado" 1); [ "$e" = "no_encontrado" ] && echo "✔ código equivocado: rechazado" || { echo "✘ código equivocado dio: $e"; exit 1; }
e=$(rc "M-99999" "x" 1); [ "$e" = "no_encontrado" ] && echo "✔ pedido inexistente: misma respuesta" || { echo "✘ inexistente dio: $e"; exit 1; }
e=$(rc "$id1" "$tok1" 1); [ -z "$e" ] && echo "✔ con el código, se reserva el cobro" || { echo "✘ reserva dio: $e"; exit 1; }
e=$(rc "$id1" "$tok1" 2); [ "$e" = "en_curso" ] && echo "✔ no se reserva dos veces a la vez" || { echo "✘ doble reserva dio: $e"; exit 1; }
for n in 1 2 3; do
  psqlm -q -c "update public.orders set payment_status='rechazado' where id='$id1'"
  e=$(rc "$id1" "$tok1" "r$n")
done
[ "$e" = "intentos" ] && echo "✔ tras 3 intentos, no se puede seguir probando tarjetas" || { echo "✘ el límite de intentos no corta: $e"; exit 1; }
# Vencimiento: uno de pago online sin pagar y viejo vence; uno de efectivo y uno pagado, no.
r2=$(nuevo 'Pago B' debito); id2=$(echo "$r2" | python3 -c "import sys,json;print(json.load(sys.stdin)['order']['id'])")
r3=$(nuevo 'Pago C' efectivo); id3=$(echo "$r3" | python3 -c "import sys,json;print(json.load(sys.stdin)['order']['id'])")
r4=$(nuevo 'Pago D' credito); id4=$(echo "$r4" | python3 -c "import sys,json;print(json.load(sys.stdin)['order']['id'])")
psqlm -q -c "update public.orders set payment_status='aprobado' where id='$id4'"
psqlm -q -c "update public.orders set fecha = fecha - interval '3 days' where id in ('$id2','$id3','$id4')"
antes=$(psqlm -c "select qty from public.stock where product_id='ps' and size='M'")
psqlm -q -c "select public.vencer_pedidos_sin_pago()"
despues=$(psqlm -c "select qty from public.stock where product_id='ps' and size='M'")
s2=$(psqlm -c "select status from public.orders where id='$id2'")
s3=$(psqlm -c "select status from public.orders where id='$id3'")
s4=$(psqlm -c "select status from public.orders where id='$id4'")
if [ "$s2" = "Cancelado" ] && [ "$s3" = "Pendiente" ] && [ "$s4" = "Pendiente" ] && [ "$((despues-antes))" = "1" ]; then
  echo "✔ vence sólo el pedido online sin pagar y devuelve su unidad; efectivo y pagado quedan"
else
  echo "✘ vencimiento incorrecto: B=$s2 C=$s3 D=$s4 stock $antes→$despues"; exit 1
fi
psqlm -q -c "select public.vencer_pedidos_sin_pago()"
final=$(psqlm -c "select qty from public.stock where product_id='ps' and size='M'")
[ "$final" = "$despues" ] && echo "✔ volver a correrlo no devuelve dos veces" || { echo "✘ devolvió de más"; exit 1; }

echo
echo "→ tienda en pausa: no se toma ningún pedido"
psqlm -q -c "update public.orders set fecha = fecha - interval '10 minutes'"
psqlm -q -c "update public.settings set datos = jsonb_set(coalesce(datos,'{}'::jsonb), '{pausa}', '{\"activa\": true, \"mensaje\": \"Volvemos el 5 de enero\"}'::jsonb) where id='local'"
antes_p=$(psqlm -c "select count(*) from public.orders")
r_p=$(psqlm -c "select public.crear_pedido('[{\"productId\":\"ps\",\"size\":\"M\",\"quantity\":1}]'::jsonb,'Pausa','pickup',null,'efectivo')->>'error'")
despues_p=$(psqlm -c "select count(*) from public.orders")
if [ "$r_p" = "Volvemos el 5 de enero" ] && [ "$antes_p" = "$despues_p" ]; then echo "✔ en pausa se rechaza con el mensaje del local y no entra ningún pedido"; else echo "✘ la pausa no frena la compra: '$r_p' ($antes_p→$despues_p)"; exit 1; fi
psqlm -q -c "update public.settings set datos = jsonb_set(datos, '{pausa,activa}', 'false'::jsonb) where id='local'"
ok_p=$(psqlm -c "select (public.crear_pedido('[{\"productId\":\"ps\",\"size\":\"M\",\"quantity\":1}]'::jsonb,'SinPausa','pickup',null,'efectivo')->'order'->>'id') is not null")
if [ "$ok_p" = "t" ]; then echo "✔ al apagar la pausa, se vuelve a poder comprar"; else echo "✘ con la pausa apagada no se pudo comprar"; exit 1; fi
