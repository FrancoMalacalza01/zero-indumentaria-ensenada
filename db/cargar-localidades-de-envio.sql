-- Carga la lista de localidades que el cliente elige en el checkout (en vez de escribir su código postal).
-- Es lo mismo que Configuración → Envíos → Localidades en el panel, pero de una vez. Sólo toca
-- `envio.localidades` dentro de la configuración. Se puede volver a correr.
--
-- LOS CÓDIGOS SON LOS DE ESTA ZONA QUE YA SE USAN EN LAS ZONAS DE ENVÍO; verificalos contra el Correo
-- (buscador de código postal) y corregí o agregá desde el panel. Cada código tiene que caer en alguna zona
-- de envío; si no, el cliente ve "todavía no llegamos a ese código postal".
update public.settings
   set datos = jsonb_set(
     coalesce(datos, '{}'::jsonb),
     '{envio}',
     coalesce(datos->'envio', '{}'::jsonb) || jsonb_build_object(
       'localidades', jsonb_build_array(
         jsonb_build_object('nombre','Ensenada','cp','1925'),
         jsonb_build_object('nombre','Berisso','cp','1923'),
         jsonb_build_object('nombre','Punta Lara','cp','1931'),
         jsonb_build_object('nombre','La Plata','cp','1900'),
         jsonb_build_object('nombre','City Bell','cp','1896'),
         jsonb_build_object('nombre','Gonnet','cp','1897'),
         jsonb_build_object('nombre','Villa Elisa','cp','1894')
       )
     ),
     true
   )
 where id = 'local';

select l->>'nombre' as localidad, l->>'cp' as codigo_postal
  from public.settings, jsonb_array_elements(datos->'envio'->'localidades') l
 where id = 'local';
