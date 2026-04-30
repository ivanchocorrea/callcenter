# QUICK START — Probar el Call Center en 5 minutos

Tres caminos posibles, ordenados de más simple a más complejo. Empieza por el que aplique a ti.

---

## 🟢 OPCIÓN A — Probar el panel web (sin llamadas reales)

**Para qué sirve:** Probar TODO el panel de administración, supervisor y agente. Crear empresa, usuarios, configurar troncales SIP (sin probarlas), IVR, colas, bots IA, importar clientes desde CSV, ver reportes, configurar webhooks, etc.

**Lo que NO funciona en este modo:** hacer/recibir llamadas reales (porque no hay Asterisk).

**Requisitos:**
- Docker Desktop instalado y corriendo. Eso es todo.
  - Windows: <https://www.docker.com/products/docker-desktop>
  - macOS: igual
  - Linux: `sudo apt install docker.io docker-compose-v2`

### Paso 1 — Generar el .env con secretos válidos

**Windows (PowerShell):**
```powershell
cd "C:\Users\ANALISTA\Documents\Claude\Projects\Call Center NODOE"
.\scripts\generate-env.ps1
```

**macOS / Linux (Bash):**
```bash
cd "Call Center NODOE"
bash scripts/generate-env.sh
```

El script genera passwords aleatorios y te muestra el password del super-admin. **Anótalo**, no lo verás otra vez.

### Paso 2 — Levantar el stack

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

La primera vez tarda ~3-5 minutos (descarga MySQL, Redis, Node, build de backend y frontend).

### Paso 3 — Verificar que todo arrancó

```bash
docker compose -f docker-compose.dev.yml ps
```

Debes ver `cc-mysql-dev`, `cc-redis-dev`, `cc-backend-dev`, `cc-frontend-dev` todos `Up`. Si alguno no está bien:

```bash
docker compose -f docker-compose.dev.yml logs -f backend
```

### Paso 4 — Abrir en el navegador

| URL | Qué es |
|---|---|
| <http://localhost:3000> | **Frontend** — login del sistema |
| <http://localhost:3001/api/docs> | **Swagger API** — explora todos los endpoints |
| <http://localhost:3001/health/ready> | Health check |
| <http://localhost:3001/metrics> | Métricas Prometheus |

### Paso 5 — Login

- Email: `admin@nodoe.test`
- Password: el que te mostró el script

Ya puedes:
- Crear una empresa desde **Empresas → Nueva**
- Crear usuarios con rol `company_admin` o `agent`
- Cerrar sesión y entrar como company-admin
- Configurar troncales SIP, IVR, colas, bots IA, importar clientes CSV
- Probar la importación con un CSV de ejemplo
- Ver el dashboard del supervisor en vivo
- Probar la pantalla del agente con su escritorio

### Detener el stack

```bash
docker compose -f docker-compose.dev.yml down
```

Borrar también los datos:

```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## 🟡 OPCIÓN B — Sistema completo con llamadas reales (Linux / WSL2)

**Para qué sirve:** todo lo de A + hacer/recibir llamadas reales con un proveedor SIP.

**Requisitos:**
- Linux nativo, o **WSL2** en Windows (Asterisk requiere `network_mode: host` que NO funciona en Docker Desktop Windows/Mac).
  - WSL2: `wsl --install` y luego `wsl` para entrar.
- Docker + Docker Compose dentro del Linux.
- Una troncal SIP de prueba: DIDWW, Voxbeam, Twilio Programmable Voice, etc. La mayoría tienen trial gratuito.
- Para WebRTC funcionando: dominio + certificado TLS (Let's Encrypt). En localhost SIN TLS funciona en Chrome solo con `chrome://flags/#unsafely-treat-insecure-origin-as-secure` activado para `http://localhost:3000`.

### Pasos:

```bash
cd "Call Center NODOE"
bash scripts/generate-env.sh

# Levantar el stack completo (incluye Asterisk)
docker compose up -d --build
```

