mplementation Plan – Contact Sync & Verification (TINCADIA)
Objetivo general

Permitir que la aplicación identifique qué contactos del usuario ya están registrados en TINCADIA, sin sobrecargar la base de datos ni repetir verificaciones innecesarias, utilizando procesamiento por bloques (chunking) y marcas de sincronización.

1. Solicitud de permisos (Frontend – Mobile)

Al primer ingreso a la aplicación, se debe solicitar explícitamente al usuario el permiso de acceso a contactos del dispositivo usando los native permission consents del sistema operativo (Android / iOS).

La app no debe continuar con el flujo de sincronización hasta que:

El usuario acepte el permiso, y

La app vuelva al estado activo (app resume).

2. Obtención inicial de contactos (Frontend)

Una vez concedido el permiso:

Se obtiene la lista completa de contactos del usuario.

Cada contacto debe ser normalizado (ej.:

eliminar espacios,

estandarizar prefijos de país,

remover caracteres especiales).

El frontend no envía todos los contactos de una vez.

3. Procesamiento por bloques (Chunking)

Dado que un usuario puede tener N contactos (ej. 2,000 o más):

Los contactos se dividen en bloques de tamaño fijo (ej. 100 contactos por chunk).

Cada chunk se envía al backend de forma periódica:

Ejemplo: 1 chunk por minuto.

Esto evita:

Sobrecarga de la base de datos.

Picos de tráfico innecesarios.

Timeouts o caídas del servicio.

4. Verificación en Backend

Por cada chunk recibido:

El backend valida:

Qué números ya existen en TINCADIA.

Qué números no están registrados.

El resultado se devuelve al frontend con:

IDs de usuarios existentes (si aplica).

Estado de cada contacto (registrado / no registrado).

5. Sistema de marcas de revisión (Sync State)

Para evitar revisar todos los contactos cada vez:

Se debe implementar un sistema de marcas de sincronización, por ejemplo:

last_contacts_sync_at

last_checked_contact_index

contacts_sync_version

En la primera sincronización:

Se revisan todos los contactos.

En sincronizaciones posteriores:

Solo se verifican los contactos añadidos o modificados después de la última revisión.

Esto implica:

El frontend mantiene un estado local con:

Fecha/hora de la última sincronización exitosa.

El backend confía únicamente en los contactos nuevos enviados después de esa marca.

6. Sincronizaciones posteriores

Cada vez que:

El usuario agrega nuevos contactos al celular, o

Se detecta un cambio relevante,

Solo esos nuevos contactos se envían al backend en chunks.

No se reevalúan contactos ya marcados como revisados, a menos que:

Se borre el estado local.

El usuario reinstale la app.

Se cambie la lógica de sincronización (nueva versión).

7. Consideraciones técnicas importantes

Todas las verificaciones deben ser:

Idempotentes

Tolerantes a fallos

Si una sincronización se interrumpe:

Se retoma desde el último chunk confirmado.

El backend no debe almacenar la libreta completa, solo:

Hashes / números normalizados necesarios para la validación.

8. Resultado esperado

La app puede:

Identificar contactos que ya usan TINCADIA.

Mostrar sugerencias de conexión.

El backend:

Evita validaciones repetidas.

Escala correctamente incluso con usuarios con miles de contactos.



. Decisiones clave (para que todo sea consistente)

No enviar “contactos completos” (nombres, emails) al backend. Solo:

normalized_e164 (teléfono en E.164) o

phone_hash (hash del E.164 con salt) si quieres máxima privacidad.

Chunk size: 100 (configurable).

Throttle: 1 chunk/min (configurable).

Estado de sync: se guarda en backend + cache local para reanudar.

1. Backend: modelo de datos
Tabla/colección: contact_sync_state

Un registro por usuario.

Campos sugeridos:

user_id (PK)

status: "idle" | "syncing" | "paused" | "completed" | "failed"

sync_version (int) → para invalidar estados si cambias lógica

last_full_sync_at (timestamp)

last_delta_sync_at (timestamp)

cursor (string | int) → último índice/posición procesada en la libreta actual

device_id (string, opcional) → si manejas multi-dispositivo

last_batch_id (uuid) → para idempotencia/reintentos

updated_at, created_at

Tabla/colección: contact_match_cache (opcional, recomendado)

Sirve para no recalcular matches de lo mismo.

user_id

contact_key (e164 o hash)

matched_user_id (nullable)

