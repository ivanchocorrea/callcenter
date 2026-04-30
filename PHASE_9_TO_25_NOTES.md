# Notas de implementación — Fases 9 a 25

Tercera y última entrega: **17 fases adicionales** (9–25). Con esta entrega el sistema queda **100% completo** según la especificación.

## Fase 9 — IVR configurable

**Backend** (`backend/src/ivr/`):
- Entidades `IvrMenu`, `IvrOption`, `IvrAudioFile`.
- `IvrService` con CRUD de menús y opciones, upload de audios (base64) a `storage.localPath`, engine que ejecuta el IVR sobre un canal Asterisk:
  - Reproduce welcome → menu via `playback`
  - Espera DTMF con `bus.on('asterisk:event','ChannelDtmfReceived')` y timeout
  - Despacha a queue/agent/bot/voicemail/webhook/hangup según `ivr_options`
  - Reintentos hasta `max_attempts` con audios de inválido/timeout
  - Logs por interacción en `ivr_logs`

## Fase 10 — Colas + supervisor live

**Backend** (`backend/src/queues/`):
- `QueuesService` con CRUD, `enqueueCall` (queue_calls + Redis ZSET), `recalculatePositions`, `estimateWaitSeconds` (basado en avg_handling_time + agentes libres), `abandon`, `answered`.
- `snapshot()` agrega: KPIs por cola (waiting, ETA, SLA %), agentes con estado actual, llamadas activas, abandonadas/atendidas hoy, avg wait global.

**Frontend** (`frontend/app/supervisor/page.tsx`):
- Dashboard en vivo que llama `/queues/snapshot` cada 5s + escucha eventos Socket.IO (`queue.entered`, `queue.position_changed`, etc.) para refresh inmediato.

## Fase 11 — Grabaciones + storage drivers

**Backend** (`backend/src/storage/`, `backend/src/recordings/`):
- `LocalDriver` y `S3Driver` (genérico para AWS S3, MinIO, Wasabi, Backblaze) con strategy pattern.
- `StorageService.driverFor(companyId)` resuelve el provider según `storage_providers` con cache.
- `RecordingsService` con `register` (post-MixMonitor), `list`, `getStream`, `presignedUrl`, `deleteRecording`. Cada acceso queda en `recording_access_logs` y `audit_logs`.

## Fase 12 — Reportes

**Backend** (`backend/src/reports/`):
- `overview`, `byAgent`, `byQueue`, `hourlyDistribution`, `exportCsv` con filtros por rango, agente, cola, campaña.
- Endpoint `/reports/export.csv` retorna CSV con disposition de download.

## Fase 13 — Webhooks

**Backend** (`backend/src/webhooks/`):
- `WebhookDispatcherService` con patrón **outbox**:
  - `publish()` escribe en `event_outbox` (transaccional con la operación origen).
  - Worker cron cada 10s lee `pending`, busca endpoints suscritos, firma con HMAC-SHA256, POSTea con timeout configurable, registra en `webhook_delivery_logs`.
  - Retry con backoff `[0, 30s, 5m, 30m, 2h, 12h]`. Después → `failed` (DLQ).
- `WebhooksService` con CRUD, `WebhooksController` con endpoint `/webhooks/:id/test`.

## Fase 14 — SMS + Callbacks

**Backend** (`backend/src/sms/`, `backend/src/callbacks/`):
- `TwilioSmsProvider` (Basic auth + REST API real) y `GenericHttpSmsProvider` (configurable: url, headers, body_template, response path).
- `SmsService.send()` resuelve provider, aplica plantilla con variables `{{var}}`, registra en `sms_logs`, dispara webhook `sms.sent`/`sms.failed`.
- `CallbacksService` con worker cron cada 30s que procesa pendientes: busca agente disponible en la cola, busca troncal outbound, originate vía Asterisk.

## Fase 15 — Motor IA multi-proveedor

