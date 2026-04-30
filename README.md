# Call Center NODOE — SaaS Multiempresa con IA

Plataforma profesional de Call Center 100% web, multiempresa (multi-tenant), con telefonía VoIP/SIP/WebRTC sobre Asterisk, IVR configurable, colas con turnos, CRM, motor IA multi-proveedor, automatizaciones, webhooks, SMS y reportes en tiempo real.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS |
| Backend | NestJS 10 + Node.js 20 + TypeScript |
| Base de datos | MySQL 8.0 |
| Cache / pub-sub | Redis 7 |
| Telefonía | Asterisk 20 (PJSIP, ARI/AMI) |
| WebRTC cliente | SIP.js |
| Tiempo real | Socket.IO |
| Reverse proxy | Nginx + SSL (Let's Encrypt) |
| Containers | Docker + Docker Compose |
| OS host | Ubuntu 22.04 LTS |

## Arquitectura de alto nivel

```
                          ┌─────────────────┐
   Cliente PSTN ───SIP──▶ │ SIP Trunk (X)   │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │    Asterisk     │  AMI/ARI events
                          │   (PJSIP+ARI)   ├──────────────┐
                          └────────▲────────┘              │
                                   │ WebRTC/WSS            │
                          ┌────────┴────────┐              ▼
   Agente (Browser) ◀───▶ │  Nginx + WSS    │      ┌──────────────┐
                          └────────▲────────┘      │  Backend     │
                                   │ HTTP/WSS      │  NestJS      │
                          ┌────────┴────────┐      │              │
   Supervisor (Browser)◀─▶│  Frontend       │◀────▶│  REST + WS   │
                          │  Next.js (SSR)  │      │              │
                          └─────────────────┘      └──┬────────┬──┘
                                                      │        │
                                                  ┌───▼──┐ ┌───▼──┐
                                                  │MySQL │ │Redis │
                                                  └──────┘ └──────┘
                                                      │
                                                      │
                                  ┌───────────────────┼───────────────────┐
                                  ▼                   ▼                   ▼
                            ┌──────────┐       ┌──────────┐         ┌──────────┐
                            │ AI       │       │ SMS      │         │ Storage  │
                            │ Providers│       │ Providers│         │ S3/MinIO │
                            │ (OpenAI, │       │ (Twilio, │         │ /Wasabi  │
                            │ Claude,  │       │ Generic) │         │ /local   │
                            │ Gemini,  │       └──────────┘         └──────────┘
                            │ Generic) │
                            └──────────┘
```

## Multi-tenancy

Todas las tablas que portan datos de negocio incluyen `company_id`. El backend aplica un guard global `CompanyScopeGuard` que inyecta el `company_id` desde el JWT en cada request y valida que ningún recurso accedido pertenezca a otra empresa. El `super_admin` es el único rol que puede cruzar tenants.

## Roles del sistema

| Rol | Descripción |
|---|---|
| `super_admin` | Administra el SaaS completo, todas las empresas, planes y facturación |
| `company_admin` | Administra una empresa: configuración, usuarios, troncales, IVR, bots, etc. |
| `supervisor` | Monitoreo en vivo, reportes, calidad, escucha/susurro/barge-in |
| `agent` | Atiende llamadas vía WebRTC, marca, gestiona clientes |

## Estructura del repositorio

```
.
├── README.md                   ← este archivo
├── ARCHITECTURE.md             ← arquitectura técnica completa
├── ROADMAP.md                  ← roadmap por fases (0–25)
├── SUGGESTIONS.md              ← elementos que añadí a la spec original
├── GETTING_STARTED.md          ← cómo levantar el proyecto
├── docker-compose.yml          ← stack completo
├── .env.example                ← variables de entorno
│
├── backend/                    ← NestJS
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   ├── common/             ← guards, decorators, encryption, etc.
│   │   ├── auth/
│   │   ├── companies/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── permissions/
│   │   ├── agents/
│   │   ├── sip/
│   │   ├── asterisk/
│   │   ├── webrtc/
│   │   ├── calls/
│   │   ├── queues/
│   │   ├── ivr/
│   │   ├── ai/
│   │   ├── webhooks/
│   │   ├── ...
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   ← Next.js
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── lib/
│   ├── types/
│   ├── Dockerfile
│   └── package.json
│
├── db/
│   └── migrations/             ← SQL versionado
│
├── asterisk/                   ← configuración base PJSIP/ARI
│   ├── pjsip.conf
│   ├── extensions.conf
│   ├── ari.conf
│   ├── manager.conf
│   ├── http.conf
│   └── rtp.conf
│
├── nginx/
│   └── conf.d/
│
└── docs/                       ← documentos de diseño
    ├── design-sip.md
    ├── design-ivr.md
    ├── design-webrtc.md
    ├── design-crm.md
    ├── design-queues.md
    ├── design-webhooks.md
    └── design-ai-engine.md
```

## Estado actual

**26 de 26 fases (100%) completadas** ✅. Ver `ROADMAP.md` para el detalle por fase.

Resumen de lo construido:

- Infraestructura Docker completa (backend, frontend, mysql, redis, asterisk, nginx)
- Esquema MySQL con ~95 tablas multi-tenant
- Backend NestJS con 35+ módulos y ~80+ endpoints REST + WebSocket
- Frontend Next.js con login, panels por rol, dialer, dashboards live, IVR, clientes, importación
- Telefonía SIP/WebRTC end-to-end vía Asterisk + ARI
- IVR configurable con audios subidos y ejecución vía ARI
- Colas con turnos, ETA, supervisor live dashboard
- Grabaciones con drivers Local / S3 / MinIO / Wasabi / Backblaze
- Reportes y exports CSV
- Webhooks con HMAC, retry exponencial, DLQ y delivery logs
- SMS con Twilio + Generic HTTP, plantillas y callbacks automáticos
- IA multi-proveedor (OpenAI, Claude, Gemini, Generic) con bots, prompts versionados y herramientas reales
- Automatizaciones tipo Zapier (event → conditions → actions con 10 acciones)
- Campañas outbound con 4 dialer modes (manual, preview, progressive, predictive) + AMD
- Calidad con forms y scoring ponderado
- Facturación SaaS con planes, usage tracking automático y generador de invoices
- Métricas Prometheus en /metrics
- API pública v1 con API keys, scopes y rate limit
- Omnicanal base (WhatsApp, web chat, email, etc.) con conversaciones unificadas vía AI
- Documentación técnica completa de los 7 subsistemas críticos

## Cómo arrancar

Ver `GETTING_STARTED.md`.

## Reglas obligatorias del sistema (recordatorio)

1. Nada quemado en código — todo configurable desde panel.
2. Multiempresa desde el día 1.
3. `company_id` obligatorio en todo registro de negocio.
4. Aislamiento estricto entre empresas.
5. Credenciales SIP/IA/SMS cifradas en reposo (AES-256-GCM).
6. Audit logs en operaciones sensibles.
7. Reportes y eventos en tiempo real (Socket.IO + Redis pub/sub).
8. Documentación Swagger en `/api/docs`.
9. Preparado para escalar (stateless backend, sticky sessions solo donde aplica).
