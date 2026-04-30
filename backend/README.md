# Backend — NestJS 10 + TypeScript + MySQL

## Estructura

```
src/
├── main.ts
├── app.module.ts
├── modules-roadmap.md          ← estado por fase
├── config/                     ← cargar variables tipadas
├── common/
│   ├── decorators/             ← @Public, @Roles, @RequirePermissions, @CurrentUser
│   ├── encryption/             ← AES-256-GCM (creds SIP/AI/SMS)
│   ├── filters/                ← AllExceptionsFilter
│   ├── guards/                 ← CompanyScopeGuard
│   ├── health/                 ← /health/live, /health/ready
│   ├── interceptors/           ← TransformInterceptor (envelope ok/data)
│   └── middleware/             ← RequestIdMiddleware
├── auth/                       ← login, refresh (rotación), logout, 2FA TOTP
├── companies/                  ← CRUD super_admin
├── users/                      ← CRUD + asignación de roles
├── roles/                      ← read-only
├── permissions/                ← read-only
├── agents/                     ← CRUD agentes con SIP secret cifrado
├── audit/                      ← AuditService global
├── sip/                        ← stub Fase 3
├── asterisk/                   ← stub Fase 4 (ARI/AMI bridge)
├── queues/                     ← stub Fase 10
├── ivr/                        ← stub Fase 9
├── ai/providers/               ← interfaz AIProvider
├── webhooks/                   ← stub Fase 13 (outbox dispatcher)
└── storage/                    ← stub Fase 11 (S3/MinIO/etc.)
```

## Endpoints disponibles (Fase 0–1)

- `POST /api/auth/login` (público)
- `POST /api/auth/refresh` (público)
- `POST /api/auth/logout` (público)
- `GET /api/auth/me`
- `GET /api/companies`, `POST`, `PATCH /:id`, `PATCH /:id/suspend`, `PATCH /:id/activate`
- `GET /api/users`, `POST`, `PATCH /:id`, `PATCH /:id/password`
- `GET /api/roles`
- `GET /api/permissions`
- `GET /api/agents`, `POST`, `GET /:id`
- `GET /health/live`, `/health/ready`
- `GET /api/docs` ← Swagger

## Ejecutar local sin Docker

```bash
cp .env.example .env
# Asegúrate de tener MySQL local con la base `callcenter` y migraciones aplicadas
npm install
npm run start:dev
```

El primer arranque crea automáticamente el super-admin desde las variables `BOOTSTRAP_SUPERADMIN_*`.

## Reglas obligatorias respetadas

1. ✅ Multi-tenant: tabla `users.company_id`, guards globales, super_admin con header X-Company-Id.
2. ✅ Cifrado credenciales: `EncryptionService` AES-256-GCM aplicado a `agents.sip_secret_encrypted`.
3. ✅ JWT + refresh rotación + bloqueo por intentos fallidos + 2FA TOTP opcional.
4. ✅ DTOs validados (`class-validator`).
5. ✅ Audit logs (`AuditService`).
6. ✅ Helmet, rate limit (Throttler), CORS whitelist, Swagger.
7. ✅ `request_id` en headers y logs.
8. ✅ Errores estandarizados en formato `{ ok:false, error:{ code, message, errors }, requestId }`.