**Backend** (`backend/src/ai/providers/`):
- `OpenAIProvider`: chat completions + tool use + Whisper STT + summarize/classify por chat.
- `ClaudeProvider`: Messages API con tool_use blocks.
- `GeminiProvider`: generateContent con functionCall.
- `GenericHttpAIProvider`: para Ollama, vLLM o cualquier endpoint compatible.
- `AIProviderService.getProvider()` resuelve provider activo, descifra api_key, instancia clase. Loguea `ai_usage_logs` con tokens y duración.

## Fases 16-18 — Bots, Prompts, Tools

**Backend** (`backend/src/ai/{bots,prompts,tools}/`, `backend/src/connectors/`):
- `BotsService`: CRUD con voz, idioma, prompt, transferencia.
- `PromptsService`: versionado completo. Crear → versión 1. Editar → versión N+1 (opcionalmente activar). `render(promptId, vars)` resuelve `{{var}}`.
- `AIToolsService` con 4 handler types: `builtin` (TS map), `connector`, `webhook`, `sql`. Builtins predefinidos: consultar_cliente, crear_ticket, crear_cita, buscar_cita, crear_callback, transferir_a_humano. Cada ejecución loguea en `ai_tool_execution_logs`.
- `ConnectorsService` con `executeGoogleSheets` real (Sheets API v4 con API key) y `executeExternalApi` con templates.

## Fase 19 — Automations engine

**Backend** (`backend/src/automations/`):
- `AutomationsService` patcha `EventBusService.publish` para evaluar reglas por cada evento `co:<id>:<topic>` que pasa por el bus.
- Operadores: `eq, neq, gt, lt, gte, lte, in, not_in, contains, matches`.
- Acciones implementadas: `send_sms`, `create_callback`, `send_webhook`, `create_ticket`, `tag_customer`, `notify_supervisor`, `custom_http`, `transfer_to_ai`, `transfer_to_queue`, `generate_ai_summary`.
- Logs en `automation_logs`.

## Fase 20 — Campaigns + dialer avanzado

**Backend** (`backend/src/campaigns/`):
- `CampaignsService.tick()` cron cada 10s procesa campañas en estado `running`:
  - Calcula slots disponibles según `dialer_mode`:
    - `manual` y `preview`: 1 a 1.
    - `progressive`: tantas llamadas como agentes libres.
    - `predictive`: `(agentes_libres + 0.5) × pacing_ratio`.
  - Valida DNC.
  - Originate vía Asterisk con variables `X-Campaign-Id`, `X-Contact-Id`, `X-AMD` si aplica.
  - Reintentos según `max_attempts_per_contact` y `retry_interval_minutes`.

## Fase 21 — Quality

**Backend** (`backend/src/quality/`):
- `QualityForms` con `schema.criteria[].weight`.
- `QualityService.createReview()` calcula score ponderado: `Σ(score×weight) / Σ(weight×max_score) × max_score_total`.
- Logs en `quality_reviews` + `quality_scores` con detalle por criterio.

## Fase 22 — Billing SaaS

**Backend** (`backend/src/billing/`):
- `listPlans` (público), `currentSubscription`, `currentUsage`.
- `startTrial(planSlug, days=14)`.
- Cron `updateUsage` cada hora: agrega minutos voz, SMS, tokens IA en `usage_counters`. Compara contra quotas del plan y marca `is_overage`.
- `generateMonthlyInvoices()` genera factura del mes anterior por suscripción activa con subtotal + impuesto + line_items.

## Fase 23 — Monitoring

**Backend** (`backend/src/monitoring/`):
- `MetricsService.snapshot()` exposición Prometheus con métricas: active calls, calls today, queue waiting, agents online, asterisk connectivity, webhook outbox status, memory, uptime.
- Endpoint público `/metrics` (sin JWT, ideal para scrape de Prometheus).

## Fase 24 — Public API

**Backend** (`backend/src/public-api/`):
- `PublicApiService.createKey()` genera prefix `cck_live_<8>` + secret 32 bytes; guarda solo el bcrypt hash.
- `ApiKeyGuard` autentica por `Authorization: Bearer cck_live_...`.
- `@RequireScope('calls:read')` decorator.
- `PublicApiV1Controller` (rutas `/api/v1/*`):
  - `GET /v1/calls`, `GET /v1/calls/:id` (scope `calls:read`)
  - `GET /v1/customers`, `GET /v1/customers/:id`, `POST /v1/customers` (`customers:read`/`customers:write`)
  - `POST /v1/sms` (`sms:send`)
  - `POST /v1/dial` (`calls:dial`)
