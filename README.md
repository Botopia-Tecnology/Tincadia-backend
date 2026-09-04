<!-- prettier-ignore -->
<div align="center">

# Tincadia Backend

[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/LiveKit-1f1f1f?style=flat-square&logo=livekit&logoColor=white)](https://livekit.io)

**Arquitectura de microservicios de Tincadia** — plataforma de tecnología inclusiva que conecta a personas sordas, oyentes y organizaciones.

[Arquitectura](#arquitectura) • [Servicios](#servicios) • [Empezar](#empezar) • [Configuración](#configuración) • [Comandos](#comandos) • [Despliegue](#despliegue)

</div>

## Arquitectura

Un **API Gateway** expone HTTP al exterior y se comunica con los microservicios por TCP. Los microservicios no se exponen: el gateway es el único punto de entrada.

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
  │ :3002 ││ :3003 ││ :3004 ││:3006│ │  :8000   │
  └───────┘└───────┘└───────┘└─────┘ └──────────┘
  ┌────────────┐┌────────┐┌────────┐┌───────────┐
  │communica-  ││contacts││content ││ emergency │
  │ tion :3005 ││ :3007  ││ :3008  ││   :3009   │
  └────────────┘└────────┘└────────┘└───────────┘
```

Los datos viven en [Supabase](https://supabase.com) (Postgres) y las videollamadas usan [LiveKit](https://livekit.io).

## Servicios

| Servicio | Puerto | Variable | Responsabilidad |
|---|---|---|---|
| `api-gateway` | 3001 | `PORT` | Entrada HTTP. Autenticación, rate limiting, CORS, validación y enrutamiento |
| `auth-ms` | 3002 | `authPort` | Registro, login, perfiles, roles y tokens de notificación push |
| `payments-ms` | 3003 | `paymentsPort` | Pagos y transacciones (Wompi) |
| `forms-ms` | 3004 | `formsPort` | Formularios y validación de datos |
| `communication-ms` | 3005 | `communicationPort` | Mensajería y notificaciones generales |
| `chat-ms` | 3006 | `chatPort` | Chat, señalización de llamadas y push (APNs/VoIP, FCM, Expo) |
| `contacts-ms` | 3007 | `contactsPort` | Agenda de contactos |
| `content-ms` | 3008 | `contentPort` | Contenidos de la plataforma |
| `emergency-ms` | 3009 | `emergencyPort` | Flujo de emergencias |
| `Model-ms` | 8000 | `MODEL_MS_URL` | Servicio Python de IA: reconocimiento de LSC, transcripción y voz |

El gateway expone además un módulo `calls` que emite los tokens de acceso a las salas de LiveKit.

> [!NOTE]
> `Model-ms` es el único servicio en **Python**, y el único que se consume por HTTP en vez de TCP. Usa TensorFlow, MediaPipe, PyTorch, Vosk y gTTS para reconocimiento de lengua de señas colombiana (LSC), transcripción y síntesis de voz.

## Empezar

### Requisitos

- [Node.js](https://nodejs.org) 22.x y npm 10.x
- [Docker](https://www.docker.com) y Docker Compose — recomendado para desarrollo
- [Python](https://www.python.org) 3.x, solo si vas a correr `Model-ms` fuera de Docker
- Un proyecto de [Supabase](https://supabase.com) y credenciales de [LiveKit](https://livekit.io)

### Instalación

```bash
git clone https://github.com/Botopia-Tecnology/Tincadia-backend.git
cd Tincadia-backend
```

Con Docker Compose no hace falta instalar nada más: las imágenes resuelven sus dependencias al construirse.

Sin Docker, cada servicio tiene las suyas:

```bash
for s in api-gateway auth-ms payments-ms forms-ms communication-ms \
         chat-ms contacts-ms content-ms emergency-ms; do
  (cd "$s" && npm install)
done
```

### Ejecutar

**Con Docker Compose** — levanta los diez servicios con la red interna ya resuelta:

```bash
docker compose up --build
```

El gateway queda en `http://localhost:3001`. Para pararlo, `docker compose down`.

**Sin Docker** — cada servicio en su propia terminal:

```bash
cd api-gateway && npm run start:dev
cd auth-ms     && npm run start:dev
# …y así con el resto
```

> [!IMPORTANT]
> El gateway no funciona solo: los microservicios que vaya a usar deben estar arriba, o las llamadas TCP fallan.

## Configuración

Cada servicio lleva su propio `.env`. Parte de los `.env.example` incluidos:

```bash
cp api-gateway/.env.example api-gateway/.env
```

El **API Gateway** necesita el host y puerto de cada microservicio, más:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP del gateway (3001) |
| `JWT_SECRET` | Secreto de firma de los JWT |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma |
| `<servicio>Host` / `<servicio>Port` | Destino TCP de cada microservicio |
| `MODEL_MS_URL` | URL HTTP de Model-ms |

Los **microservicios** necesitan su puerto propio, la conexión a Supabase y las credenciales de los proveedores que usen: LiveKit en `chat-ms`, Wompi en `payments-ms`.

> [!WARNING]
> Los `.env` no se versionan. Solo se suben los `.env.example`, y sin valores reales.

## Comandos

Los mismos en todos los servicios de NestJS:

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Desarrollo con recarga automática |
| `npm run start:debug` | Desarrollo con depurador |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta lo compilado (`node dist/main`) |
| `npm run lint` | ESLint con `--fix` |
| `npm run format` | Prettier sobre `src/` y `test/` |
| `npm test` | Tests unitarios (Jest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:cov` | Cobertura |
| `npm run test:e2e` | Tests end-to-end |

## Estructura

```
Tincadia-backend/
├── api-gateway/          # Entrada HTTP (3001)
│   └── src/
│       ├── auth/  chat/  calls/  contacts/  content/
│       ├── emergency/  forms/  payments/  communication/
│       ├── Model-ms/     # Cliente HTTP de Model-ms
│       ├── common/       # Guards, filtros, utilidades
│       └── config/
├── auth-ms/              # Microservicios TCP,
├── chat-ms/              # todos con la misma
├── payments-ms/          # estructura de NestJS
├── forms-ms/
├── communication-ms/
├── contacts-ms/
├── content-ms/
├── emergency-ms/
├── Model-ms/             # Servicio Python (IA/LSC)
│   ├── app/
│   ├── models/
│   └── Dockerfile
└── docker-compose.yml
```

Cada microservicio sigue el estándar de NestJS: `<dominio>.module.ts`, `.controller.ts`, `.service.ts` y una carpeta `dto/`. La comunicación entre servicios va por TCP con `@MessagePattern`.

> [!CAUTION]
> Declara siempre los DTO como clase en su propio archivo, con decoradores de validación. El `ValidationPipe` corre con `whitelist: true` y descarta toda propiedad sin decorador, así que un tipo declarado en línea en el `@Body()` o el `@Payload()` deja el objeto vacío en tiempo de ejecución. `auth-ms` tiene su propio `ValidationPipe`: un DTO nuevo se declara en los dos lados.

## Despliegue

Cada servicio se despliega de forma independiente en [Railway](https://railway.app), con sus variables de entorno configuradas en la plataforma:

```bash
npm run build && npm run start:prod
```

`Model-ms` se despliega como imagen Docker por su cadena de dependencias de Python.
