import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Un token de Expo identifica al DISPOSITIVO, no a la cuenta. Guardarlo en la
 * columna unica `profiles.push_token` hacia que al iniciar sesion una segunda
 * cuenta en el mismo telefono el backend le quitara el token a la primera
 * (`update ... set push_token = null where push_token = $1 and id <> $2`),
 * dejandola en NULL y sin notificaciones hasta un nuevo login.
 *
 * Esta tabla da una fila por (usuario, dispositivo), de forma que dos cuentas
 * pueden coexistir en el mismo telefono. `profiles.push_token` se mantiene
 * sincronizada como cache de lectura para no tocar los servicios de envio.
 */
export class CreateDevicePushTokens1756300000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS device_push_tokens (
                id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                token       text NOT NULL,
                kind        text NOT NULL DEFAULT 'expo',
                platform    text,
                updated_at  timestamptz NOT NULL DEFAULT now(),
                created_at  timestamptz NOT NULL DEFAULT now()
            )
        `);

        // Un token fisico pertenece a una sola cuenta a la vez: el upsert de
        // `updatePushToken` usa esto para reasignar el dueno.
        //
        // Tiene que ser CONSTRAINT, no solo CREATE UNIQUE INDEX: PostgREST
        // resuelve el `onConflict` del upsert contra pg_constraint, y con un
        // indice suelto el INSERT falla con 42P10 ("no unique or exclusion
        // constraint matching the ON CONFLICT specification").
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'device_push_tokens_token_kind_key'
                ) THEN
                    -- Adopta el indice si una version previa lo creo suelto.
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
            END $$
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS device_push_tokens_user_id_idx
            ON device_push_tokens (user_id, kind)
        `);

        // La tabla solo se toca con el service-role desde auth-ms; RLS activo y
        // sin policies deja fuera a los clientes anon/authenticated.
        // Condicionado para no fallar si el SQL ya se corrio a mano.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_tables
                    WHERE schemaname = 'public'
                      AND tablename = 'device_push_tokens'
                      AND rowsecurity
                ) THEN
                    ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;
                END IF;
            END $$
        `);

        // Backfill: conservar los tokens que hoy siguen vivos en profiles.
        await queryRunner.query(`
            INSERT INTO device_push_tokens (user_id, token, kind, updated_at)
            SELECT id, push_token, 'expo', COALESCE(updated_at, now())
            FROM profiles
            WHERE push_token IS NOT NULL AND push_token <> ''
            ON CONFLICT (token, kind) DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS device_push_tokens`);
    }

}
