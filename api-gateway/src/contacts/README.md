## Contacts Sync (API Gateway)

Rutas HTTP (con prefijo global `/api`) que proxy a `contacts-ms` y requieren `Authorization: Bearer <JWT>`.

### Endpoints

- `GET /api/contacts/sync/state`
- `POST /api/contacts/sync/start`
- `POST /api/contacts/sync/chunk`
- `POST /api/contacts/sync/complete`
- `POST /api/contacts/sync/pause`
- `POST /api/contacts/sync/resume`

### Notas

- El gateway valida el JWT llamando a `AUTH_SERVICE` (`verify_token`) y deriva `userId`.
- El microservicio aplica chunkSize/throttle y guarda idempotencia por `(batchId, chunkIndex)`.










