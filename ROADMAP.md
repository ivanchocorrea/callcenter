# Roadmap técnico

26 fases (0–25). Cada fase produce un incremento desplegable.

| Fase | Nombre | Estado | Entregable principal |
|---|---|---|---|
| 0 | Base técnica | ✅ DONE | Docker stack, MySQL, Redis, NestJS skeleton, Next.js skeleton |
| 1 | Auth + multi-tenancy | ✅ DONE | Auth JWT, companies, users, roles, permissions |
| 2 | Panel de configuración por empresa | ✅ DONE | UI base + layouts por rol |
| 3 | SIP trunks | ✅ DONE | CRUD, test SIP OPTIONS, generación PJSIP via realtime |
| 4 | Asterisk integration | ✅ DONE | ARI WebSocket consumer, AMI fallback, EventBus + Redis |
| 5 | WebRTC agent panel | ✅ DONE | Endpoint /webrtc/credentials, SIP.js client, hold, mute, DTMF |
| 6 | Inbound + popup | ✅ DONE | StasisStart dispatcher, screen pop CRM, Socket.IO gateway |
| 7 | Outbound dialer | ✅ DONE | Dialer manual conectado, originate, DNC check, hangup, history |
| 8 | CRM básico + import | ✅ DONE | Customers + búsqueda + notas + timeline + import CSV |
| 9 | IVR configurable | ✅ DONE | CRUD menus + opciones + audios + engine vía ARI playback/DTMF |
| 10 | Colas + turnos + supervisor | ✅ DONE | Queues + Redis ZSET + ETA + abandono + supervisor live dashboard |
| 11 | Grabaciones | ✅ DONE | Drivers local/S3/MinIO/Wasabi/Backblaze + retención + acceso auditado |
| 12 | Reportes básicos | ✅ DONE | Overview, by-agent, by-queue, hourly, export CSV |
| 13 | Webhooks | ✅ DONE | Outbox pattern, HMAC SHA256, retry exponencial, DLQ, delivery logs |
| 14 | SMS + callbacks | ✅ DONE | Twilio + GenericHTTP providers, plantillas, callback engine cron |
| 15 | Motor IA multi-proveedor | ✅ DONE | OpenAI + Claude + Gemini + GenericHTTP con interfaz común |
| 16 | Bots IA | ✅ DONE | CRUD de bots con voz, idioma, prompts, transferencia |
| 17 | Prompts versionados | ✅ DONE | Versiones + activación + rendering con variables |
| 18 | Herramientas IA + Sheets | ✅ DONE | Tool registry (builtin/connector/webhook/sql) + Google Sheets connector |
| 19 | Automatizaciones | ✅ DONE | Engine event→condition→action con 8 acciones |
| 20 | Campañas + dialer avanzado | ✅ DONE | Campaign engine cron + AMD + manual/preview/progressive/predictive |
| 21 | Calidad + auditoría | ✅ DONE | Forms + reviews con scoring ponderado |
| 22 | Facturación SaaS | ✅ DONE | Plans + subscriptions + usage_counters cron + invoices generator |
| 23 | Monitoreo + backups + producción | ✅ DONE | /metrics Prometheus + health checks ampliados |
| 24 | API pública | ✅ DONE | API keys con scopes, rate limit, endpoints v1 calls/customers/sms/dial |
| 25 | Omnicanal base | ✅ DONE | Tablas + service para conversaciones multi-canal |

## Resumen

**26 de 26 fases completadas (100%)** ✅

Sistema operativo completo. Listo para:
- Recibir y hacer llamadas SIP/WebRTC end-to-end
- Configurar troncales con cualquier proveedor
- IVR jerárquicos con audios subidos
- Colas con turnos, posición y supervisor live dashboard
- Grabaciones almacenadas en S3 / MinIO / local
- Reportes y exports CSV
- Webhooks con HMAC, reintentos, DLQ
- SMS via Twilio o cualquier proveedor HTTP
- Callbacks automáticos con worker
- Bots IA con OpenAI / Claude / Gemini y herramientas reales
- Prompts versionados con activación
- Automatizaciones tipo Zapier
- Campañas outbound con dialer predictivo + AMD
- Forms de calidad con scoring ponderado
- Facturación SaaS con planes, usage tracking, generación de facturas
- Métricas Prometheus en /metrics
- API pública v1 con API keys y scopes
- Base omnicanal para WhatsApp, web chat, email, etc.

## Convenciones

- Cada fase tiene su PR independiente (cuando uses git).
- Tests unitarios mínimos por servicio crítico.
- Migraciones MySQL versionadas.
- Cambios breaking en API → bump de versión `/api/v2/...`.
- Documentación Swagger se actualiza automáticamente.

## Criterios de "done"

1. Código merged a main.
2. Migraciones aplicadas y reversibles.
3. Documentación Swagger actualizada.
4. Tests pasando.
5. Demo funcional grabada.
6. README de la fase con notas operativas.
