# Chat Microservice

Microservicio de chat en tiempo real usando Supabase Realtime.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Crear tablas en Supabase
# Ejecutar supabase-schema.sql en el SQL Editor de Supabase

# Iniciar en desarrollo
npm run start:dev
```

## 📡 Endpoints (TCP Message Patterns)

### Chat (Mensajes)
| Pattern | Descripción |
|---------|-------------|
| `send_message` | Enviar mensaje a una sala |
| `get_messages` | Obtener mensajes con paginación |
| `mark_as_read` | Marcar mensajes como leídos |
| `edit_message` | Editar un mensaje |
| `delete_message` | Eliminar un mensaje |

### Rooms (Salas)
| Pattern | Descripción |
|---------|-------------|
| `create_room` | Crear sala privada o grupal |
| `get_rooms` | Obtener salas del usuario |
| `get_room` | Obtener sala por ID |
| `add_participant` | Agregar participante |
| `remove_participant` | Remover participante |
| `delete_room` | Eliminar sala |

## 🔧 Variables de Entorno

```env
chatPort="3006"
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="xxx"
SUPABASE_SERVICE_KEY="xxx"
```

## 📁 Estructura

```
src/
├── shared/supabase/     # Cliente Supabase compartido
├── chat/                # Módulo de mensajes
├── rooms/               # Módulo de salas
└── main.ts              # Entry point (puerto 3006)
```
