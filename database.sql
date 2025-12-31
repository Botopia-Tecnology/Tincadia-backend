-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'news'::text CHECK (type = ANY (ARRAY['news'::text, 'update'::text, 'promotion'::text])),
  image_url text,
  link_url text,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT app_notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_match_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_key character varying NOT NULL,
  matched_user_id uuid,
  matched boolean NOT NULL DEFAULT false,
  checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contact_match_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_sync_chunk_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contact_sync_chunk_results_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_sync_state (
  user_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'idle'::character varying,
  sync_version integer NOT NULL DEFAULT 1,
  last_full_sync_at timestamp with time zone,
  last_delta_sync_at timestamp with time zone,
  cursor integer,
  device_id character varying,
  last_batch_id uuid,
  last_sync_mode character varying,
  last_chunk_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contact_sync_state_pkey PRIMARY KEY (user_id)
);
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
  type character varying DEFAULT 'text'::character varying CHECK (type::text = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'call'::text, 'call_ended'::text, 'audio'::text])),
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
  phone character varying UNIQUE,
  first_name character varying,
  last_name character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  document_type_id integer,
  push_token character varying,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_notification_reads (
  user_id uuid NOT NULL,
  notification_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_notification_reads_pkey PRIMARY KEY (user_id, notification_id),
  CONSTRAINT user_notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.app_notifications(id),
  CONSTRAINT user_notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);