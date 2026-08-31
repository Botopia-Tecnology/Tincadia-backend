-- =============================================================================
--  device_push_tokens: dos arreglos independientes
--
--    PARTE 1 - Seguridad: quitar una policy RLS que exponia los push tokens
--              de todos los usuarios.
--    PARTE 2 - Datos: resincronizar la cache `profiles.push_token`, que tiene
--              26 usuarios sin notificaciones.
--
--  Correr en el SQL Editor de Supabase. Todo es idempotente y se puede volver
--  a ejecutar sin efectos secundarios.
-- =============================================================================


-- =============================================================================
--  PARTE 1 - RLS: dejar solo la policy de service_role
--
--  QUE PASABA
--  Una version previa de este script creaba, ademas de la de service_role:
--
--      CREATE POLICY "backend manages device push tokens"
--          ON device_push_tokens FOR ALL TO authenticated
--          USING (true) WITH CHECK (true);
--
--  El razonamiento era que "segun como este emitida la llave, PostgREST puede
--  resolver al backend como authenticated". Esa premisa resulto falsa:
--
--    * auth-ms opera la tabla con getAdminClient(), creado con
--      SUPABASE_SERVICE_KEY (auth-ms/src/supabase/supabase.service.ts:30), que
--      resuelve a service_role y hace BYPASSRLS.
--    * En esta misma base hay ~20 tablas (contacts, payments, subscriptions,
--      message_reads...) con RLS activo y CERO policies, y todas funcionan
--      desde los microservicios. Esa es la prueba de que el bypass ocurre.
--
--  IMPACTO
--  `USING (true)` no filtra nada, y el rol authenticated tiene privilegios
--  completos de tabla (relacl: authenticated=arwdDxtm). Con la anon key, que
--  viaja dentro de la app movil, cualquier usuario logueado podia:
--    * leer los push tokens de TODOS -> enviar notificaciones suplantando a
--      Tincadia,
--    * borrar tokens ajenos -> dejar gente sin notificaciones,
--    * reasignarse un token ajeno -> recibir las notificaciones de otra persona.
--  Medido al detectarlo: 116 tokens de 105 usuarios expuestos.
--
--  POR QUE NO ROMPE NADA
--    * auth-ms entra como service_role (unica ruta de escritura a la tabla).
--    * chat-ms y communication-ms NO leen device_push_tokens: consumen la
--      columna cache `profiles.push_token`, que sigue existiendo.
--    * Ningun cliente movil consulta esta tabla directamente.
-- =============================================================================

-- service_role: acceso completo (es quien opera la tabla desde auth-ms).
DROP POLICY IF EXISTS "service_role manages device push tokens" ON device_push_tokens;
CREATE POLICY "service_role manages device push tokens"
    ON device_push_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Elimina la policy permisiva. Sin policy, RLS niega por defecto a
-- anon/authenticated, que es lo correcto para una tabla solo de backend.
DROP POLICY IF EXISTS "backend manages device push tokens" ON device_push_tokens;

-- Defensa en profundidad: quitar tambien el privilegio de tabla, para que la
-- exposicion no reaparezca si alguien agrega una policy permisiva por error.
REVOKE ALL ON device_push_tokens FROM anon, authenticated;


