# Backend modules — estado por fase

| Carpeta | Fase | Estado |
|---|---|---|
| `auth/` | 1 | ✅ JWT + refresh + 2FA + bootstrap super_admin |
| `companies/` | 1 | ✅ CRUD |
| `users/` | 1 | ✅ CRUD + asignación de roles |
| `roles/` | 1 | ✅ Lectura |
| `permissions/` | 1 | ✅ Lectura |
| `agents/` | 1 | ✅ CRUD con SIP secret cifrado |
| `audit/` | 1 | ✅ AuditService |
| `common/encryption` | 0 | ✅ AES-256-GCM |
| `common/redis` | 0 | ✅ Cliente + pub/sub |
| `common/health` | 0 | ✅ /health/live, /health/ready |
| `events/` | 0 | ✅ EventBus (in-process + Redis) |
| `sip/` | 3 | ✅ CRUD + test SIP OPTIONS UDP/TCP + AsteriskRealtime |
| `asterisk/` | 4 | ✅ ARI WebSocket + AMI fallback con reconexión |
| `webrtc/` | 5 | ✅ Provisioning de credenciales |
| `calls/` | 6 | ✅ CRUD lectura + transiciones de estado + finalize |
| `inbound-calls/` | 6 | ✅ Dispatcher StasisStart con lookup customer |
| `realtime/` | 6 | ✅ Socket.IO gateway con auth JWT y rooms por empresa |
| `outbound-dialer/` | 7 | ✅ POST /dial con DNC + originate ARI |
| `customers/` | 8 | ✅ CRUD + búsqueda + lookup phone + notas + timeline |
| `customers/import.service` | 8 | ✅ CSV con detect-columns + dedupe + DNC |
| `ivr/` | 9 | ✅ CRUD + audios + engine playback/DTMF |
| `queues/` | 10 | ✅ Enqueue + Redis ZSET + ETA + abandon + supervisor snapshot |
| `recordings/` | 11 | ✅ Drivers + retención + access logs |
| `storage/` | 11 | ✅ Local + S3/MinIO/Wasabi/Backblaze drivers |
| `reports/` | 12 | ✅ Overview + by-agent + by-queue + hourly + CSV export |
| `webhooks/` | 13 | ✅ Outbox + HMAC + retry + DLQ + delivery logs |
| `sms/` | 14 | ✅ Twilio + GenericHTTP providers + plantillas |
| `callbacks/` | 14 | ✅ Worker cron 30s |
| `ai/providers` | 15 | ✅ OpenAI + Claude + Gemini + GenericHTTP |
| `ai/bots` | 16 | ✅ CRUD |
| `ai/prompts` | 17 | ✅ Versionado + activación |
| `ai/tools` | 18 | ✅ Tool registry + 4 handler types + 6 builtins |
| `connectors/` | 18 | ✅ Google Sheets + External API |
| `automations/` | 19 | ✅ Engine event→condition→action con 10 acciones |
| `campaigns/` | 20 | ✅ Cron engine + AMD + 4 dialer modes |
| `quality/` | 21 | ✅ Forms + reviews con scoring ponderado |
| `billing/` | 22 | ✅ Plans + subscriptions + usage_counters cron + invoices |
| `monitoring/` | 23 | ✅ /metrics Prometheus |
| `public-api/` | 24 | ✅ API keys + scopes + endpoints v1 |
| `omnichannel/` | 25 | ✅ Service + inbound webhook genérico |

## Endpoints API totales (~80+)

**Auth/Users/Roles** (Fase 1):
- POST /auth/login, /auth/refresh, /auth/logout, GET /auth/me
- GET/POST/PATCH /companies, PATCH /:id/suspend, /:id/activate
- GET/POST/PATCH /users, PATCH /:id/password
- GET /roles, /permissions
- GET/POST /agents

**Telefonía** (Fases 3-7):
- GET/POST/PATCH/DELETE /sip-trunks, POST /:id/test
- GET /webrtc/credentials
- GET /calls, /calls/:id
- POST /dial, /dial/:id/hangup, GET /dial/recent

