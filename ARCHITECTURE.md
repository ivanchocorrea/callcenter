# Arquitectura técnica — Call Center NODOE

## 1. Visión general

Sistema SaaS multi-tenant orientado a contact centers de tamaño mediano-grande con flujos inbound/outbound, IA conversacional, integraciones CRM y enrutamiento configurable. La separación de responsabilidades sigue el modelo:

- **Asterisk** = núcleo de telefonía (SIP, RTP, WebRTC server-side, dialplan).
- **Backend NestJS** = cerebro de negocio, orquestador, API y eventos.
- **Frontend Next.js** = UI para todos los roles.
- **MySQL** = single source of truth.
- **Redis** = cache, pub/sub, contadores en vivo, sesiones.
- **Asterisk ↔ Backend** = AMI (eventos legacy) + ARI (control programático). Preferimos ARI para nuevas integraciones.

## 2. Diagrama de capas

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENTES                                  │
│  Browser (Agente / Supervisor / Admin) — Browser PWA — API consumers │
└────────────────┬───────────────────────────┬─────────────────────────┘
                 │ HTTPS                     │ WSS (SIP) / WSS (events)
        ┌────────▼────────┐         ┌────────▼────────┐
        │   Nginx (TLS)   │         │   Nginx (TLS)   │
        │   reverse proxy │         │   ws upgrade    │
        └────────┬────────┘         └────────┬────────┘
                 │                           │
   ┌─────────────┴───────────────┐  ┌────────┴───────────────┐
   │ Frontend Next.js (SSR/SSG)  │  │ Asterisk PJSIP+ARI     │
   │ - App Router                │  │ - WebRTC transport     │
   │ - Auth client (JWT)         │  │ - SIP trunks           │
   │ - SIP.js (WebRTC)           │  │ - RTP                  │
   │ - Socket.IO client          │  │ - MOH, queues, IVR     │
   └─────────────┬───────────────┘  └────────┬───────────────┘
                 │ REST / WS                 │ AMI / ARI / WS events
                 ▼                           ▼
           ┌────────────────────────────────────────┐
           │            Backend NestJS              │
           │  ┌──────────────────────────────────┐  │
           │  │   API Gateway (HTTP + WS)        │  │
           │  └──────┬─────────┬────────┬────────┘  │
           │         │         │        │           │
           │  ┌──────▼──┐ ┌───▼────┐ ┌─▼─────────┐  │
           │  │ Auth /  │ │ Calls/ │ │ Asterisk  │  │
           │  │ Users / │ │ Queues/│ │ Bridge    │  │
           │  │ Compa-  │ │ IVR /  │ │ (ARI/AMI) │  │
           │  │ nies    │ │ CRM    │ │           │  │
           │  └─────────┘ └────────┘ └───────────┘  │
           │  ┌─────────┐ ┌────────┐ ┌───────────┐  │
           │  │ AI      │ │ Webhks │ │ Storage   │  │
           │  │ Engine  │ │ Out-   │ │ adapter   │  │
           │  │ (multi) │ │ bound  │ │ (S3/local)│  │
           │  └─────────┘ └────────┘ └───────────┘  │
           │  ┌─────────┐ ┌────────┐ ┌───────────┐  │
           │  │ Schedu- │ │ Audit  │ │ Metrics / │  │
           │  │ ler     │ │ Logs   │ │ Tracing   │  │
           │  └─────────┘ └────────┘ └───────────┘  │
           └───────┬─────────┬────────────┬──────────┘
                   │         │            │
            ┌──────▼──┐ ┌────▼──┐  ┌──────▼──────┐
            │ MySQL 8 │ │ Redis │  │ Object      │
            │         │ │       │  │ Storage     │
            │         │ │       │  │ (S3/MinIO)  │
            └─────────┘ └───────┘  └─────────────┘
```

## 3. Modelo multi-tenant

### 3.1. Aislamiento

- Cada tabla de negocio tiene `company_id BIGINT NOT NULL`.
- Todos los queries pasan por un repositorio que inyecta el filtro `WHERE company_id = ?` automáticamente vía un guard de NestJS (`@CompanyScoped()`).
- El JWT contiene `companyId` y `roleSlug`. Falla cualquier intento de cruzar tenants para roles no super-admin.
- Asterisk: dialplan diferencia tenants por DID/troncal. Cada acción ARI lleva el `company_id` en variables del canal (`X-Company-Id`).

### 3.2. Esquema de IDs

- BIGINT autoincremental para todas las PKs (no UUIDs en core para mantener queries rápidos en MySQL).
- IDs públicos (API pública) son hashids derivados del BIGINT para evitar enumeración.

## 4. Auth

- Login con email + password (bcrypt cost 12).
- Devuelve JWT (15 min) + refresh token (7 días, rotación).
- Refresh token guardado hasheado en `user_refresh_tokens`. Revocación inmediata por logout o cambio de password.
- 2FA opcional (TOTP) con `users.two_factor_enabled`, `users.two_factor_secret_encrypted`.
- Rate limit por IP en endpoints sensibles (`/auth/login`, `/auth/forgot-password`).

## 5. Cifrado de credenciales

- AES-256-GCM con master key en `.env` (`ENCRYPTION_MASTER_KEY`, 32 bytes hex).
- Helper `EncryptionService.encrypt(plain)` → `{cipher, iv, tag}` codificado base64 en una sola string.
- Aplicado a: `sip_trunks.password_encrypted`, `ai_providers.api_key_encrypted`, `sms_providers.api_key_encrypted`, `connector_credentials.value_encrypted`, `users.two_factor_secret_encrypted`.

## 6. Eventos en tiempo real

### 6.1. Stack

- **Productor**: backend NestJS + Asterisk events.
- **Bus**: Redis pub/sub.
- **Distribución a clientes**: Socket.IO con namespaces por empresa (`/co/{company_id}`) y rooms por entidad (`agent:{id}`, `queue:{id}`, `call:{id}`).

### 6.2. Eventos críticos

| Evento | Payload mínimo | Consumidores |
|---|---|---|
| `call.incoming` | `{call_id, company_id, from, did, queue_id?}` | agent panel, supervisor |
| `call.ringing` | `{call_id, agent_id}` | supervisor |
| `call.answered` | `{call_id, agent_id, answered_at}` | supervisor, reports |
| `call.ended` | `{call_id, duration, disposition?}` | reports, webhook engine |
| `queue.position_changed` | `{queue_id, call_id, new_position, eta}` | IVR (TTS), supervisor |
| `agent.status_changed` | `{agent_id, status, reason?}` | supervisor |
| `ai.handoff_to_human` | `{call_id, queue_id?}` | dispatcher |

## 7. Flujo de llamada entrante (resumen)

```
Cliente PSTN
   │
   ▼
