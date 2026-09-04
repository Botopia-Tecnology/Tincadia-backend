# Tincadia Backend

Backend de Tincadia, plataforma de tecnología inclusiva que conecta a personas sordas, oyentes y organizaciones. Arquitectura de microservicios sobre NestJS.

## Arquitectura

Un API Gateway expone HTTP al exterior y habla con los microservicios por **TCP** (transporte de NestJS Microservices). La única excepción es Model-ms, que es un servicio Python y se consume por HTTP.

```
                         Apps (móvil / web)
                                 │  HTTP
                                 ▼
                    ┌────────────────────────┐
                    │   API Gateway  :3001   │
                    │  JWT · rate limit ·    │
                    │  CORS · validación     │
                    └───┬────────────────┬───┘
                 TCP    │                │   HTTP
      ┌─────────────────┼────────┐       ▼
      ▼        ▼        ▼        ▼   ┌──────────┐
  ┌───────┐┌───────┐┌───────┐┌─────┐ │ Model-ms │
  │ auth  ││payment││ forms ││chat │ │ (Python) │
  │ :3002 ││ :3003 ││ :3004 ││:3006│ │  IA/LSC  │
  └───────┘└───────┘└───────┘└─────┘ └──────────┘
  ┌────────────┐┌────────┐┌────────┐┌───────────┐
  │communica-  ││contacts││content ││ emergency │
  │ tion :3005 ││ :3007  ││ :3008  ││   :3009   │
  └────────────┘└────────┘└────────┘└───────────┘
```

Los datos viven en **Supabase** (Postgres + Auth + RLS). Las videollamadas usan **LiveKit**.

## Servicios

| Servicio | Puerto | Variable de entorno | Responsabilidad |
|---|---|---|---|
| `api-gateway` | 3001 | `PORT` | Único punto de entrada HTTP. Autenticación, rate limiting, CORS, validación y enrutamiento. |
| `auth-ms` | 3002 | `authPort` | Registro, login, perfiles, roles y tokens de notificación push. |
| `payments-ms` | 3003 | `paymentsPort` | Pagos y transacciones (Wompi). |
| `forms-ms` | 3004 | `formsPort` | Formularios y validación de datos. |
| `communication-ms` | 3005 | `communicationPort` | Mensajería y notificaciones generales. |
| `chat-ms` | 3006 | `chatPort` | Chat, señalización de llamadas y envío de push (APNs/VoIP, FCM, Expo). |
| `contacts-ms` | 3007 | `contactsPort` | Agenda de contactos. |
| `content-ms` | 3008 | `contentPort` | Contenidos de la plataforma. |
| `emergency-ms` | 3009 | `emergencyPort` | Flujo de emergencias. |
| `Model-ms` | 8000 | `MODEL_MS_URL` | Servicio Python de IA: reconocimiento de LSC, transcripción y voz. Se consume por HTTP, no por TCP. |

El gateway además expone un módulo `calls` que emite los tokens de acceso a las salas de LiveKit.

### Model-ms

A diferencia del resto, es un servicio **Python** con su propio `Dockerfile`. Usa TensorFlow, MediaPipe, PyTorch, Vosk y gTTS para reconocimiento de lengua de señas colombiana (LSC), transcripción y síntesis de voz, y se conecta a LiveKit para trabajar sobre las llamadas en curso.

## Puesta en marcha

### Requisitos

- Node.js 22.x y npm 10.x
- Python 3.x y Docker (solo para `Model-ms`)
- Acceso a un proyecto de Supabase
- Credenciales de LiveKit

### Instalación

Cada servicio tiene sus propias dependencias:

```bash
for s in api-gateway auth-ms payments-ms forms-ms communication-ms \
         chat-ms contacts-ms content-ms emergency-ms; do
  (cd "$s" && npm install)
done
```

### Variables de entorno

Cada servicio lleva su propio `.env`. Parte de los `.env.example` incluidos:

```bash
cp api-gateway/.env.example api-gateway/.env
```

El gateway necesita el host y puerto de cada microservicio (`authHost`/`authPort`, `chatHost`/`chatPort`, …), `JWT_SECRET`, `CORS_ORIGIN` y la conexión a Supabase. Los microservicios necesitan su puerto propio y sus credenciales.

> **Nunca subas un `.env` al repositorio.** Solo se versionan los `.env.example`, y sin valores reales.

### Ejecución

En desarrollo, cada servicio en su terminal:

```bash
cd api-gateway && npm run start:dev
cd auth-ms     && npm run start:dev
# …y así con el resto
```

El gateway no funciona solo: los microservicios que vaya a usar deben estar arriba, o las llamadas TCP fallan.

## Notas de implementación

Detalles que no se deducen leyendo el código por encima y que han costado depuración:

### La validación descarta los DTO declarados en línea

`ValidationPipe` corre con `whitelist: true`, así que **borra toda propiedad sin decorador de validación**. Un tipo declarado en línea en el `@Body()` o el `@Payload()` se borra en tiempo de ejecución (TypeScript lo reduce a `Object`), y el handler recibe un objeto vacío.

Siempre una clase DTO con sus decoradores, en su archivo. Y ojo: `auth-ms` tiene su **propio** `ValidationPipe`, así que un DTO nuevo hay que declararlo en los dos lados.

### Push de llamadas en iOS

PushKit obliga a iOS a **pintar la pantalla de llamada por cada push VoIP** que recibe — Apple mata la app si no se reporta a CallKit. Por eso `chat-ms` solo manda por VoIP el `call` y los terminales que cancelan un timbre en curso; un `call_ended` de una llamada ya contestada producía un banner fantasma de ~2 s en el aparato del receptor.

Android no tiene ese problema: FCM entrega los datos a JS sin pintar nada.

El `expiry` de APNs es la **ventana de reintento**, no la duración del timbre: un valor alto hace que APNs entregue tarde un aviso de llamada que ya no existe.

### Supabase y RLS

Las tablas tienen RLS activo. Dos cosas que confunden al depurar:

- Un `UPDATE` que no afecta ninguna fila **no devuelve error** en PostgREST: la respuesta es de éxito con cero filas. Un "guardado correctamente" no prueba que se haya escrito nada.
- Solo `service_role` esquiva RLS. Si un servicio opera con la clave pública, necesita policies explícitas.

Las conversaciones 1 a 1 usan las columnas `user1_id`/`user2_id`, no la tabla de participantes.

## Despliegue

Cada servicio se despliega por separado (Railway en producción) con sus variables de entorno. `Model-ms` va como imagen Docker por su cadena de dependencias de Python.

## Licencia

Privado — Tincadia.
