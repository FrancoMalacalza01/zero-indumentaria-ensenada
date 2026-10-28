#!/usr/bin/env bash
# Prueba db/ajustes-catalogo.sql y db/verificar-ajustes-catalogo.sql en un
# Postgres de juguete, sin tocar la base de producción:
#
#   ./db/probar-ajustes.sh
#
# Arma la base como está en producción y prueba tres cosas:
#   A. el SQL sobre una base donde la tabla no existe (lo que pasa en Supabase),
#      y que se pueda correr dos veces;
#   B. el SQL sobre una tabla creada con la versión anterior (sin ofertas), sin
#      perder las filas que ya tenía;
#   C. quién puede leer y escribir (visitante, cuenta común, admin) y las reglas
#      de las ofertas (el precio anterior tiene que ser mayor al precio).
# También prueba el verificador: tiene que marcar falta cuando falta la tabla.
#
# Necesita PostgreSQL instalado (initdb, pg_ctl, psql). Postgres se niega a
# arrancar como root: si lo corrés como root, usa el usuario `postgres`.
set -uo pipefail

BIN=${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}
AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(mktemp -d)
PUERTO=${PG_PORT:-5441}
FALLAS=0

# Como usuario común se arranca directo; como root, con el usuario postgres.
if [ "$(id -u)" = "0" ]; then
  chown postgres "$RAIZ"; chmod 755 "$RAIZ"
  como_pg() { runuser -u postgres -- "$@"; }
else
  como_pg() { "$@"; }