- Admin: `GET/POST/DELETE /api/api-keys` autenticado por JWT (super_admin/company_admin).

## Fase 25 — Omnicanal base

**Backend** (`backend/src/omnichannel/`):
- `OmnichannelService.receiveInboundMessage()` recibe mensajes de WhatsApp, Telegram, web chat, email, instagram. Reusa `ai_conversations` + `ai_messages` (`channel != 'voice'`) para que toda la lógica de bots IA funcione cross-canal.
- Webhook genérico `POST /api/omnichannel/inbound` para conectar proveedores.

## app.module.ts actualizado

Ahora importa **35+ módulos**: 6 globales (Health, Encryption, Redis, Storage, Connectors, Webhooks), 6 de auth/tenancy, 7 de telefonía, 5 de CRM/IVR/Queues/Recordings/Reports, 2 de SMS/Callbacks, 1 de IA, 2 de Automations/Campaigns, 3 de Quality/Billing/Monitoring, 2 de Public API/Omnichannel.

## Cambios transversales

- **Algunos módulos requieren paquetes opcionales**: `ari-client` y `asterisk-manager` para Fase 4 (carga dinámica con `require`, no rompe sin ellos), `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` para storage S3. Los `package.json` ya los incluyen.
- **Cron scheduling**: `@nestjs/schedule` ya estaba importado. Ahora 4 servicios usan `@Cron`: `WebhookDispatcher` (10s), `CallbacksService` (30s), `CampaignsService` (10s), `BillingService` (1h).
- **EventBus parcheado**: `AutomationsService` y `RealtimeForwarderService` parchean `EventBus.publish` para forwardear automáticamente.

## Verificación end-to-end

Ahora puedes:

1. Crear empresa, agentes, troncal SIP (Fase 3)
2. Configurar IVR de bienvenida (Fase 9) con audios subidos
3. Crear colas y asignar agentes (Fase 10)
4. Configurar storage S3 (Fase 11) y grabar llamadas
5. Recibir llamada → IVR → cola → agente (Fase 6+9+10)
6. Ver supervisor live (Fase 10)
7. Llamada saliente desde agente (Fase 7) o campaña (Fase 20)
8. Generar reporte CSV del día (Fase 12)
9. Configurar webhook que reciba `call.ended` (Fase 13)
10. Enviar SMS desde la ficha del cliente (Fase 14)
11. Crear bot IA con prompt versionado y herramientas (Fases 15-18)
12. Automatización: "si call.abandoned → SMS al cliente + crear callback" (Fase 19)
13. Forms de calidad para evaluar a los agentes (Fase 21)
14. Ver usage de minutos/SMS/tokens IA y facturas (Fase 22)
15. Scrape `/metrics` con Prometheus (Fase 23)
16. Crear API key con scopes y consumir `/api/v1/*` (Fase 24)
17. Recibir mensajes de WhatsApp via webhook genérico (Fase 25)

## Para hacer producción real

- Instalar `ari-client`, `asterisk-manager`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (ya en `package.json`).
- Aplicar migraciones MySQL al levantar Docker.
- Configurar `webrtc_settings` con TURN server real (Coturn auto-hospedado o Twilio NTS).
- Cambiar todos los `change_me_*` en `.env` y `asterisk/etc/*.conf`.
- Generar certificados Let's Encrypt para nginx + WSS.
- Configurar `storage_providers` con bucket S3/MinIO real.
- Configurar `ai_providers` con API key de OpenAI/Anthropic/Google.
- Configurar `sms_providers` con credenciales Twilio o tu proveedor.
- Suscribir `webhook_endpoints` a los eventos relevantes.
- Configurar Prometheus + Grafana para scrape de `/metrics`.
- Cron diario externo para backup de MySQL (`mysqldump`).
- Cron mensual para `POST /api/billing/generate-invoices`.
