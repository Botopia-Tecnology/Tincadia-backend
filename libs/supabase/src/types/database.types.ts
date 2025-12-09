/**
 * Tipos para chat 1:1
 */

export interface Conversation {
    id: string;
    user1_id: string;
    user2_id: string;
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    type: 'text' | 'image' | 'file';
    created_at: string;
    read_at: string | null;
}