Después en el panel:
1. Login como super-admin → crear empresa
2. Como company-admin → crear troncal SIP con datos de tu proveedor → "Probar"
3. Crear usuario con rol `agent` → crear Agente con extensión 1001
4. Logout, login como agente → header verde "SIP registered"
5. Marcar un número desde el dialer

Para llamada entrante: configura el DID de tu proveedor para que envíe a la IP pública de tu servidor con el contexto `from-trunk`.

---

## 🔴 OPCIÓN C — Producción en VPS

Ver `GETTING_STARTED.md` para los pasos completos: TLS Let's Encrypt, firewall, backups, dominio, monitoring.

---

## Preguntas frecuentes

### "El backend no arranca y dice ENCRYPTION_MASTER_KEY"
El script `generate-env.ps1` / `.sh` lo genera correctamente con 64 caracteres hex. Si lo editaste a mano, asegúrate de que sea **exactamente 64 chars** (32 bytes en hexadecimal).

Para regenerarlo manual:
```bash
openssl rand -hex 32
```

### "No tengo openssl en Windows"
Usa el script `.ps1`, lo genera con `RandomNumberGenerator` nativo de .NET.

### "MySQL no aplica las migraciones"
Las migraciones SQL solo se ejecutan **la primera vez** que se crea el volumen `mysql-data`. Si las cambiaste:
```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build
```
(borra todos los datos)

### "El frontend muestra 'Network Error' al hacer login"
Verifica:
1. `docker compose -f docker-compose.dev.yml ps` muestra backend `Up`
2. <http://localhost:3001/health/ready> responde `{"status":"ok"}`
3. En tu navegador (DevTools → Network) la request va a `http://localhost:3001` y no a otro host

### "Docker Desktop dice 'WSL 2 backend required'"
En Windows necesitas Docker Desktop con WSL2 activado. En el setup wizard marca esa opción.

### "El build del backend falla con `node-gyp`"
Algún paquete nativo (bcrypt, argon2) no compila. Solución: la imagen `node:20-alpine` ya trae lo necesario, pero si persiste, cambia en el `Dockerfile`:
```
FROM node:20-alpine
```
por:
```
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential && rm -rf /var/lib/apt/lists/*
```

### "Puedo probar las llamadas sin un proveedor SIP real?"
Sí, instalando un softphone (Linphone, Zoiper) que se conecte a tu Asterisk como otro endpoint. Pero requiere configurar PJSIP a mano, queda fuera del scope del quick start.

### "Cuánto consume el stack en mi PC?"
- En reposo (sin llamadas): ~600 MB de RAM en total.
- Con 50 llamadas concurrentes: ~1.5 GB.
- CPU: < 5% en reposo.

---

## Lo que YA puedes probar en modo A

✅ Crear empresa, usuarios, agentes, asignar roles
✅ Configurar troncales SIP (UI funcional, "Probar" intentará el SIP OPTIONS pero fallará sin Asterisk corriendo — esto es normal en modo A)
✅ Crear IVR con menús y opciones (UI completa)
✅ Crear colas y asignar agentes
✅ Importar clientes desde CSV con dedupe automático
✅ Buscar clientes, agregar notas, ver timeline
✅ Configurar webhooks con HMAC
✅ Configurar plantillas SMS
✅ Crear bots IA con prompts versionados
✅ Crear automatizaciones tipo Zapier
✅ Crear campañas (sin ejecutarlas porque no hay llamadas)
✅ Forms de calidad
✅ Ver planes y facturación
✅ Crear API keys con scopes
✅ Generar reportes
✅ Endpoint /metrics Prometheus
✅ Swagger interactivo

## Lo que requiere modo B (Linux + Asterisk + SIP trunk)

🔘 Hacer llamadas salientes desde el dialer
🔘 Recibir llamadas con popup en tiempo real
🔘 Probar el IVR con audio real
🔘 Encolar y asignar llamadas a agentes
🔘 Grabaciones (las archivos de audio reales)
🔘 Bots IA conversacionales por voz
🔘 Campañas outbound predictivas

---

¡Listo! Si algo no funciona en alguno de los pasos, los logs `docker compose ... logs backend` casi siempre dicen exactamente qué falta.
