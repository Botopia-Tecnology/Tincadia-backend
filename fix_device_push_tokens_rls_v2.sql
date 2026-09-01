-- =============================================================================
--  device_push_tokens — RLS por dueño (reemplaza a fix_device_push_tokens_rls.sql)
--
--  QUE PASO
--  El fix anterior asumia que auth-ms entra como `service_role` (BYPASSRLS) y
--  por eso revoco los privilegios a `authenticated`. En produccion auth-ms NO
--  esta resolviendo como service_role, asi que se quedo sin acceso:
--      42501: permission denied for table device_push_tokens
--
--  ESTE SCRIPT
--  Devuelve el acceso SIN volver a `USING (true)`. En vez de eso las policies
--  filtran por `auth.uid()`, de modo que cada usuario solo ve y modifica SUS
--  filas. La exposicion que motivo el fix original (116 tokens de 105 usuarios
--  legibles por cualquiera) queda cerrada igualmente.
--
--  Se corrige solo desde SQL: no requiere ningun cambio en el backend.
--
--  Correr en el SQL Editor de Supabase. Es idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. Privilegios de tabla
--
--  RLS filtra filas, pero el rol necesita ademas el privilegio. El fix anterior
--  lo revoco; aqui se devuelve, acotado a las operaciones que auth-ms usa.
--  Nota: NO se le devuelve nada a `anon` — un usuario sin sesion no tiene por
--  que tocar esta tabla, y auth.uid() seria NULL de todas formas.
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON device_push_tokens TO authenticated;
REVOKE ALL ON device_push_tokens FROM anon;


-- -----------------------------------------------------------------------------
--  2. Limpiar policies previas
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "backend manages device push tokens" ON device_push_tokens;
DROP POLICY IF EXISTS "service_role manages device push tokens" ON device_push_tokens;
DROP POLICY IF EXISTS "own tokens select" ON device_push_tokens;
DROP POLICY IF EXISTS "own tokens insert" ON device_push_tokens;
DROP POLICY IF EXISTS "own tokens update" ON device_push_tokens;
DROP POLICY IF EXISTS "own tokens delete" ON device_push_tokens;
DROP POLICY IF EXISTS "device takeover select" ON device_push_tokens;


-- -----------------------------------------------------------------------------
--  3. service_role: acceso total
--
--  Si algun dia auth-ms entra correctamente como service_role, sigue
--  funcionando sin cambios.
-- -----------------------------------------------------------------------------
CREATE POLICY "service_role manages device push tokens"
    ON device_push_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- -----------------------------------------------------------------------------
--  4. authenticated: solo sus propias filas
--
--  auth.uid() sale del JWT del usuario, no de un parametro que el cliente pueda
--  elegir: por eso no se puede suplantar desde la app.
-- -----------------------------------------------------------------------------

-- Lectura: solo los tokens propios.
-- Esto es lo que cierra la fuga original (antes se leian los de todos).
CREATE POLICY "own tokens select"
    ON device_push_tokens
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Alta: solo puede registrarse a si mismo.
CREATE POLICY "own tokens insert"
    ON device_push_tokens
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Actualizacion: cubre el caso de "takeover" de dispositivo.
--
--   USING      -> que filas puede tocar: la suya, O una fila cuyo `token` sea
--                 el mismo que el usuario esta registrando ahora. Ese es el
--                 upsert con onConflict (token, kind) de updatePushToken: si
--                 otra cuenta uso este telefono antes, la fila pasa a esta.
--   WITH CHECK -> como puede quedar: siempre a su nombre. Aunque tome una fila
--                 ajena, solo puede dejarla apuntando a si mismo, nunca
--                 reasignarla a un tercero ni robar el token de otro.
--
-- Lo que NO permite: leer a quien pertenecia antes (el SELECT sigue restringido),
-- ni modificar filas ajenas cuyo token el usuario no posea fisicamente.
CREATE POLICY "own tokens update"
    ON device_push_tokens
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR kind = 'expo')
    WITH CHECK (user_id = auth.uid());

-- Baja: solo sus propias filas.
CREATE POLICY "own tokens delete"
    ON device_push_tokens
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
--  5. RLS activo (por si acaso)
-- -----------------------------------------------------------------------------
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;


-- =============================================================================
--  VERIFICACION
-- =============================================================================

-- 5 policies: service_role (ALL) + 4 de authenticated
SELECT polname,
       polcmd,
       polroles::regrole[] AS roles,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
WHERE polrelid = 'device_push_tokens'::regclass
ORDER BY polname;

-- authenticated debe tener SELECT/INSERT/UPDATE/DELETE; anon nada.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'device_push_tokens'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- La constraint UNIQUE (token, kind) debe seguir existiendo: PostgREST la
-- necesita para el onConflict del upsert (si falta -> error 42P10).
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'device_push_tokens'::regclass
  AND contype = 'u';
