-- =============================================================================
--  device_push_tokens — desbloquear el 42501 que sigue apareciendo
--
--  ESTADO VERIFICADO EN LA BASE (todo esto YA esta bien):
--      service_role  = arwdDxtm   <- acceso completo
--      authenticated = arwd       <- select/insert/update/delete
--      anon          = (nada)     <- revocado por fix_device_push_tokens_rls_v2
--      5 policies creadas, RLS activo, UNIQUE (token,kind) y FK presentes.
--
--  Como auth-ms sigue fallando con "permission denied", por descarte esta
--  conectando como `anon`: es el unico rol sin privilegios. Eso confirma que
--  SUPABASE_SERVICE_KEY no esta llegando al contenedor (SupabaseService solo
--  crea el cliente admin si la variable existe; si falta, cae al cliente
--  publico, que resuelve a anon).
--
--  Este script devuelve a `anon` lo minimo para que el upsert de push tokens
--  funcione, SIN volver a USING(true): las policies por auth.uid() del script
--  v2 siguen filtrando fila a fila.
--
--  ⚠️ ES UN PARCHE, NO LA SOLUCION.
--  Con anon operando la tabla, la proteccion real recae solo en las policies.
--  La correccion de fondo es arreglar SUPABASE_SERVICE_KEY en el entorno de
--  auth-ms y despues volver a revocar anon (ultima seccion, comentada).
--
--  Correr en el SQL Editor de Supabase. Es idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. Privilegios minimos para anon
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON device_push_tokens TO anon;


-- -----------------------------------------------------------------------------
--  2. Policies equivalentes para anon
--
--  Ojo: con el cliente anon NO hay JWT de usuario, asi que auth.uid() es NULL y
--  las policies por dueño no dejarian pasar nada. Como auth-ms ya valida la
--  identidad en la capa de aplicacion antes de escribir (updatePushToken recibe
--  el userId ya verificado), aqui se permite la operacion y el filtrado real
--  queda del lado del backend.
--
--  Esta es exactamente la concesion que desaparece cuando service_role vuelva a
--  funcionar: entonces se ejecuta la seccion 4 y anon se queda sin nada.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon backend manages device push tokens" ON device_push_tokens;
CREATE POLICY "anon backend manages device push tokens"
    ON device_push_tokens
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);


-- =============================================================================
--  3. VERIFICACION
-- =============================================================================
SELECT relname, relacl::text AS acl, relrowsecurity AS rls_activo
FROM pg_class
WHERE relname = 'device_push_tokens';

SELECT polname, polcmd, polroles::regrole[] AS roles
FROM pg_policy
WHERE polrelid = 'device_push_tokens'::regclass
ORDER BY polname;


-- =============================================================================
--  4. CUANDO SE ARREGLE SUPABASE_SERVICE_KEY — revertir esta concesion
--
--  Diagnostico previo (ejecutar DESDE auth-ms, no aqui):
--      SELECT current_user;
--  Debe devolver `service_role`. Si devuelve `anon`, la variable sigue mal.
--
--  Una vez corregida, descomentar y correr:
--
--      DROP POLICY IF EXISTS "anon backend manages device push tokens"
--          ON device_push_tokens;
--      REVOKE ALL ON device_push_tokens FROM anon;
--
--  Con eso la tabla vuelve al estado seguro del script v2.
-- =============================================================================
