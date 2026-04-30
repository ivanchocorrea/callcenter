# Notas de implementación — Fases 3 a 8

Este documento describe lo construido en esta segunda entrega.

## Fase 3 — SIP Trunks

**Backend** (`backend/src/sip/`):
- `entities/sip-trunk.entity.ts` — entidad TypeORM con todos los campos
- `dto/sip-trunk.dto.ts` — DTOs de creación y update parcial
- `sip-trunks.service.ts` — CRUD completo + cifrado AES-256-GCM de password + test de conexión SIP OPTIONS (UDP y TCP)
- `asterisk-realtime.service.ts` — escribe `ps_aors`, `ps_auths`, `ps_endpoints`, `ps_registrations` para que Asterisk consuma vía `res_pjsip_realtime` (sin reload)
- `sip-trunks.controller.ts` — endpoints REST con permisos `sip.view` / `sip.manage`
- `sip.module.ts`

**Frontend** (`frontend/app/admin/sip-trunks/`):
- `page.tsx` — listado con status, último error, botón probar
- `TrunkFormModal.tsx` — formulario con modo simple y avanzado (NAT, ICE, SRTP, codecs, prioridad...)

**Endpoints**:
- `GET /api/sip-trunks`
- `POST /api/sip-trunks`
- `GET /api/sip-trunks/:id`
- `PATCH /api/sip-trunks/:id`
- `DELETE /api/sip-trunks/:id`
- `POST /api/sip-trunks/:id/test`

## Fase 4 — Asterisk Bridge

**Backend** (`backend/src/asterisk/`):
- `asterisk-bridge.service.ts` — conexión persistente a ARI WebSocket con reconexión exponencial + AMI fallback. Carga `ari-client` y `asterisk-manager` con `require` dinámico para no romper si no están instalados (dev sin Asterisk).
- Comandos expuestos: `continueInDialplan`, `playback`, `hold`, `bridge`, `hangup`, `snoop`, `originate`, `setChannelVar`, `sendDtmf`.
- Despacha eventos a `EventBusService` en canal `asterisk:event`: `StasisStart`, `StasisEnd`, `ChannelStateChange`, `ChannelDtmfReceived`, `ChannelHangupRequest`, `ChannelDestroyed`, `BridgeCreated`, `ChannelEnteredBridge`, `ChannelLeftBridge`, `PlaybackStarted/Finished`.

**Infraestructura agregada**:
- `backend/src/common/redis/redis.service.ts` — cliente ioredis singleton + pub/sub
- `backend/src/events/event-bus.service.ts` — bus interno (EventEmitter local + Redis pub/sub para clústeres)

## Fase 5 — WebRTC

**Backend** (`backend/src/webrtc/`):
- `webrtc.service.ts` — `GET /api/webrtc/credentials` devuelve sip_uri, sip_password (descifrado), wss_url, ice_servers (STUN/TURN configurables por empresa), session_token efímero.

**Frontend** (`frontend/lib/webrtc/`):
- `sip-client.ts` — wrapper sobre SIP.js: register, dial, answer, hangup, hold (SDP modifier sendonly/inactive), setMuted, sendDtmf, attachRemoteAudio. Maneja `setSinkId` para selección de output device.
- `sip-context.tsx` — `SipProvider` + `useSip()` hook. Estado: `idle | connecting | registered | unregistered | failed`. Expone `incoming`, `active`, `dial`, `answer`, `hangup`, `toggleHold`, `toggleMute`.

## Fase 6 — Inbound + Realtime

**Backend** (`backend/src/inbound-calls/`, `backend/src/calls/`, `backend/src/realtime/`):
- `inbound-dispatcher.service.ts` — escucha `asterisk:event`, en `StasisStart args[0]='inbound'`:
  1. Lee `X-Company-Id`, `X-Trunk-Id` de las variables de canal
  2. Crea `calls` con `direction='inbound'`
  3. Hace lookup de cliente por `from_number` (E.164 normalizado) en `customers` + `customer_phones`
  4. Asocia `customer_id` si encuentra
  5. Publica `call.incoming` al canal `co:<companyId>:call`
- `realtime.gateway.ts` — Socket.IO namespace `/realtime` con auth JWT, rooms `company:<id>` y `user:<id>`
- `realtime-forwarder.service.ts` — patcha `EventBusService.publish` para que cualquier `co:<id>:<topic>` se reemita por Socket.IO al room `company:<id>` automáticamente

**Frontend**:
- `lib/realtime/realtime-context.tsx` — `RealtimeProvider` con socket.io-client, autenticado con el access token, reconexión automática
- `components/agent/IncomingCallPopup.tsx` — popup global (montado en AppShell) que escucha `call.incoming`, reproduce timbre (`/sounds/ring.mp3`), permite contestar/rechazar/silenciar, integra con `useSip().answer()`

