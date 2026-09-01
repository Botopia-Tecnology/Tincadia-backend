-- =============================================================================
--  profiles — falta la policy de UPDATE (por eso no se guardan los tokens)
--
--  SINTOMA
--      [AuthService] 🤖 Updating FCM token for user <uuid>
--      [AuthService] ✅ FCM token updated successfully
--      ...y el campo queda NULL en la base de datos.
--
--  CAUSA
--  `profiles` tiene RLS ACTIVO y una sola policy, de SELECT:
--      "Profiles are readable for chat resolution"  (SELECT, anon+authenticated)
--
--  No hay ninguna policy de UPDATE, asi que el update() de auth-ms no afecta
--  ninguna fila. PostgREST NO devuelve error cuando un UPDATE toca 0 filas
--  (solo devuelve error si la sentencia falla), de modo que:
--
--      const { error } = await supabase.from('profiles').update(...).eq('id', userId);
--      if (error) throw ...        <- error es null
--      this.logger.log('✅ ...')   <- se imprime exito sin haber escrito nada
--
--  Esto afecta a updateFcmToken, updateVoipToken, updatePushToken y a cualquier
--  otra escritura sobre profiles (updateProfile, updateRole, etc.).
--
--  Evidencia: la ultima escritura real a profiles fue 2026-09-01 00:35, justo
--  antes de aplicar los scripts de RLS. Desde entonces, ninguna.
--
--  Correr en el SQL Editor de Supabase. Es idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. service_role: acceso total (es quien opera profiles desde los microservicios)
--
--  Deberia bastar con esto si auth-ms usara SUPABASE_SERVICE_KEY, porque
--  service_role hace BYPASSRLS. Se crea igualmente para dejarlo explicito.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_role manages profiles" ON profiles;
CREATE POLICY "service_role manages profiles"
    ON profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- -----------------------------------------------------------------------------
--  2. authenticated: cada usuario actualiza SU propio perfil
--
--  auth.uid() sale del JWT, no de un parametro que el cliente elija, asi que no
--  se puede suplantar. Cubre el caso real de auth-ms mientras no resuelva como
--  service_role.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "own profile update" ON profiles;
CREATE POLICY "own profile update"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());


-- -----------------------------------------------------------------------------
--  3. anon: escritura de tokens de dispositivo
--
--  auth-ms esta operando con un cliente que resuelve a `anon` (por eso el
--  UPDATE no pasaba). Sin JWT de usuario auth.uid() es NULL, asi que la policy
--  del punto 2 no le sirve.
--
--  ⚠️ CONCESION TEMPORAL. La identidad se valida en la capa de aplicacion
--  (auth-ms recibe el userId ya verificado), pero a nivel de base esto permite
--  a `anon` actualizar cualquier perfil. Deja de ser necesario en cuanto
--  SUPABASE_SERVICE_KEY llegue bien al contenedor: entonces se ejecuta la
--  seccion 5 y se elimina.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon backend updates profiles" ON profiles;
CREATE POLICY "anon backend updates profiles"
    ON profiles
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);


-- =============================================================================
--  4. VERIFICACION
-- =============================================================================
SELECT polname,
       CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                   WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                   WHEN '*' THEN 'ALL' END AS comando,
       polroles::regrole[] AS roles
FROM pg_policy WHERE polrelid = 'profiles'::regclass
ORDER BY polcmd, polname;

-- Tras iniciar sesion en la app, este contador debe subir:
SELECT count(*) FILTER (WHERE fcm_token IS NOT NULL) AS con_fcm,
       max(updated_at) AS ultima_escritura
FROM profiles;


-- =============================================================================
--  5. CUANDO SUPABASE_SERVICE_KEY FUNCIONE — retirar la concesion a anon
--
--  Diagnostico (ejecutar DESDE auth-ms, no aqui):  SELECT current_user;
--  Debe devolver `service_role`.
--
--      DROP POLICY IF EXISTS "anon backend updates profiles" ON profiles;
--
--  La causa de fondo sigue siendo esa variable de entorno: mientras auth-ms
--  opere como anon, esta usando la clave publica para todo, no solo aqui.
-- =============================================================================
