# API Gateway - Tincadia

## Descripción

Punto de entrada único para todas las peticiones del sistema Tincadia. Implementa:

- **Autenticación JWT**: Validación de tokens en todas las rutas protegidas
- **Rate Limiting**: Control de tasa de peticiones por IP/usuario
- **Routing**: Enrutamiento a los microservicios backend
- **Comunicación TCP**: Todos los microservicios se comunican mediante TCP
- **Orchestration**: Orquesta las peticiones sin tocar lógica de dominio

## Puertos

- API Gateway: `3001` ⚠️ IMPORTANTE (configurable vía PORT)
- Auth MS: `3002`
- Payments MS: `3003`
- Forms MS: `3004`
- Communication MS: `3005`

## Comunicación TCP

El API Gateway se comunica con todos los microservicios mediante **TCP** (Transport Control Protocol):

- Cada módulo configura su cliente TCP con `Transport.TCP`
- Los microservicios escuchan en sus puertos asignados
- Configuración mediante variables de entorno

### Configuración de Microservicios

```typescript
// Ejemplo: auth.module.ts
ClientsModule.register([
  {
    name: 'AUTH_SERVICE',
    transport: Transport.TCP,
    options: {
      host: process.env.authHost || 'localhost',
      port: parseInt(process.env.authPort || '3002'),
    },
  },
])
```

## Scripts

```bash
# Desarrollo
npm run start:dev

# Producción
npm run start:prod

# Build
npm run build

# Linting
npm run lint

# Tests
npm test
npm run test:e2e
npm run test:cov
```

## Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

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
JWT_SECRET="tu-secret-key-aqui"
```

## Módulos

### Auth Module
- Comunicación TCP con `auth-ms` (puerto 3002)
- Endpoints: `/api/auth/*`

### Payments Module
- Comunicación TCP con `payments-ms` (puerto 3003)
- Endpoints: `/api/payments/*`

### Forms Module
- Comunicación TCP con `forms-ms` (puerto 3004)
- Endpoints: `/api/forms/*`

### Communication Module
- Comunicación TCP con `communication-ms` (puerto 3005)
- Endpoints: `/api/communication/*`

## Estructura

```
api-gateway/
├── src/
│   ├── auth/              # Módulo Auth (TCP a auth-ms)
│   ├── payments/          # Módulo Payments (TCP a payments-ms)
│   ├── forms/             # Módulo Forms (TCP a forms-ms)
│   ├── communication/     # Módulo Communication (TCP a communication-ms)
│   ├── app.module.ts      # Módulo principal
│   └── main.ts            # Bootstrap
├── package.json
└── tsconfig.json
```

## Tecnologías

- **NestJS**: Framework principal
- **@nestjs/microservices**: Comunicación TCP
- **@nestjs/throttler**: Rate limiting
- **@nestjs/jwt**: Autenticación JWT
- **class-validator**: Validación de DTOs
- **TypeScript**: Lenguaje principal
