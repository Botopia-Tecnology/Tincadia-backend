# Tincadia Backend - Microservices Architecture

Sistema backend con arquitectura de microservicios para Tincadia.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY (3001)                     │
│  - JWT Authentication                                    │
│  - Rate Limiting                                         │
│  - Routing & Orchestration                               │
│  - TCP Communication                                     │
└─────┬───────┬───────┬───────┬───────────────────────────┘
      │       │       │       │
      ▼       ▼       ▼       ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐
│  AUTH   │ │ PAYMENTS│ │  FORMS  │ │ COMMUNICATION│
│ MS(3002)│ │ MS(3003)│ │ MS(3004)│ │   MS(3005)   │
│         │ │         │ │         │ │              │
│ TCP     │ │ TCP     │ │ TCP     │ │ TCP          │
└─────────┘ └─────────┘ └─────────┘ └──────────────┘
```

## 📦 Microservicios

### 1. API Gateway (Port: 3001) ⚠️ IMPORTANTE
- **Propósito**: Punto de entrada único
- **Funciones**:
  - Autenticación JWT
  - Rate limiting (100 req/min)
  - Orchestration
  - CORS y validación global
  - Comunicación TCP con microservicios

### 2. Auth MS (Port: 3002)
- **Propósito**: Servicio de autenticación y autorización
- **Funciones**:
  - Login de usuarios
  - Registro de usuarios
  - Logout
  - Gestión de perfiles
  - Validación de tokens JWT

### 3. Payments MS (Port: 3003)
- **Propósito**: Gestión de pagos
- **Funciones**:
  - Crear pagos
  - Consultar pagos
  - Actualizar pagos
  - Eliminar pagos
  - Procesamiento de transacciones

### 4. Forms MS (Port: 3004)
- **Propósito**: Gestión de formularios
- **Funciones**:
  - Crear formularios
  - Consultar formularios
  - Actualizar formularios
  - Eliminar formularios
  - Validación de datos

### 5. Communication MS (Port: 3005)
- **Propósito**: Servicio de comunicación
- **Funciones**:
  - Envío de mensajes
  - Consulta de mensajes
  - Actualización de mensajes
  - Eliminación de mensajes
  - Notificaciones

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x
- npm 10.x
- PostgreSQL (opcional)
- Redis (opcional para caching)

### Installation

```bash
# Install dependencies for each service
cd api-gateway && npm install
cd ../auth-ms && npm install
cd ../payments-ms && npm install
cd ../forms-ms && npm install
cd ../communication-ms && npm install
```

### Environment Variables

#### API Gateway (.env)

```env
PORT="3001"
authHost="localhost"
authPort="3002"
paymentsHost="localhost"
paymentsPort="3003"
formsHost="localhost"
formsPort="3004"
communicationHost="localhost"
communicationPort="3005"
DB_HOST="localhost"
DB_NAME="tincadia"
DB_PASSWORD=""
DB_PORT="5432"
DB_USER="postgres"
JWT_SECRET=""
```

#### Microservicios

Cada microservicio debe tener su archivo `.env` con:

```env
# auth-ms/.env
authPort="3002"
DB_HOST="localhost"
DB_NAME="tincadia"
DB_PASSWORD=""
DB_PORT="5432"
DB_USER="postgres"

# payments-ms/.env
paymentsPort="3003"
DB_HOST="localhost"
DB_NAME="tincadia"
DB_PASSWORD=""
DB_PORT="5432"
DB_USER="postgres"

# forms-ms/.env
formsPort="3004"
DB_HOST="localhost"
DB_NAME="tincadia"
DB_PASSWORD=""
DB_PORT="5432"
DB_USER="postgres"

# communication-ms/.env
communicationPort="3005"
DB_HOST="localhost"
DB_NAME="tincadia"
DB_PASSWORD=""
DB_PORT="5432"
DB_USER="postgres"
```

### Running Services

```bash
# Development (run each in separate terminal)
cd api-gateway && npm run start:dev
cd auth-ms && npm run start:dev
cd payments-ms && npm run start:dev
cd forms-ms && npm run start:dev
cd communication-ms && npm run start:dev

# Or use PM2 for production
pm2 start ecosystem.config.js
```

## 📋 API Endpoints

### API Gateway (http://localhost:3001)

#### Auth
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/profile/:id
```

#### Payments
```
POST   /api/payments
GET    /api/payments
GET    /api/payments/:id
PUT    /api/payments/:id
DELETE /api/payments/:id
```

#### Forms
```
POST   /api/forms
GET    /api/forms
GET    /api/forms/:id
PUT    /api/forms/:id
DELETE /api/forms/:id
```

#### Communication
```
POST   /api/communication/send
GET    /api/communication
GET    /api/communication/:id
PUT    /api/communication/:id
DELETE /api/communication/:id
```

## 🔌 Comunicación TCP

Todos los microservicios se comunican mediante TCP (Transport Layer Protocol) con el API Gateway:

- **Transport**: TCP
- **Protocolo**: NestJS Microservices
- **Host**: Configurado vía variables de entorno
- **Port**: Cada microservicio usa su puerto asignado

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 🚢 Deployment

Cada servicio puede ser desplegado independientemente en plataformas como Railway, Render, o AWS con las variables de entorno configuradas.

## 📊 Monitoring

- Health checks: `/api/health`
- Logs: Structured JSON logging
- Metrics: Prometheus compatible

## 🏛️ Estructura del Proyecto

```
tincadia-backend/
├── api-gateway/          # API Gateway (Puerto 3001) ⚠️ IMPORTANTE
│   ├── src/
│   │   ├── auth/        # Módulo Auth (TCP)
│   │   ├── payments/    # Módulo Payments (TCP)
│   │   ├── forms/       # Módulo Forms (TCP)
│   │   └── communication/ # Módulo Communication (TCP)
│   └── package.json
├── auth-ms/              # Auth Microservice (Puerto 3002)
├── payments-ms/          # Payments Microservice (Puerto 3003)
├── forms-ms/             # Forms Microservice (Puerto 3004)
└── communication-ms/     # Communication Microservice (Puerto 3005)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

Private - Tincadia
