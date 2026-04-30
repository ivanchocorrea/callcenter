# Deploy rápido por IP — Call Center NODOE

**Modo:** sin dominio, solo IP, **sin tocar el Form Builder ni n8n**.
**URL final:** `http://179.50.12.198:8080`
**Tiempo estimado:** 30-45 min

> Cuando tengas el dominio listo, sigues con `DEPLOY.md` para migrar a HTTPS.

---

## ⚠️ Lo que NO va a funcionar en modo IP

Antes de arrancar, asentir:

- ❌ **WebRTC/llamadas desde el navegador**: el navegador bloquea el micrófono sin HTTPS. Para probar telefonía hay que esperar al dominio.
- ❌ **Login con Google/Facebook** (si lo agregas en el futuro): no aceptan IPs.
- ❌ **Cookies "Secure"**: algunas funciones de auth pueden requerir flags relajados.
- ✅ **Lo que SÍ funciona**: dashboard, gestión de empresas, agentes, IVR config, CRM, IA chat, todo lo que es UI y backend HTTP normal. Solo la parte de telefonía en navegador queda bloqueada hasta tener dominio.

---

## FASE A — Mini-recon (1 minuto, lectura)

```bash
ssh ivan@179.50.12.198
```

Una vez dentro, **un solo comando**:

```bash
sudo ss -tulpn | grep -E ':(80|443|3000|3001|3306|5060|6379|8080|8081|8088|5678)\b'
```

**Lo que esperamos ver:**
- ✅ Puerto **80** ocupado (Nginx con Form Builder) — bien, no lo tocamos
- ✅ Puerto **5678** ocupado (n8n) — bien, no lo tocamos
- ⚠️ Si **8080** o **8081** aparecen ocupados → hay que ajustar antes de seguir

**Pega la salida del comando antes de continuar.**

---

## FASE B — Clonar el proyecto al VPS

### B.1 Llave SSH para GitHub (si no lo tienes ya)

```bash
ls ~/.ssh/id_ed25519 2>/dev/null || ssh-keygen -t ed25519 -C "ivan@agendamientos" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copia la salida y pégala en https://github.com/settings/keys → "New SSH key" → guarda.

Verifica:
```bash
ssh -T git@github.com
# Debe responder: "Hi <usuario>! You've successfully authenticated..."
```

### B.2 Clonar el repo

```bash
sudo mkdir -p /opt/callcenter
sudo chown ivan:ivan /opt/callcenter
cd /opt/callcenter
git clone git@github.com:TU-USUARIO/Call-Center-NODOE.git .
# Reemplaza TU-USUARIO. Si tu repo se llama diferente, ajusta.
ls -la
```

---

## FASE C — Generar secretos y crear `.env`

### C.1 Generar secretos

```bash
cd /opt/callcenter
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)"
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)"
echo "MYSQL_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)"
echo "ASTERISK_AMI_PASSWORD=$(openssl rand -base64 18 | tr -d '=+/' | head -c 18)"
echo "ASTERISK_ARI_PASSWORD=$(openssl rand -base64 18 | tr -d '=+/' | head -c 18)"
```

**Guarda esos valores aparte** (en un archivo seguro local, NO en chat ni git). Los necesitas en el siguiente paso.

### C.2 Crear `.env`

```bash
cp .env.example .env
nano .env
```

Plantilla — **reemplaza los `<...>` con los valores que generaste arriba**:

```ini
NODE_ENV=production
PUBLIC_APP_URL=http://179.50.12.198:8080
PUBLIC_API_URL=http://179.50.12.198:8081

BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0
FRONTEND_PORT=3000

NEXT_PUBLIC_API_URL=http://179.50.12.198:8081
NEXT_PUBLIC_WS_URL=ws://179.50.12.198:8081
NEXT_PUBLIC_SIP_WSS_URL=ws://179.50.12.198:8088/ws

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=callcenter
MYSQL_USER=callcenter
MYSQL_PASSWORD=<tu valor generado>
MYSQL_ROOT_PASSWORD=<tu valor generado>

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=<tu valor generado>
JWT_REFRESH_SECRET=<tu valor generado>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_MASTER_KEY=<tu valor generado>