matched (bool)

checked_at (timestamp)

Índice compuesto: (user_id, contact_key)

Si no quieres cache, puedes devolver resultados al frontend y que el frontend los guarde localmente; pero el cache ayuda para reintentos y UI consistente.

2. Backend: endpoints (REST)
A) Inicializar / consultar estado

GET /contacts/sync/state

Response: estado actual, cursor, timestamps, sync_version

POST /contacts/sync/start

Body:

deviceId

syncMode: "full" | "delta"

estimatedTotal (opcional)

Action:

crea/actualiza contact_sync_state

genera batchId actual

Response:

batchId, chunkSize, throttleMs (para que el frontend obedezca server)

B) Enviar chunk para verificación

POST /contacts/sync/chunk

Body:

batchId

chunkIndex (0..n)

contacts: string[] (e164) o hashes

cursorAfterChunk (posición que el frontend cree que quedó)

Response:

matches: { contact: string, isOnTincadia: boolean, userId?: string }[]

acceptedChunkIndex

nextRecommendedDelayMs

Reglas:

Idempotencia: si llega el mismo (batchId, chunkIndex) se devuelve el mismo resultado (o se ignora sin duplicar).

Rate limit por usuario.

C) Finalizar sync

POST /contacts/sync/complete

Body: batchId, finalCursor, syncedAt

Action:

set status=completed

last_full_sync_at o last_delta_sync_at

reset/guardar cursor

Response: ok

D) Pausar/reanudar

POST /contacts/sync/pause
POST /contacts/sync/resume

3. Backend: lógica de matching (eficiente)
Index necesario en usuarios

En tu tabla users (o donde guardes teléfono):

phone_e164_normalized con índice único (o índice normal si hay casos raros).

Matching por chunk

Recibes 100 teléfonos → query tipo:

SELECT id, phone_e164_normalized FROM users WHERE phone_e164_normalized IN (...)

Construyes un map {phone -> userId} y devuelves.

Anti-“reventar BD”

Chunk fijo + throttle.

Rate limit + cola opcional (si lo quieres async).

Cache (contact_match_cache) evita recalcular repetidos.

4. Frontend (React Native): tareas
4.1 Permisos + reentrada

En AppStart:

si contactsPermission != granted → solicitar.

al volver (AppState “active”) → si granted, iniciar sync.

4.2 Lectura + normalización

Leer contactos del dispositivo.

Extraer teléfonos.

Normalizar a E.164 (ideal usando lib tipo libphonenumber-js).

4.3 Determinar delta (solo nuevos)

Opciones:

Comparación por snapshot hash local (recomendado):

Guardas localmente un set/hash de teléfonos ya enviados.

Delta = teléfonos actuales - teléfonos guardados.

Si OS provee “last modified” (depende): usarlo.

4.4 Chunking + scheduler

Dividir delta en chunks de 100.

Enviar 1 por minuto (o lo que diga backend).

Persistir progreso local:

currentBatchId, chunkIndex, pendingContacts, lastSyncAt

4.5 Reintentos seguros

Si falla el chunk:

reintenta el mismo chunkIndex con el mismo batchId.

Si la app se cierra

Este es mi modelo de bases de datos actual:

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  contact_user_id uuid NOT NULL,
  alias character varying,
  custom_first_name character varying,
  custom_last_name character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id),
  CONSTRAINT contacts_contact_user_id_fkey FOREIGN KEY (contact_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user1_id uuid,
  user2_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES auth.users(id),
  CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES auth.users(id)
);
CREATE TABLE public.document_types (
  id integer NOT NULL DEFAULT nextval('document_types_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT document_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.form_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by character varying,
  profile_id uuid,
  document_number character varying,
  email character varying,
  phone character varying,
  full_name character varying,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT form_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT FK_56176b21d723c3b3344305c48e1 FOREIGN KEY (form_id) REFERENCES public.forms(id),
  CONSTRAINT FK_c915880111f9b8892e516c45f5b FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  description text NOT NULL,
  type character varying NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_id character varying NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT forms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid,
  sender_id uuid,
  content text NOT NULL,
  type character varying DEFAULT 'text'::character varying CHECK (type::text = ANY (ARRAY['text'::character varying, 'image'::character varying, 'file'::character varying]::text[])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  read_at timestamp with time zone,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  document_number character varying,
  phone character varying,
  first_name character varying,
  last_name character varying,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

