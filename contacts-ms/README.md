## Contacts Microservice (contacts-ms)

Microservicio NestJS (TCP) para **sincronización y verificación de contactos** en chunks, con:

- Estado por usuario (`contact_sync_state`)
- Cache por contacto (`contact_match_cache`)
- **Idempotencia** por `(user_id, batch_id, chunk_index)` (`contact_sync_chunk_results`)

### Variables de entorno

- **contactsPort**: puerto TCP del microservicio (default `3007`)
- **DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME**: conexión Postgres (misma convención de `auth-ms`)
- **CONTACTS_CHUNK_SIZE**: tamaño del chunk (default `100`)
- **CONTACTS_THROTTLE_MS**: delay recomendado entre chunks (default `60000`)
- **CONTACTS_SYNC_VERSION**: versión lógica para invalidar estados (default `1`)

### Contratos RPC (Gateway → contacts-ms)

- `contacts_sync_get_state` `{ userId }`
- `contacts_sync_start` `{ userId, deviceId?, syncMode: 'full'|'delta', estimatedTotal? }`
- `contacts_sync_chunk` `{ userId, batchId, chunkIndex, contacts: string[], cursorAfterChunk? }`
- `contacts_sync_complete` `{ userId, batchId, finalCursor? }`
- `contacts_sync_pause` `{ userId, batchId }`
- `contacts_sync_resume` `{ userId, batchId }`

### SQL requerido

Aplicar `../sql/contacts_sync_tables.sql` en tu base de datos.