ASTERISK_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=admin
ASTERISK_AMI_PASSWORD=<tu valor generado>

ASTERISK_ARI_HOST=127.0.0.1
ASTERISK_ARI_PORT=8088
ASTERISK_ARI_USER=ariadmin
ASTERISK_ARI_PASSWORD=<tu valor generado>
ASTERISK_ARI_APP=callcenter-app

STORAGE_DRIVER=local
LOCAL_RECORDINGS_PATH=/var/recordings

CORS_ORIGINS=http://179.50.12.198:8080

LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_METRICS=true

BOOTSTRAP_SUPERADMIN_EMAIL=ivancorrea111@gmail.com
BOOTSTRAP_SUPERADMIN_PASSWORD=<elige tu contraseña fuerte>
BOOTSTRAP_SUPERADMIN_NAME=Ivan Correa
```

```bash
chmod 600 .env
```

---

## FASE D — Crear override de Docker Compose para IP-only

Este archivo modifica el comportamiento sin tocar el `docker-compose.yml` original.

```bash
nano /opt/callcenter/docker-compose.ip.yml
```

Pega esto exacto:

```yaml
version: "3.9"

# Override IP-only — uso:
#   docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d
# Sin nginx interno (no tocamos el del sistema), puertos en localhost,
# y frontend/backend expuestos en 8080/8081 al público.

services:

  # IMPORTANTE: en este VPS ya hay un MySQL del sistema usando el puerto 3306.
  # Por eso aquí NO mapeamos puertos al host — el backend del Call Center
  # llega a MySQL/Redis por la red interna de Docker (mysql:3306, redis:6379).
  mysql:
    ports: []   # vacío: NO exponer al host

  redis:
    ports: []   # vacío: NO exponer al host

  backend:
    ports:
      - "0.0.0.0:8081:3001"   # backend público en 8081
    volumes:
      - recordings-data:/var/recordings

  frontend:
    ports:
      - "0.0.0.0:8080:3000"   # frontend público en 8080
    volumes: []

  # Asterisk: lo dejamos pero no será usable desde el navegador
  # hasta tener HTTPS. AMI/ARI quedan en localhost.

  # Desactivamos el Nginx interno (usaríamos el del sistema solo si tuviéramos dominio)
  nginx:
    profiles:
      - disabled

volumes:
  mysql-data:
  redis-data:
  recordings-data:
  asterisk-conf:
  asterisk-sounds:
```

---

## FASE E — Editar `docker-compose.yml` original (quitar mounts de dev)

El compose original monta el código fuente sobre el contenedor (modo dev). En producción esto rompe el build. Hay que comentar 3 líneas:

```bash
nano /opt/callcenter/docker-compose.yml
```

En el servicio `backend`, busca y comenta así:

```yaml
backend:
  ...
  volumes:
    # - ./backend:/app             # COMENTADO (solo dev)
    # - /app/node_modules          # COMENTADO (solo dev)
    - recordings-data:/var/recordings
```

En el servicio `frontend`:

```yaml
frontend:
  ...
  volumes:
    # - ./frontend:/app            # COMENTADO (solo dev)
    # - /app/node_modules          # COMENTADO (solo dev)
    # - /app/.next                 # COMENTADO (solo dev)
```

Guarda.

---

## FASE F — Levantar servicios paso a paso

```bash
cd /opt/callcenter

# 1) BD y caché
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d mysql redis

# Esperar que MySQL esté listo (30-60s primera vez)
docker compose ps
docker logs cc-mysql 2>&1 | tail -20
# Buscar: "ready for connections"

# 2) Verificar tablas creadas (las migraciones corren automáticas en initdb.d)
docker exec -it cc-mysql sh -c 'mysql -u callcenter -p"$MYSQL_PASSWORD" callcenter -e "SHOW TABLES;"'

