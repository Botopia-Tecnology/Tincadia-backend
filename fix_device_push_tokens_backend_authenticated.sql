-- =============================================================================
--  device_push_tokens — auth-ms entra como `authenticated` SIN JWT de usuario
--
--  SINTOMA (cambio respecto al error anterior)
--      Antes: "permission denied for table device_push_tokens"      (42501)
--      Ahora: "new row violates row-level security policy ..."      (42501)
--
--  El cambio de mensaje es la pista: ya NO falta el privilegio de tabla (el
--  GRANT anterior funciono). Ahora lo que rechaza es el WITH CHECK de la policy.
--
--  CAUSA
--  auth-ms opera como `authenticated`, pero con la clave publica y sin JWT de
--  usuario, asi que auth.uid() es NULL. Verificado:
--
--      SELECT auth.uid();  -->  NULL
--      '<uuid>' = auth.uid()  -->  NULL  (que en una policy cuenta como false)
--
--  Por eso las policies "own tokens insert/update", que exigen
--  user_id = auth.uid(), rechazan cualquier fila que el backend intente escribir.
--
--  SOLUCION
--  Anadir una policy para `authenticated` que permita al backend operar sobre
--  filas cuyo user_id exista en profiles, SIN depender de auth.uid().
--
--  ⚠️ CONCESION TEMPORAL, igual que las anteriores. Con la clave publica dentro
--  de la app movil, esto permite a un cliente autenticado escribir tokens de
--  otros usuarios. La identidad real se valida en auth-ms, que recibe el userId
--  ya verificado. Deja de hacer falta en cuanto SUPABASE_SERVICE_KEY llegue bien
--  al contenedor (ver seccion 3).
--
--  Correr en el SQL Editor de Supabase. Es idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. Policy para el backend
--
--  Se exige que el user_id corresponda a un perfil real: evita que se inserten
--  filas huerfanas o con UUIDs inventados, que es la parte del control que si
--  se puede comprobar sin auth.uid().
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "backend manages device push tokens (no jwt)" ON device_push_tokens;
CREATE POLICY "backend manages device push tokens (no jwt)"
    ON device_push_tokens
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = device_push_tokens.user_id))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = device_push_tokens.user_id));


-- =============================================================================
--  2. VERIFICACION
-- =============================================================================
SELECT polname,
       CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                   WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                   WHEN '*' THEN 'ALL' END AS comando,
       polroles::regrole[] AS roles
FROM pg_policy WHERE polrelid = 'device_push_tokens'::regclass
ORDER BY polcmd, polname;

-- Tras iniciar sesion en la app, debe aparecer una fila nueva:
SELECT kind, count(*), max(updated_at) AS ultima_escritura
FROM device_push_tokens GROUP BY kind;


-- =============================================================================
--  3. LA CORRECCION DE FONDO
--
--  Llevamos tres tablas parcheadas por lo mismo (profiles, device_push_tokens
--  x2). La causa unica es que auth-ms NO usa SUPABASE_SERVICE_KEY: si lo
--  hiciera, resolveria a service_role, que hace BYPASSRLS, y ninguna de estas
--  concesiones seria necesaria.
--
--  Diagnostico (ejecutar DESDE auth-ms, no en el SQL Editor):
--      SELECT current_user, auth.uid();
--  Esperado: service_role / NULL
--  Si devuelve `authenticated`, la variable de entorno esta mal o ausente en
--  Railway y el codigo esta cayendo a getClient() en vez de getAdminClient()
--  (auth-ms/src/supabase/supabase.service.ts:30 solo crea el cliente admin si
--  SUPABASE_SERVICE_KEY existe).
--
--  Una vez corregida, retirar las concesiones:
--
--      DROP POLICY IF EXISTS "backend manages device push tokens (no jwt)"
--          ON device_push_tokens;
--      DROP POLICY IF EXISTS "anon backend manages device push tokens"
--          ON device_push_tokens;
--      DROP POLICY IF EXISTS "anon backend updates profiles" ON profiles;
--      REVOKE ALL ON device_push_tokens FROM anon;
-- =============================================================================
