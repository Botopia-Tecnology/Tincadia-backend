-- =============================================================================
--  profiles.voip_token / fcm_token — quitar el DEFAULT 'NULL' (cadena literal)
--
--  SINTOMA
--      🍏 Sending VoIP Push to token: NULL...
--      🍏 VoIP Push failed: [{"device":"NULL","status":"400","reason":"BadDeviceToken"}]
--
--  CAUSA
--  Las columnas estaban declaradas con DEFAULT 'NULL'::text, es decir la CADENA
--  de 4 caracteres "NULL", no el valor nulo de SQL. Cada perfil nuevo nacia con
--  esa basura, y el backend la trata como token valido porque es una cadena no
--  vacia: `voipToken || null` no la filtra.
--
--  Medido antes de este script:
--      voip_token = 'NULL' ...... 209 de 225 perfiles
--      fcm_token  = 'NULL' ...... 181 de 225 perfiles
--      ambos a la vez ........... 168  (usuarios que nunca registraron ninguno)
--      tokens reales ............ 14 VoIP / 41 FCM
--
--  Correr en el SQL Editor de Supabase. Es idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. Quitar el DEFAULT que genera el problema en cada alta
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ALTER COLUMN voip_token DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN fcm_token  DROP DEFAULT;


-- -----------------------------------------------------------------------------
--  2. Limpiar las filas ya afectadas
--
--  Se comparan tambien variantes por si alguna ruta escribio 'null' o vacio.
-- -----------------------------------------------------------------------------
UPDATE profiles
SET voip_token = NULL
WHERE voip_token IS NOT NULL
  AND (upper(btrim(voip_token)) = 'NULL' OR btrim(voip_token) = '');

UPDATE profiles
SET fcm_token = NULL
WHERE fcm_token IS NOT NULL
  AND (upper(btrim(fcm_token)) = 'NULL' OR btrim(fcm_token) = '');

UPDATE profiles
SET push_token = NULL
WHERE push_token IS NOT NULL
  AND (upper(btrim(push_token)) = 'NULL' OR btrim(push_token) = '');


-- -----------------------------------------------------------------------------
--  3. Blindaje: que la cadena "NULL" no pueda volver a entrar
--
--  Aunque el DEFAULT ya no existe, una ruta de codigo podria escribirla igual
--  (es exactamente lo que produce JSON.stringify sobre un null mal manejado).
--  El CHECK la rechaza en el origen en vez de dejar que llegue a APNs/FCM.
-- -----------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_push_tokens_no_literal_null;
ALTER TABLE profiles ADD CONSTRAINT profiles_push_tokens_no_literal_null CHECK (
    (voip_token IS NULL OR upper(btrim(voip_token)) NOT IN ('NULL', 'UNDEFINED', ''))
    AND
    (fcm_token  IS NULL OR upper(btrim(fcm_token))  NOT IN ('NULL', 'UNDEFINED', ''))
    AND
    (push_token IS NULL OR upper(btrim(push_token)) NOT IN ('NULL', 'UNDEFINED', ''))
);


-- =============================================================================
--  VERIFICACION
-- =============================================================================

-- Los DEFAULT deben salir vacios (NULL en la columna column_default):
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('voip_token', 'fcm_token', 'push_token');

-- Todos los contadores de basura deben dar 0; los de tokens reales se conservan:
SELECT
  count(*) FILTER (WHERE voip_token = 'NULL')                            AS voip_basura,
  count(*) FILTER (WHERE fcm_token  = 'NULL')                            AS fcm_basura,
  count(*) FILTER (WHERE voip_token IS NOT NULL)                         AS voip_reales,
  count(*) FILTER (WHERE fcm_token  IS NOT NULL)                         AS fcm_reales,
  count(*)                                                                AS total_perfiles
FROM profiles;
