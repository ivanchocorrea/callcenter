# Frontend — Next.js 14 + TypeScript + Tailwind

## Páginas implementadas (Fase 0–2)

- `/login` — formulario con soporte 2FA TOTP
- `/` — redirección por rol
- `/dashboard` — dashboard genérico
- `/super-admin` y `/super-admin/companies` — panel global
- `/admin` — panel de empresa con checklist
- `/supervisor` — supervisión en vivo (UI mock, datos en Fase 10)
- `/agent` — escritorio del agente con estados y controles
- `/agent/dialer` — teclado numérico
- `/agent/incoming-call` — preview del popup de llamada entrante

## Estructura

```
app/
├── layout.tsx
├── providers.tsx
├── globals.css
├── page.tsx                    ← redirección por rol
├── login/
├── dashboard/
├── super-admin/{,companies}/
├── admin/
├── supervisor/
└── agent/{,dialer,incoming-call}/
components/
└── shared/
    ├── AppShell.tsx            ← sidebar + header con nav por rol
    └── StatCard.tsx
lib/
├── api/
│   └── client.ts               ← axios + auto-refresh + X-Company-Id
└── auth/
    └── auth-context.tsx        ← AuthProvider, useAuth, hasRole, hasPermission
```

## Cómo arrancar local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre http://localhost:3000 — login con las credenciales de bootstrap del backend.

## Plan para fases siguientes

- **Fase 3 (SIP)**: `/admin/sip-trunks` con formulario simple/avanzado y botón "probar conexión".
- **Fase 5 (WebRTC)**: integración SIP.js, registro WSS, audio devices.
- **Fase 6 (Inbound)**: el `/agent/incoming-call` se vuelve global con un layout que escucha Socket.IO.
- **Fase 9 (IVR)**: builder visual drag & drop.
- **Fase 10 (Supervisor)**: el dashboard se llena con datos en vivo.
- **Fase 16/17 (IA)**: editor de prompts con versionado y diff.