## Fase 7 — Outbound Dialer

**Backend** (`backend/src/outbound-dialer/`):
- `outbound-dialer.service.ts` — `dial()` valida agente activo, valida DNC, selecciona troncal (la dada o la de mayor prioridad), crea `calls` con direction outbound, ejecuta `asterisk.originate({ endpoint: 'PJSIP/<extension_agente>', context: 'outbound-bridge', extension: number, ... })`. Cuando el agente contesta su navegador, Asterisk llama al destino vía la troncal.
- `outbound-dialer.controller.ts` — `POST /api/dial`, `POST /api/dial/:id/hangup`, `GET /api/dial/recent`

**Asterisk dialplan** (`asterisk/etc/extensions.conf`):
- Nuevo contexto `[outbound-bridge]` que ejecuta `Dial(PJSIP/${EXTEN}@${TRUNK_NAME})` cuando el agente contesta.

**Frontend** (`frontend/app/agent/dialer/page.tsx`):
- Conectado al backend: `POST /api/dial` y `GET /api/dial/recent`. Muestra historial real con duración, estado y botón "volver a marcar".

## Fase 8 — CRM Customers + Import

**Backend** (`backend/src/customers/`):
- `entities/customer.entity.ts`
- `dto/customer.dto.ts`
- `customers.service.ts` — list (con search, filtros vip/status, paginación), findById, findByPhone (busca en customers y customer_phones), create + sync de customer_phones, update, soft delete, listNotes/addNote, timeline.
- `customers.controller.ts` — endpoints REST con permisos `customers.view` y `customers.manage`
- `import.service.ts` — `detectColumns(csv)` con autodetección de separador (`,`, `;`, `\t`, `|`), `runImport()` con dedupe por phone/document, skip DNC, registro fila a fila en `import_jobs` y `import_job_rows`.
- `import.controller.ts` — `POST /api/imports/detect-columns`, `POST /api/imports/run`, `GET /api/imports`

**Frontend**:
- `app/admin/customers/page.tsx` — buscador, filtros (VIP), tabla con badge de estado, link a detalle
- `app/admin/imports/page.tsx` — wizard: upload CSV → detección de columnas → mapping (con auto-detect heurístico) → opciones (dedupe, DNC) → ejecutar → reporte de resultado + listado de jobs anteriores

## Cambios transversales

### `app.module.ts`
Ahora importa los 9 módulos nuevos: `SipModule`, `AsteriskModule`, `WebRtcModule`, `CallsModule`, `InboundCallsModule`, `RealtimeModule`, `OutboundDialerModule`, `CustomersModule`, más los globales `RedisModule` y `EventsModule`.

### `frontend/app/providers.tsx`
Agrega `RealtimeProvider` y `SipProvider` envolviendo a la app.

### `frontend/components/shared/AppShell.tsx`
- Inicia `sip.start()` automáticamente cuando el usuario es agente
- Muestra badge de estado SIP (`registered` / `connecting` / `failed`) y de realtime (`connected` / `offline`) en el header
- Renderiza `<IncomingCallPopup />` global

## Cómo verificar end-to-end

1. `docker compose up -d`
2. Login como super-admin → crear una empresa → crear un company-admin
3. Login como company-admin
4. **Fase 3**: Ir a "Troncales SIP" → "Nueva troncal" → llenar datos del proveedor → guardar → "Probar"
5. **Fase 8**: Ir a "Clientes" → crear uno con teléfono `+573001112233`
6. **Fase 8**: Ir a "Importar" → subir CSV con columnas Nombre/Teléfono → confirmar mapping → importar
7. Crear un usuario con rol `agent` y crear un Agente para él (ext 1001)
8. Login como agente → debería iniciar SIP automáticamente (header verde)
9. **Fase 7**: Ir a "Marcador" → marcar un número → verificar que el navegador timbra y luego se conecta
10. **Fase 6**: Llamar al DID de la troncal desde un teléfono externo → el agente debería ver el popup en pantalla con los datos del cliente (si el número estaba registrado)

## Próximos pasos

- **Fase 9 (IVR)**: builder visual + ejecución vía ARI playback + DTMF capture
- **Fase 10 (Colas)**: Asterisk app_queue + posición lógica en Redis ZSET + anuncio TTS de turno + supervisor live dashboard
- **Fase 11 (Grabaciones)**: storage drivers + retención + acceso auditado
- **Fase 13 (Webhooks)**: outbox dispatcher + HMAC + reintentos
- **Fase 15 (IA)**: AIProviderService real con OpenAI/Claude/Gemini

Cada una de estas fases tiene un documento de diseño detallado en `docs/`.
