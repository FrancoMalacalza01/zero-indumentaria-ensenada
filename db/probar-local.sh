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
echo "→ y de nuevo, para ver que se puede volver a correr"
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/esquema.sql" 2>/dev/null
psqlm -q -v ON_ERROR_STOP=1 -f "$AQUI/crear_pedido.sql" 2>/dev/null

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

compraron=$(psqlm -c "select count(*) from public.orders")
quedan=$(psqlm -c "select qty from public.stock where product_id='a'")
deltas=$(psqlm -c "select coalesce(sum(delta),0) from public.movements")
echo
echo "pedidos: $compraron · stock final: $quedan · suma de movimientos: $deltas"
if [ "$compraron" = "4" ] && [ "$quedan" = "0" ] && [ "$deltas" = "-4" ]; then
  echo "✔ se vendieron exactamente las cuatro que había, ni una más"
else
  echo "✘ la cuenta no cierra: se vendió algo que no estaba"
  exit 1
fi