fi
cp "$AQUI/esquema.sql" "$AQUI/ajustes-catalogo.sql" "$AQUI/verificar-ajustes-catalogo.sql" "$RAIZ"/
chmod 644 "$RAIZ"/*.sql

limpiar() { como_pg "$BIN/pg_ctl" -D "$RAIZ/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$RAIZ"; }
trap limpiar EXIT
psqlm() { psql -h "$RAIZ" -p "$PUERTO" -U postgres -d mistral -tA "$@"; }
ok()   { echo "✓ $1"; }
mal()  { echo "✗ $1"; FALLAS=$((FALLAS+1)); }

como_pg "$BIN/initdb" -D "$RAIZ/data" -U postgres --auth=trust >"$RAIZ/initdb.log" 2>&1 || { cat "$RAIZ/initdb.log"; exit 1; }
como_pg "$BIN/pg_ctl" -D "$RAIZ/data" -o "-p $PUERTO -k $RAIZ" -l "$RAIZ/pg.log" start >/dev/null || { cat "$RAIZ/pg.log"; exit 1; }
psql -h "$RAIZ" -p "$PUERTO" -U postgres -qc "create database mistral" || exit 1

# Lo mínimo de Supabase que el esquema necesita. En producción ya existe.
psqlm -q -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
SQL
psqlm -q -v ON_ERROR_STOP=1 -f "$RAIZ/esquema.sql" >/dev/null 2>"$RAIZ/esquema.err" && ok "esquema.sql completo se aplica en una base nueva" || { mal "esquema.sql falló"; cat "$RAIZ/esquema.err"; }
psqlm -q -v ON_ERROR_STOP=1 -f "$RAIZ/esquema.sql" >/dev/null 2>&1 && ok "esquema.sql se puede volver a correr" || mal "esquema.sql no es repetible"

VERIF() { psqlm -F '|' -f "$RAIZ/verificar-ajustes-catalogo.sql"; }
CUANTOS_OK() { VERIF | awk -F'|' '$3=="t"' | wc -l; }
TOTAL() { VERIF | wc -l; }

# --- A. producción: la base existe pero la tabla no ---
psqlm -q -c "drop table public.catalog_overrides" 
antes=$(CUANTOS_OK)
[ "$antes" -le 1 ] && ok "A. sin la tabla, el verificador marca falta ($antes de $(TOTAL) en true)" || mal "A. el verificador no detecta que falta la tabla ($antes en true)"
psqlm -q -v ON_ERROR_STOP=1 -f "$RAIZ/ajustes-catalogo.sql" >/dev/null 2>"$RAIZ/a.err" && ok "A. ajustes-catalogo.sql se aplica sobre la base existente" || { mal "A. ajustes-catalogo.sql falló"; cat "$RAIZ/a.err"; }
[ "$(CUANTOS_OK)" = "$(TOTAL)" ] && ok "A. el verificador da todo true ($(TOTAL) de $(TOTAL))" || { mal "A. el verificador no da todo true"; VERIF; }
psqlm -q -v ON_ERROR_STOP=1 -f "$RAIZ/ajustes-catalogo.sql" >/dev/null 2>&1 && ok "A. y se puede correr de nuevo" || mal "A. no es repetible"
[ "$(CUANTOS_OK)" = "$(TOTAL)" ] && ok "A. sigue todo true después de repetir" || mal "A. el verificador falla tras repetir"

# --- B. la tabla se había creado con la versión anterior (sin ofertas) ---
psqlm -q -c "drop table public.catalog_overrides"
psqlm -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.catalog_overrides (
  product_id text primary key,
  price integer check (price is null or (price > 0 and price <= 10000000)),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.catalog_overrides enable row level security;
create policy ajustes_publico on public.catalog_overrides for select to anon, authenticated using (true);
create policy ajustes_admin_alta on public.catalog_overrides for insert to authenticated with check (private.es_admin());
create policy ajustes_admin_edicion on public.catalog_overrides for update to authenticated using (private.es_admin()) with check (private.es_admin());
create policy ajustes_admin_baja on public.catalog_overrides for delete to authenticated using (private.es_admin());
insert into public.catalog_overrides (product_id, price, active) values ('vieja', 27500, true), ('baja', null, false);
SQL
psqlm -q -v ON_ERROR_STOP=1 -f "$RAIZ/ajustes-catalogo.sql" >/dev/null 2>"$RAIZ/b.err" && ok "B. se aplica sobre una tabla de la versión anterior" || { mal "B. falló sobre la tabla vieja"; cat "$RAIZ/b.err"; }
[ "$(CUANTOS_OK)" = "$(TOTAL)" ] && ok "B. el verificador da todo true" || { mal "B. verificador"; VERIF; }
[ "$(psqlm -c "select count(*) from public.catalog_overrides")" = "2" ] && ok "B. las filas que ya había siguen ahí" || mal "B. se perdieron filas"
[ "$(psqlm -c "select price from public.catalog_overrides where product_id='vieja'")" = "27500" ] && ok "B. y con sus precios" || mal "B. cambió un precio"

# --- C. las reglas de las ofertas ---
psqlm -q -c "delete from public.catalog_overrides"
psqlm -q -c "grant select,insert,update,delete on public.catalog_overrides to anon, authenticated"   # lo que Supabase da por defecto
rechaza() { # descripción, sql
  out=$(psqlm -v ON_ERROR_STOP=1 -c "$2" 2>&1); if echo "$out" | grep -qiE "violates check constraint|row-level security|permission denied"; then ok "C. $1"; else mal "C. $1 (no se rechazó: $out)"; fi; }
acepta() {
  out=$(psqlm -v ON_ERROR_STOP=1 -c "$2" 2>&1); if echo "$out" | grep -qiE "error"; then mal "C. $1 ($out)"; else ok "C. $1"; fi; }
rechaza "precio anterior igual al precio: no es oferta" "insert into public.catalog_overrides(product_id,price,old_price) values('x',100,100)"
rechaza "precio anterior menor al precio" "insert into public.catalog_overrides(product_id,price,old_price) values('x',100,50)"
rechaza "precio anterior sin precio propio" "insert into public.catalog_overrides(product_id,price,old_price) values('x',null,500)"
rechaza "precio en cero" "insert into public.catalog_overrides(product_id,price) values('x',0)"
rechaza "precio por encima del máximo" "insert into public.catalog_overrides(product_id,price) values('x',10000001)"
rechaza "precio anterior por encima del máximo" "insert into public.catalog_overrides(product_id,price,old_price) values('x',100,10000001)"
acepta  "una oferta válida entra" "insert into public.catalog_overrides(product_id,price,old_price) values('ok',24000,30000)"
acepta  "una baja sin precio entra" "insert into public.catalog_overrides(product_id,price,active) values('baja2',null,false)"

psqlm -q -c "insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','admin@z.com'),('22222222-2222-2222-2222-222222222222','cliente@z.com')"
psqlm -q -c "insert into public.admins(user_id) values ('11111111-1111-1111-1111-111111111111')"
como() { # rol, uid, sql
  psqlm -v ON_ERROR_STOP=1 -c "begin; set local role $1; select set_config('request.jwt.claim.sub','$2',true); $3; rollback;" 2>&1; }
S="select count(*) from public.catalog_overrides"
out=$(como anon "" "$S"); echo "$out" | grep -qE "^[0-9]+$|^[0-9]+\$" && echo "$out" | grep -qi error && mal "C. anon no pudo leer ($out)" || ok "C. un visitante sin cuenta puede leer (la tienda la necesita)"
rechaza "un visitante sin cuenta NO puede escribir" "begin; set local role anon; insert into public.catalog_overrides(product_id,price) values('hack',1); rollback"
out=$(como authenticated 22222222-2222-2222-2222-222222222222 "insert into public.catalog_overrides(product_id,price) values('hack',1)"); echo "$out" | grep -qi "row-level security" && ok "C. una cuenta que no es admin NO puede escribir" || mal "C. una cuenta común pudo escribir ($out)"
out=$(como authenticated 22222222-2222-2222-2222-222222222222 "update public.catalog_overrides set price = 1 where product_id='ok'; select price from public.catalog_overrides where product_id='ok'"); echo "$out" | grep -q "^24000$" && ok "C. ni modificar lo que existe (la oferta sigue en 24000)" || mal "C. una cuenta común modificó una fila ($out)"
out=$(como authenticated 11111111-1111-1111-1111-111111111111 "insert into public.catalog_overrides(product_id,price,old_price) values('admin1',20000,25000); select price||'/'||old_price from public.catalog_overrides where product_id='admin1'"); echo "$out" | grep -q "^20000/25000$" && ok "C. el admin puede crear una oferta" || mal "C. el admin no pudo crear ($out)"
out=$(como authenticated 11111111-1111-1111-1111-111111111111 "insert into public.catalog_overrides(product_id,price,old_price) values('ok',20000,26000) on conflict (product_id) do update set price=excluded.price, old_price=excluded.old_price; select price||'/'||old_price from public.catalog_overrides where product_id='ok'"); echo "$out" | grep -q "^20000/26000$" && ok "C. el admin puede actualizarla con upsert (como lo hace el panel)" || mal "C. upsert del admin falló ($out)"
out=$(como authenticated 11111111-1111-1111-1111-111111111111 "delete from public.catalog_overrides where product_id='ok'; select count(*) from public.catalog_overrides where product_id='ok'"); echo "$out" | grep -q "^0$" && ok "C. el admin puede terminar la oferta (borrar la fila)" || mal "C. el admin no pudo borrar ($out)"

echo
[ "$FALLAS" = "0" ] && echo "TODO BIEN" || echo "$FALLAS FALLAS"
exit $FALLAS
