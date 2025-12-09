-- ============================================
-- Tincadia Chat 1:1 Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Conversaciones 1:1 entre dos usuarios
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Evitar duplicados: solo una conversación entre dos usuarios
  UNIQUE(user1_id, user2_id)
);

-- Mensajes de chat
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- ============================================
-- Índices
-- ============================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user1 
  ON conversations(user1_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user2 
  ON conversations(user2_id);

-- ============================================
-- Habilitar Realtime para mensajes
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- Función para obtener o crear conversación
-- ============================================

CREATE OR REPLACE FUNCTION get_or_create_conversation(p_user1 UUID, p_user2 UUID)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_sorted_user1 UUID;
  v_sorted_user2 UUID;
BEGIN
  -- Ordenar IDs para consistencia
  IF p_user1 < p_user2 THEN
    v_sorted_user1 := p_user1;
    v_sorted_user2 := p_user2;
  ELSE
    v_sorted_user1 := p_user2;
    v_sorted_user2 := p_user1;
  END IF;

  -- Buscar conversación existente
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE user1_id = v_sorted_user1 AND user2_id = v_sorted_user2;

  -- Si no existe, crear nueva
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (user1_id, user2_id)
    VALUES (v_sorted_user1, v_sorted_user2)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;