-- =============================================================================
--  PARTE 2 - Resincronizar la cache `profiles.push_token`
--
--  QUE PASABA
--  `device_push_tokens` es la fuente de verdad, pero chat-ms y communication-ms
--  siguen leyendo `profiles.push_token`. auth-ms mantiene esa columna al dia
--  con syncProfilePushToken() (auth-ms/src/auth/auth.service.ts:558), que
--  escribe el token mas reciente por `updated_at` con kind='expo'.
--
--  El backfill de la migracion copio profiles -> device_push_tokens, pero nunca
--  el camino inverso, asi que la cache quedo atrasada:
--
--      usuarios con token en la tabla ... 105
--      usuarios con token en la cache ...  82
--      cache vacia teniendo token ......   26   <- SIN NOTIFICACIONES
--      cache apuntando a un token viejo .   4
--
--  Este UPDATE aplica exactamente la misma regla que syncProfilePushToken,
--  para los 224 perfiles de una sola pasada.
--
--  EFECTO MEDIDO (simulado en la base real, sin escribir): 33 filas cambian
--      26 se rellenan  (usuarios que recuperan notificaciones)
--       4 se corrigen  (token viejo -> token vigente)
--       3 se limpian   (pasan a NULL)
--  La cache pasa de 82 a 105 usuarios, igualando a la tabla.
--
--  Sobre esas 3 que pasan a NULL: 2 son cesiones legitimas de dispositivo (otra
--  cuenta se logueo en ese telefono y el token ya le pertenece), y ponerlas en
--  NULL es lo correcto: si no, dos cuentas apuntarian al mismo token y la
--  persona equivocada recibiria las notificaciones. La 3ra es un token huerfano
--  sin rastro en la tabla. En los tres casos el usuario recupera su token en el
--  proximo login.
-- =============================================================================

-- Respaldo por si hay que revertir. Queda como tabla suelta; borrala cuando
-- hayas confirmado que todo esta bien (DROP TABLE al final del archivo).
CREATE TABLE IF NOT EXISTS _backup_profiles_push_token_20260831 AS
SELECT id, push_token, now() AS backed_up_at
FROM profiles
WHERE push_token IS NOT NULL;

-- Subconsulta correlacionada: cubre tanto a los usuarios CON fila en la tabla
-- (toma su token vigente) como a los que no tienen ninguna (quedan en NULL),
-- que es justo lo que hace syncProfilePushToken.
UPDATE profiles p
SET push_token = (
        SELECT d.token
        FROM device_push_tokens d
        WHERE d.user_id = p.id AND d.kind = 'expo'
        ORDER BY d.updated_at DESC
        LIMIT 1
    )
WHERE p.push_token IS DISTINCT FROM (
        SELECT d.token
        FROM device_push_tokens d
        WHERE d.user_id = p.id AND d.kind = 'expo'
        ORDER BY d.updated_at DESC
        LIMIT 1
    );


-- =============================================================================
--  VERIFICACION
-- =============================================================================

-- 1) RLS: debe quedar UNA sola policy, la de service_role.
SELECT policyname, cmd, roles, qual::text AS using_expr
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'device_push_tokens'
ORDER BY policyname;

-- 2) Privilegios: en el acl ya no deben aparecer anon= ni authenticated=.
SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relacl::text AS acl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'device_push_tokens';

-- 3) Sincronizacion: `desincronizados` debe dar 0.
WITH ultimo AS (
    SELECT DISTINCT ON (user_id) user_id, token
    FROM device_push_tokens WHERE kind = 'expo'
    ORDER BY user_id, updated_at DESC
)
SELECT
    (SELECT count(*) FROM ultimo)                                        AS usuarios_en_tabla,
    (SELECT count(*) FROM profiles
      WHERE push_token IS NOT NULL AND push_token <> '')                 AS usuarios_en_cache,
    (SELECT count(*) FROM profiles p LEFT JOIN ultimo u ON u.user_id = p.id
      WHERE p.push_token IS DISTINCT FROM u.token)                       AS desincronizados;

-- 4) Los tokens de la tabla siguen intactos (nada de esto los toca).
SELECT count(*) AS total_tokens, count(DISTINCT user_id) AS usuarios
FROM device_push_tokens;


-- =============================================================================
--  REVERTIR la parte 2, si hiciera falta
-- =============================================================================
-- UPDATE profiles p SET push_token = b.push_token
-- FROM _backup_profiles_push_token_20260831 b WHERE b.id = p.id;

-- Limpieza del respaldo, una vez confirmado:
-- DROP TABLE _backup_profiles_push_token_20260831;