**CRM** (Fase 8):
- GET/POST/PATCH/DELETE /customers, GET /customers/lookup, GET /customers/:id/notes, /timeline
- GET /imports, POST /imports/detect-columns, /imports/run

**IVR / Queues / Recordings / Reports** (Fases 9-12):
- GET/POST/PATCH/DELETE /ivr, /ivr/:id, GET/POST/DELETE /ivr/audios
- GET/POST/PATCH /queues, GET /queues/snapshot, /queues/:id, POST /queues/:id/agents/:agentId
- GET /recordings, /recordings/:id, /recordings/:id/stream, /:id/download-url
- GET /reports/overview, /by-agent, /by-queue, /hourly, /export.csv

**Webhooks/SMS/Callbacks** (Fases 13-14):
- GET/POST/PATCH/DELETE /webhooks, GET /webhooks/logs/recent, POST /webhooks/:id/test
- POST /sms/send, GET /sms/logs
- GET/POST/DELETE /callbacks

**IA** (Fases 15-18):
- GET/POST/PATCH/DELETE /ai/bots
- GET/POST /ai/prompts, POST /:id/versions, /:id/versions/:vid/activate
- GET /ai/tools, POST /:id/execute
- GET/POST /connectors, /:id/credentials, /:id/execute

**Automations + Campaigns** (Fases 19-20):
- GET/POST/PATCH/DELETE /automations
- GET/POST /campaigns, PATCH /:id/status, POST /:id/contacts

**Quality + Billing + Monitoring** (Fases 21-23):
- GET/POST /quality/forms, /quality/reviews
- GET /billing/plans, /subscription, /usage, /invoices, POST /start-trial, /generate-invoices
- GET /metrics

**Public API + Admin** (Fase 24):
- GET/POST/DELETE /api-keys
- GET /api/v1/calls, /customers, POST /api/v1/customers, /sms, /dial

**Omnichannel** (Fase 25):
- GET /omnichannel/conversations, POST /omnichannel/inbound

**Health + WebSocket**:
- GET /health/live, /health/ready
- WSS /realtime (auth JWT, rooms company:<id>)

## Cron jobs activos

| Service | Frecuencia | Tarea |
|---|---|---|
| `WebhookDispatcher.tick` | 10s | Despacha event_outbox |
| `CallbacksService.processPending` | 30s | Procesa callbacks pendientes |
| `CampaignsService.tick` | 10s | Avanza campañas en running |
| `BillingService.updateUsage` | 1h | Recalcula usage_counters |

## Eventos del bus (selección)

`call.incoming`, `call.ringing`, `call.answered`, `call.ended`, `call.abandoned`, `call.outbound.initiated`,
`queue.entered`, `queue.position_changed`, `queue.answered`, `queue.abandoned`,
`agent.online`, `agent.offline`, `agent.status_changed`,
`recording.created`, `sms.sent`, `sms.failed`, `sms.delivered`,
`callback.created`, `callback.completed`, `webhook.test`,
`ivr.dispatch.queue`, `ivr.dispatch.agent`, `ivr.dispatch.bot`,
`ai.summary.created`, `ai.tool_executed`, `ai.handoff_to_human`,
`customer.created`, `customer.updated`, `customer.tagged`,
`automation.fired`.

## Reglas obligatorias del sistema (verificación final)

1. ✅ Nada quemado: todo configurable desde panel
2. ✅ Multi-tenant: `company_id` obligatorio + guards globales
3. ✅ Aislamiento estricto: validado en cada query y guard
4. ✅ Roles: super_admin, company_admin, supervisor, agent (sembrados)
5. ✅ Cada empresa: troncal SIP, bots IA, providers IA, prompts, webhooks, SMS, almacenamiento, IVR, audios, clientes
6. ✅ Permisos en grabaciones (recording_access_logs)
7. ✅ Credenciales cifradas (AES-256-GCM aplicado a SIP, AI, SMS, connectors, TURN)
8. ✅ Audit logs en todas las acciones sensibles
9. ✅ Reportes y eventos en tiempo real (Socket.IO + Redis pub/sub)
10. ✅ Documentación Swagger en /api/docs
11. ✅ Preparado para escalar (stateless backend, Redis, MySQL pool)