# 3) Asterisk (puede dar errores de SIP/RTP en log, está OK por ahora)
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d asterisk
docker logs cc-asterisk 2>&1 | tail -30

# 4) Backend (build + up)
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d --build backend
docker logs cc-backend 2>&1 | tail -50
# Buscar: "Application is running" o similar

# 5) Frontend (build + up — esto tarda 3-5 min la primera vez)
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d --build frontend
docker logs cc-frontend 2>&1 | tail -30

# 6) Estado general
docker compose -f docker-compose.yml -f docker-compose.ip.yml ps
```

Todos deberían decir `Up` o `Up (healthy)`. Si alguno está en `Restarting` → mirar sus logs.

---

## FASE G — Verificación

```bash
# Backend salud
curl http://127.0.0.1:8081/health/live
# Debe responder JSON con status ok

# Frontend responde
curl -I http://127.0.0.1:8080
# Debe responder 200 OK

# Form Builder sigue vivo (NO debió tocarse)
curl -I http://127.0.0.1
# Debe responder 200 OK como antes

# n8n sigue vivo
docker ps | grep n8n
```

Desde tu computador local, abre en el navegador:

```
http://179.50.12.198:8080
```

Debe cargar el Call Center. Login con:
- Email: `ivancorrea111@gmail.com`
- Password: la que pusiste en `BOOTSTRAP_SUPERADMIN_PASSWORD`

---

## FASE H — Abrir el puerto 8080 si UFW está activo

Si `sudo ufw status` dice "active":

```bash
sudo ufw allow 8080/tcp comment 'Call Center frontend'
sudo ufw allow 8081/tcp comment 'Call Center backend'
sudo ufw reload
```

Si dice "inactive" → no hace falta.

---

## Troubleshooting

| Problema | Diagnóstico | Solución |
|---|---|---|
| `curl localhost:8080` da 502 | Frontend no levantó | `docker logs cc-frontend` |
| `502` en `/api/...` | Backend no levantó | `docker logs cc-backend` |
| Login da 401 con creds correctas | `JWT_SECRET` mal pegado | Re-revisa `.env`, recrea backend con `docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d --force-recreate backend` |
| `cc-mysql` reinicia en loop | Volumen viejo o password mal | `docker compose down`, borrar volumen `docker volume rm callcenter_mysql-data` (⚠️ borra datos), volver a `up` |
| Form Builder dejó de cargar | Error en docker-compose interfiere | `sudo systemctl status nginx` y `sudo docker ps` para ver si algún cont está en :80 |
| n8n dejó de cargar | Mismo motivo | `docker ps` y `docker logs <n8n-container>` |

---

## Comandos útiles diarios

```bash
# Ver estado
cd /opt/callcenter
docker compose -f docker-compose.yml -f docker-compose.ip.yml ps

# Ver logs de algo
docker logs -f cc-backend
docker logs -f cc-frontend

# Reiniciar un servicio
docker compose -f docker-compose.yml -f docker-compose.ip.yml restart backend

# Bajar todo
docker compose -f docker-compose.yml -f docker-compose.ip.yml down

# Subir todo
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d

# Actualizar código y rebuild
git pull
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d --build backend frontend
```

---

## Cuando consigas el dominio (después)

Pasos resumidos para migrar a HTTPS (la guía detallada está en `DEPLOY.md`):

1. Configurar DNS: `app`, `api`, `sip` → `179.50.12.198`
2. Instalar y configurar 3 server blocks de Nginx del sistema
3. Certbot para los 3 subdominios
4. Editar `.env` reemplazando IP por dominios HTTPS
5. Rebuild frontend (`NEXT_PUBLIC_*` se incrustan en build):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d --build frontend
   ```
6. Cerrar puertos 8080/8081 al público:
   ```bash
   sudo ufw delete allow 8080/tcp
   sudo ufw delete allow 8081/tcp
   ```
   Y cambiar el bind de los servicios a `127.0.0.1` en lugar de `0.0.0.0`.
