-- Carga las zonas de envío con sus códigos postales y costos (la misma pantalla de
-- Configuración → Envíos del panel, pero de una vez). Sólo toca `envio` dentro de la
-- configuración: no cambia nada más (empresa, talles, pagos, etc.).
--
-- Ejecutar en el SQL Editor de Supabase. Se puede volver a correr.
--
-- LOS COSTOS SON UNA PROPUESTA, no tarifas oficiales: salen de las estimaciones de Correo
-- Argentino que pasó el local (La Plata y alrededores $13.500-$15.500; resto de la provincia
-- $14.500-$17.500, punto medio de cada rango). Confirmarlos en el cotizador de MiCorreo y
-- corregirlos desde el panel si hace falta.
-- Orden importa: si un código cae en dos zonas, gana la primera. Por eso lo específico va arriba.
update public.settings
   set datos = jsonb_set(
     coalesce(datos, '{}'::jsonb),
     '{envio}',
     jsonb_build_object(
       'envioGratisDesde', 99999,
       'zonas', jsonb_build_array(
         jsonb_build_object('id','ensenada','nombre','Ensenada','tipo','correo','costo',14500,'cp','1925'),
         jsonb_build_object('id','berisso','nombre','Berisso','tipo','correo','costo',14500,'cp','1923'),
         jsonb_build_object('id','punta-lara','nombre','Punta Lara','tipo','correo','costo',14500,'cp','1931'),
         jsonb_build_object('id','la-plata','nombre','La Plata y alrededores','tipo','correo','costo',14500,
                            'cp','1900-1909, 1894, 1896, 1897'),
         jsonb_build_object('id','bsas','nombre','Resto de la Provincia de Buenos Aires','tipo','correo','costo',16000,
                            'nota','Por Correo Argentino. El costo depende del peso y del código postal.',
                            'cp','1600-1999, 2700-2999, 6000-6299, 6400-8399')
       )
     ),
     true
   )
 where id = 'local';

-- Chequeo: tiene que mostrar las 5 zonas con su costo y códigos.
select z->>'nombre' as zona, z->>'costo' as costo, z->>'cp' as codigos_postales
  from public.settings, jsonb_array_elements(datos->'envio'->'zonas') z
 where id = 'local';