SIP Trunk (proveedor)
   │
   ▼
Asterisk PJSIP endpoint
   │  (dialplan identifica company_id por trunk_id / DID)
   ▼
Stasis(callcenter-app, company_id, did)
   │
   ▼
Backend (ARI WebSocket) recibe StasisStart
   │
   ▼
1. Crea call (calls)
2. Lookup customer por número
   └─ Si no, lookup en connectors (Google Sheets, API ext)
3. Determina destino:
   - business_hours fuera horario → audio + colgar / buzón
   - DID → IVR / queue / agent / bot IA
4. Aplica destino vía ARI:
   - IVR: continueInDialplan → IVR(menu_id)
   - Queue: añade a Asterisk queue
   - Bot IA: bridge a canal externo de IA
5. Emite call.incoming a Socket.IO
```

Detalle completo en `docs/design-sip.md` y `docs/design-queues.md`.

## 8. Stack de IA

```
┌─────────────────────────────────────────────────────────┐
│                AIProviderService (NestJS)               │
│  selecciona provider por bot_id / company_id /          │
│  fallback configurable                                  │
└──────┬───────────┬───────────┬───────────┬──────────────┘
       │           │           │           │
   ┌───▼──┐   ┌────▼───┐   ┌───▼────┐  ┌──▼────────────┐
   │OpenAI│   │ Claude │   │ Gemini │  │ Generic HTTP  │
   │      │   │        │   │        │  │ provider      │
   └──────┘   └────────┘   └────────┘  └───────────────┘

Cada provider implementa:
  generateResponse, transcribe, summarize, classify

Tools (function calling) viven en AIToolRegistry y se ejecutan
en el backend con permisos del bot, no en el provider.
```

## 9. Webhooks (outbound)

- Cliente del SaaS define endpoints en `webhook_endpoints`.
- Cuando ocurre un evento suscrito, backend escribe en `event_outbox` (transaccional con la operación que lo causó).
- Worker `WebhookDispatcher` lee `event_outbox`, envía POST con firma HMAC-SHA256, registra en `webhook_delivery_logs`.
- Reintentos exponenciales: 0s, 30s, 5min, 30min, 2h, 12h. Después → dead-letter.

## 10. Almacenamiento de grabaciones

- Adaptador con strategy pattern: `LocalDriver`, `S3Driver`, `MinioDriver`, `WasabiDriver`, `BackblazeDriver`.
- Configuración en `storage_providers` por empresa.
- Pre-signed URLs para descarga, válidas 5 min.
- Acceso registrado en `recording_access_logs`.

## 11. Despliegue

### 11.1. Producción mínima

- 1 VPS Ubuntu 22.04 con 8 vCPU / 16 GB RAM / 200 GB SSD para empezar.
- `docker-compose up -d`: backend + frontend + mysql + redis + asterisk + nginx.
- Backups: cron diario `mysqldump`, sync a bucket externo.
- Let's Encrypt automático con certbot en nginx container.

### 11.2. Escalable

- Backend behind LB, N réplicas stateless.
- Redis cluster.
- MySQL primary + read replicas.
- Asterisk en cluster (no trivial — requiere Kamailio + RTPproxy delante; documentado pero fuera del MVP).
- Object storage externo (S3 compat).

## 12. Observabilidad

- Logs JSON estructurados (`pino`) con `request_id`, `company_id`, `user_id` en cada línea.
- Métricas Prometheus en `/metrics`.
- Trazas OpenTelemetry exportables.
- Health checks: `/health/live` (proceso vivo) y `/health/ready` (DB + Redis ok).

## 13. Seguridad operativa

- Helmet en backend (CSP, HSTS, X-Frame-Options).
- CORS strict whitelist por empresa configurable.
- Rate limit global y por endpoint.
- Validación DTOs con `class-validator`.
- Auditoría en `audit_logs` para: login/logout, cambios de configuración, acceso a grabaciones, cambios de permisos, exports masivos.
- Backups cifrados con GPG antes de subir a remoto.

## 14. Roadmap de fases

Ver `ROADMAP.md`.
