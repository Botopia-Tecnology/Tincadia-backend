-- =============================================================================
--  FIX: falta la CONSTRAINT UNIQUE (token, kind) en device_push_tokens
--
--  El script anterior creaba la unicidad con CREATE UNIQUE INDEX. Eso impone
--  la restriccion a nivel de datos, pero PostgREST resuelve el `onConflict`
--  del upsert consultando pg_constraint, no pg_indexes. Con solo el indice, el
--  INSERT falla con:
--
--      42P10: there is no unique or exclusion constraint matching the
--             ON CONFLICT specification
--
--  ...que auth-ms convertia en el generico "Error al actualizar token de
--  notificaciones" (400) que aparece en los logs del api-gateway.
--
--  Correr en el SQL Editor de Supabase. Es idempotente.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'device_push_tokens_token_kind_key'
    ) THEN
        -- Reutiliza el indice existente como respaldo de la constraint, sin
        -- reconstruirlo. Si por alguna razon no esta, la crea desde cero.
        IF EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'device_push_tokens_token_kind_key'
        ) THEN
            ALTER TABLE device_push_tokens
                ADD CONSTRAINT device_push_tokens_token_kind_key
                UNIQUE USING INDEX device_push_tokens_token_kind_key;
        ELSE
            ALTER TABLE device_push_tokens
                ADD CONSTRAINT device_push_tokens_token_kind_key
                UNIQUE (token, kind);
        END IF;
    END IF;
END $$;


-- =============================================================================
--  Verificacion: debe devolver una fila con contype = 'u'
-- =============================================================================
SELECT conname, contype, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'device_push_tokens'::regclass
  AND contype = 'u';
