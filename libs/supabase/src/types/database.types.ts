/**
 * Tipos de base de datos de Supabase para Tincadia
 * Generados manualmente - actualizar según el schema de la BD
 */

export interface Database {
    public: {
        Tables: {
            rooms: {
                Row: {
                    id: string;
                    name: string | null;
                    type: 'private' | 'group';
                    created_by: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name?: string | null;
                    type?: 'private' | 'group';
                    created_by: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string | null;
                    type?: 'private' | 'group';
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            room_participants: {
                Row: {
                    room_id: string;
                    user_id: string;
                    joined_at: string;
                };
                Insert: {
                    room_id: string;
                    user_id: string;
                    joined_at?: string;
                };
                Update: {
                    room_id?: string;
                    user_id?: string;
                    joined_at?: string;
                };
            };
            messages: {
                Row: {
                    id: string;
                    room_id: string;
                    sender_id: string;
                    content: string;
                    type: 'text' | 'image' | 'file';
                    metadata: Record<string, any>;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                };
                Insert: {
                    id?: string;
                    room_id: string;
                    sender_id: string;
                    content: string;
                    type?: 'text' | 'image' | 'file';
                    metadata?: Record<string, any>;
                    created_at?: string;
                    updated_at?: string;
                    deleted_at?: string | null;
                };
                Update: {
                    id?: string;
                    room_id?: string;
                    sender_id?: string;
                    content?: string;
                    type?: 'text' | 'image' | 'file';
                    metadata?: Record<string, any>;
                    created_at?: string;
                    updated_at?: string;
                    deleted_at?: string | null;
                };
            };
        };
    };
}

// Tipos de ayuda
export type Room = Database['public']['Tables']['rooms']['Row'];
export type RoomInsert = Database['public']['Tables']['rooms']['Insert'];
export type RoomUpdate = Database['public']['Tables']['rooms']['Update'];

export type RoomParticipant = Database['public']['Tables']['room_participants']['Row'];
export type RoomParticipantInsert = Database['public']['Tables']['room_participants']['Insert'];

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

// Tipos para Realtime
export interface RealtimeMessage {
    id: string;
    room_id: string;
    sender_id: string;
    content: string;
    type: 'text' | 'image' | 'file';
    created_at: string;
    sender?: {
        id: string;
        email: string;
        first_name?: string;
        last_name?: string;
    };
}

export interface PresenceState {
    user_id: string;
    online_at: string;
    [key: string]: any;
}
