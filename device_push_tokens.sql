-- =============================================================================
--  device_push_tokens
--  Correr una sola vez en el SQL Editor de Supabase.
--
--  Un token de Expo identifica al DISPOSITIVO, no a la cuenta. Al vivir en la
--  columna unica profiles.push_token, iniciar sesion con una segunda cuenta en
--  el mismo telefono le quitaba el token a la primera y la dejaba en NULL, sin
--  notificaciones hasta un nuevo login. Esta tabla da una fila por
--  (usuario, dispositivo) para que ambas cuentas coexistan.
--
--  profiles.push_token se mantiene sincronizada como cache de lectura, asi que
--  chat-ms y communication-ms siguen funcionando sin cambios.
--
--  Es idempotente: se puede correr de nuevo sin romper nada.
-- =============================================================================

CREATE TABLE IF NOT EXISTS device_push_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token       text NOT NULL,
    kind        text NOT NULL DEFAULT 'expo',
    platform    text,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Un token fisico pertenece a una sola cuenta a la vez: el upsert de
-- updatePushToken usa este indice para reasignar el dueno del dispositivo.
CREATE UNIQUE INDEX IF NOT EXISTS device_push_tokens_token_kind_key
    ON device_push_tokens (token, kind);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_id_idx
    ON device_push_tokens (user_id, kind);

-- Solo auth-ms la toca, con service-role. RLS activo y sin policies deja fuera
-- a los clientes anon/authenticated.
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Backfill: conservar los 81 tokens que hoy siguen vivos en profiles.
INSERT INTO device_push_tokens (user_id, token, kind, updated_at)
SELECT id, push_token, 'expo', COALESCE(updated_at, now())
FROM profiles
WHERE push_token IS NOT NULL AND push_token <> ''
ON CONFLICT (token, kind) DO NOTHING;


-- =============================================================================
--  Verificacion (opcional)
-- =============================================================================
-- SELECT count(*) AS tokens_migrados FROM device_push_tokens;
--   -> deberia dar 81, que son los perfiles con push_token no vacio hoy.
