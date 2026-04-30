# Guía de despliegue — Call Center NODOE

**Servidor:** VPS Ubuntu 22.04 — `179.50.12.198`
**Dominio:** `agendamientos.com.co`
**Usuario SSH:** `ivan@179.50.12.198`
**Restricción crítica:** ya hay un Form Builder corriendo en este servidor en `/var/www/html/`. **NO se puede tocar.** Tampoco el contenedor de n8n.

---

## Mapa de subdominios final

| URL | Apunta a | Qué sirve |
|---|---|---|
| `agendamientos.com.co` | Nginx del sistema | Form Builder (intacto) |
| `app.agendamientos.com.co` | Nginx → `localhost:3000` | Frontend Next.js del Call Center |
| `api.agendamientos.com.co` | Nginx → `localhost:3001` | Backend NestJS (REST + Socket.IO) |
| `sip.agendamientos.com.co` | Nginx → `localhost:8088` | WebSocket de Asterisk para WebRTC |

**Puertos UDP que Asterisk necesita expuestos al público (sin Nginx, directo al host):**
- `5060/UDP` → SIP (registro de troncales y endpoints)
- `10000-20000/UDP` → RTP (audio)

---

# FASE 0 — Reconocimiento del VPS (sin tocar nada)

Conéctate y corre **uno por uno**. Pegar la salida en el chat antes de avanzar.

```bash
ssh ivan@179.50.12.198
```

```bash
# ¿Qué puertos están en uso?
sudo ss -tulpn | grep -E ':(22|80|443|3000|3001|3306|5060|6379|8088|8089|5678)\b'

# ¿Qué configs Nginx están activas?
sudo ls /etc/nginx/sites-enabled/
sudo cat /etc/nginx/sites-enabled/*

# ¿Qué contenedores Docker corren?
sudo docker ps

# ¿Qué certificados Let's Encrypt ya existen?
sudo ls /etc/letsencrypt/live/ 2>/dev/null

# Firewall
sudo ufw status verbose

# Recursos
free -h && df -h / && nproc
```

**Lo que esperamos confirmar:**
- Nginx del sistema en puerto 80 (y quizá 443)
- n8n en algún puerto (típicamente 5678)
- Docker activo
- Form Builder en `/var/www/html`

**Si encuentras algún puerto del Call Center ya ocupado** (3000, 3001, 3306, 6379, 5060, 8088, 8089), **PARA Y ME AVISAS** — hay que reasignar antes de seguir.

---

# FASE 1 — DNS

En el panel del registrador del dominio (donde compraste `agendamientos.com.co`):

Agrega 3 registros tipo **A**:

| Tipo | Nombre/Host | Valor | TTL |
|---|---|---|---|
| A | `app` | `179.50.12.198` | 300 (5 min) |
| A | `api` | `179.50.12.198` | 300 |
| A | `sip` | `179.50.12.198` | 300 |

**No toques** el registro `@` (raíz) ni `www` si ya existen para el Form Builder.

Verifica propagación (puede tardar 5-30 min):

```bash
dig +short app.agendamientos.com.co
dig +short api.agendamientos.com.co
dig +short sip.agendamientos.com.co
# Los 3 deben devolver: 179.50.12.198
```

Si no devuelven nada, espera más o usa https://dnschecker.org

---

# FASE 2 — Preparar el VPS

## 2.1 Verificar Docker

```bash
docker --version
docker compose version
sudo docker ps  # debe funcionar sin sudo idealmente
```

Si Docker no está, instálalo:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ivan
# Cierra y vuelve a abrir SSH para que tome el grupo
```

## 2.2 Firewall (UFW)

**¡CUIDADO!** Si activas UFW sin abrir el 22 primero, te quedas fuera del servidor. Revisa si UFW ya está activo:

```bash
sudo ufw status
```

Si está activo, asegúrate de que estos puertos están permitidos. Si está inactivo, hay que configurarlo así (en este orden exacto):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 5060/udp comment 'Asterisk SIP'
sudo ufw allow 10000:20000/udp comment 'Asterisk RTP'
sudo ufw enable
sudo ufw status verbose
```

**No abrir** públicamente: 3306 (MySQL), 6379 (Redis), 3000, 3001, 5038 (AMI), 8088 (ARI HTTP), 5678 (n8n). Quedan solo accesibles localmente.

## 2.3 Crear directorio del proyecto

```bash
sudo mkdir -p /opt/callcenter
sudo chown ivan:ivan /opt/callcenter
cd /opt/callcenter
```

## 2.4 Llave SSH para GitHub (mejor que tokens en URLs)

```bash
ssh-keygen -t ed25519 -C "ivan@agendamientos" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copia la salida y pégala en https://github.com/settings/keys → "New SSH key".

Verifica:
```bash
ssh -T git@github.com
# Debe responder: "Hi <usuario>! You've successfully authenticated..."
```

---

# FASE 3 — Subir el código y configurar para producción

## 3.1 Clonar el repo

```bash
cd /opt/callcenter
git clone git@github.com:TU-USUARIO/Call-Center-NODOE.git .
# Reemplaza TU-USUARIO por tu usuario real de GitHub
ls -la
```

## 3.2 Generar secretos seguros

```bash
# Genera valores aleatorios fuertes para tu .env
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)"
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)"
echo "MYSQL_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)"
echo "ASTERISK_AMI_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)"
echo "ASTERISK_ARI_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)"
```

**Copia esos valores** — los necesitas para el siguiente paso.

## 3.3 Crear el `.env` de producción

```bash
cp .env.example .env
nano .env
```

Reemplaza con valores reales. Plantilla:

```ini
NODE_ENV=production
PUBLIC_APP_URL=https://app.agendamientos.com.co
PUBLIC_API_URL=https://api.agendamientos.com.co

BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0
FRONTEND_PORT=3000

NEXT_PUBLIC_API_URL=https://api.agendamientos.com.co
NEXT_PUBLIC_WS_URL=wss://api.agendamientos.com.co
NEXT_PUBLIC_SIP_WSS_URL=wss://sip.agendamientos.com.co/ws

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=callcenter
MYSQL_USER=callcenter
MYSQL_PASSWORD=<pega lo que generaste>
MYSQL_ROOT_PASSWORD=<pega lo que generaste>

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=<pega lo que generaste>
JWT_REFRESH_SECRET=<pega lo que generaste>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_MASTER_KEY=<pega lo que generaste>

ASTERISK_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=admin
ASTERISK_AMI_PASSWORD=<pega lo que generaste>

ASTERISK_ARI_HOST=127.0.0.1
ASTERISK_ARI_PORT=8088
ASTERISK_ARI_USER=ariadmin
ASTERISK_ARI_PASSWORD=<pega lo que generaste>
ASTERISK_ARI_APP=callcenter-app

STORAGE_DRIVER=local
LOCAL_RECORDINGS_PATH=/var/recordings

CORS_ORIGINS=https://app.agendamientos.com.co

LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_METRICS=true

BOOTSTRAP_SUPERADMIN_EMAIL=ivancorrea111@gmail.com
BOOTSTRAP_SUPERADMIN_PASSWORD=<elige una contraseña fuerte>
BOOTSTRAP_SUPERADMIN_NAME=Ivan Correa
```

```bash
chmod 600 .env  # solo tú puedes leerlo
```

## 3.4 Crear `docker-compose.production.yml` (sin Nginx interno, puertos solo en localhost)

Esto **NO sobreescribe** `docker-compose.yml` original — es un override que se aplica encima.

```bash
nano docker-compose.production.yml
```

Pega esto exacto:

```yaml
version: "3.9"

# Override de producción
# Uso: docker compose -f docker-compose.yml -f docker-compose.production.yml up -d

services:

  mysql:
    ports:
      - "127.0.0.1:3306:3306"   # SOLO localhost, no expuesto a internet

  redis:
    ports:
      - "127.0.0.1:6379:6379"   # SOLO localhost

  backend:
    ports:
      - "127.0.0.1:3001:3001"   # SOLO localhost (Nginx del sistema lo proxiará)
    volumes:
      - recordings-data:/var/recordings
      # ojo: NO montamos ./backend:/app en producción
      # el contenedor usa el código BUILD-eado dentro de la imagen

  frontend:
    ports:
      - "127.0.0.1:3000:3000"   # SOLO localhost
    volumes: []  # quitamos los mounts de dev

  # Eliminamos el servicio nginx del compose — usamos el Nginx del sistema
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

> **Por qué:** así no chocas con el Nginx del sistema (que sirve el Form Builder), y MySQL/Redis quedan fuera del alcance de internet.

## 3.5 Editar el `docker-compose.yml` original — eliminar mounts de código fuente del backend

El `docker-compose.yml` original monta `./backend:/app` y `/app/node_modules`, lo cual sobrescribe el código construido. Para producción **hay que comentar esas líneas**:

```bash
nano docker-compose.yml
```

Busca el servicio `backend` y comenta así:

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: cc-backend
  restart: unless-stopped
  depends_on:
    mysql:
      condition: service_healthy
    redis:
      condition: service_healthy
  env_file:
    - .env
  environment:
    NODE_ENV: ${NODE_ENV}
  volumes:
    # - ./backend:/app             # COMENTADO: solo en dev
    # - /app/node_modules          # COMENTADO: solo en dev
    - recordings-data:/var/recordings
  ports:
    - "${BACKEND_PORT}:3001"
```

Y haz lo mismo en el servicio `frontend`:

```yaml
frontend:
  ...
  volumes: []
  # - ./frontend:/app              # COMENTADO
  # - /app/node_modules            # COMENTADO
  # - /app/.next                   # COMENTADO
```

---

# FASE 4 — Configurar Nginx del sistema (sin tocar el Form Builder)

## 4.1 Crear `app.agendamientos.com.co.conf`

```bash
sudo nano /etc/nginx/sites-available/app.agendamientos.com.co
```

```nginx
# WebSocket upgrade map (si no existe ya en otro server block)
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name app.agendamientos.com.co;

    # Para que Certbot pueda renovar
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

## 4.2 Crear `api.agendamientos.com.co.conf`

```bash
sudo nano /etc/nginx/sites-available/api.agendamientos.com.co
```

```nginx
server {
    listen 80;
    server_name api.agendamientos.com.co;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

## 4.3 Crear `sip.agendamientos.com.co.conf`

```bash
sudo nano /etc/nginx/sites-available/sip.agendamientos.com.co
```

```nginx
server {
    listen 80;
    server_name sip.agendamientos.com.co;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

## 4.4 Activar los 3 sites

```bash
sudo mkdir -p /var/www/certbot
sudo ln -s /etc/nginx/sites-available/app.agendamientos.com.co /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.agendamientos.com.co /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/sip.agendamientos.com.co /etc/nginx/sites-enabled/
sudo nginx -t   # debe decir "syntax is ok" y "test is successful"
sudo systemctl reload nginx
```

> **Nada del Form Builder se tocó.** Solo agregamos archivos nuevos.

---

# FASE 5 — HTTPS con Certbot

## 5.1 Instalar Certbot si no está

```bash
which certbot || sudo apt install -y certbot python3-certbot-nginx
```

## 5.2 Generar certificados

```bash
sudo certbot --nginx \
  -d app.agendamientos.com.co \
  -d api.agendamientos.com.co \
  -d sip.agendamientos.com.co \
  --email ivancorrea111@gmail.com \
  --agree-tos \
  --no-eff-email \
  --redirect
```

Certbot **modifica automáticamente** los 3 archivos de Nginx que creaste, agregando bloques `listen 443 ssl` con la config TLS.

## 5.3 Ahora completar los server blocks con el reverse proxy

Edita cada uno y reemplaza el contenido completo del bloque `server { listen 443 ssl ... }` por las versiones funcionales de abajo (Certbot deja los `ssl_certificate` ya configurados, **NO los borres**, solo agrega los `location`).

### `/etc/nginx/sites-available/app.agendamientos.com.co`

```nginx
server {
    listen 80;
    server_name app.agendamientos.com.co;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name app.agendamientos.com.co;

    # ssl_certificate y ssl_certificate_key los pone Certbot — NO TOCAR
    ssl_certificate /etc/letsencrypt/live/app.agendamientos.com.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.agendamientos.com.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### `/etc/nginx/sites-available/api.agendamientos.com.co`

```nginx
server {
    listen 80;
    server_name api.agendamientos.com.co;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name api.agendamientos.com.co;

    ssl_certificate /etc/letsencrypt/live/app.agendamientos.com.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.agendamientos.com.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### `/etc/nginx/sites-available/sip.agendamientos.com.co`

```nginx
server {
    listen 80;
    server_name sip.agendamientos.com.co;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name sip.agendamientos.com.co;

    ssl_certificate /etc/letsencrypt/live/app.agendamientos.com.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.agendamientos.com.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location /ws {
        proxy_pass http://127.0.0.1:8088/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }
}
```

> **Nota sobre los `ssl_certificate`:** Si Certbot generó certificados separados por subdominio, las rutas serán `/etc/letsencrypt/live/api.agendamientos.com.co/...` y `.../sip.agendamientos.com.co/...`. Si los generó como un certificado SAN compartido, todos apuntan al mismo. Verifica con:
> ```bash
> sudo ls /etc/letsencrypt/live/
> ```

Aplica:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5.4 Verificar renovación automática

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

# FASE 6 — Levantar servicios y migrar BD

## 6.1 Build y up por capas

```bash
cd /opt/callcenter

# 1. Levantar BD y caché primero
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d mysql redis

# Esperar a que MySQL esté healthy (puede tardar 30-60s la primera vez)
docker compose ps
docker compose logs -f mysql
# Cuando veas "ready for connections" → Ctrl+C

# 2. Verificar que las migraciones corrieron
# (las migraciones SQL están montadas en /docker-entrypoint-initdb.d)
docker exec -it cc-mysql mysql -u callcenter -p$(grep '^MYSQL_PASSWORD=' .env | cut -d= -f2) callcenter -e "SHOW TABLES;"
# Debe listar: companies, users, roles, permissions, agents, calls, queues, etc.

# 3. Levantar Asterisk
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d asterisk
docker compose logs -f asterisk
# Cuando veas "Asterisk Ready" → Ctrl+C

# 4. Build y levantar backend
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build backend
docker compose logs -f backend
# Buscar: "Application is running on port 3001"

# 5. Build y levantar frontend
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build frontend
docker compose logs -f frontend
# Buscar: "ready in Xs"

# 6. Estado final
docker compose ps
```

## 6.2 Bootstrap del super admin

El backend lee `BOOTSTRAP_SUPERADMIN_*` del `.env` y crea el usuario en el primer arranque. Si no se creó, fuérzalo:

```bash
docker exec -it cc-backend node dist/scripts/bootstrap-superadmin.js 2>/dev/null \
  || docker exec -it cc-backend npm run bootstrap:superadmin 2>/dev/null \
  || echo "Revisar manualmente con: docker exec -it cc-backend sh"
```

(Si el script de bootstrap no existe aún en este momento del proyecto, créalo desde el dashboard cuando entres por primera vez.)

---

# FASE 7 — Verificación y smoke tests

## 7.1 Servicios responden

```bash
# Form Builder NO se tocó
curl -I https://agendamientos.com.co
# Debe responder 200 OK (o lo que respondiera antes)

# Frontend Call Center
curl -I https://app.agendamientos.com.co
# Debe responder 200 OK

# Backend salud
curl https://api.agendamientos.com.co/health/live
# Debe responder JSON: {"status":"ok",...}

curl https://api.agendamientos.com.co/health/ready
# Debe responder ok cuando MySQL+Redis están conectados

# Certificados válidos
curl -vI https://app.agendamientos.com.co 2>&1 | grep -E 'subject:|expire'
```

## 7.2 Login del super admin

Abre en el navegador:
```
https://app.agendamientos.com.co/login
```

Login con:
- Email: `ivancorrea111@gmail.com`
- Password: la que pusiste en `BOOTSTRAP_SUPERADMIN_PASSWORD`

## 7.3 Asterisk responde

```bash
sudo docker exec -it cc-asterisk asterisk -rx "core show uptime"
sudo docker exec -it cc-asterisk asterisk -rx "pjsip show endpoints"
```

## 7.4 WebRTC SIP WebSocket

En la consola del navegador (en `https://app.agendamientos.com.co`):

```js
const ws = new WebSocket('wss://sip.agendamientos.com.co/ws', 'sip');
ws.onopen = () => console.log('WSS OK');
ws.onerror = e => console.error('WSS ERROR', e);
```

Debe imprimir `WSS OK`.

## 7.5 Form Builder sigue intacto

Abre en el navegador la URL del Form Builder (la misma de antes) y crea/edita un formulario. Si funciona igual que antes → éxito.

---

# FASE 8 — Mantenimiento y backups

## 8.1 Backup diario de MySQL

```bash
sudo nano /usr/local/bin/cc-backup.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%F_%H-%M)
BACKUP_DIR=/var/backups/callcenter
mkdir -p "$BACKUP_DIR"
docker exec cc-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases --single-transaction --quick' \
  | gzip > "$BACKUP_DIR/mysql-$TS.sql.gz"
# Retención: borra backups con más de 14 días
find "$BACKUP_DIR" -name 'mysql-*.sql.gz' -mtime +14 -delete
```

```bash
sudo chmod +x /usr/local/bin/cc-backup.sh
sudo crontab -e
# Agrega:
0 3 * * * /usr/local/bin/cc-backup.sh >> /var/log/cc-backup.log 2>&1
```

## 8.2 Backup de grabaciones (si LOCAL_RECORDINGS_PATH)

Configurar `rsync` o `rclone` a un bucket externo (S3, Backblaze, etc).

## 8.3 Logs

```bash
# Logs del Call Center
docker compose -f /opt/callcenter/docker-compose.yml -f /opt/callcenter/docker-compose.production.yml logs -f --tail=100

# Logs Nginx
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

## 8.4 Renovación SSL (automática, pero verifica)

```bash
sudo certbot renew --dry-run
```

## 8.5 Actualizaciones del código

```bash
cd /opt/callcenter
git pull
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build backend frontend
```

---

# Troubleshooting rápido

| Síntoma | Probable causa | Comando para diagnosticar |
|---|---|---|
| `502 Bad Gateway` en `app.` o `api.` | Backend/frontend no arrancó | `docker compose logs backend` |
| Login devuelve 401 con creds correctas | `JWT_SECRET` no está en `.env` o cambió | `docker exec cc-backend env \| grep JWT` |
| Micrófono bloqueado en navegador | Certificado SSL no válido | `curl -vI https://app...` |
| `cc-mysql` no arranca | Volumen viejo con otra password | `docker volume rm callcenter_mysql-data` (⚠️ borra datos) |
| Asterisk no recibe llamadas | Puerto 5060/UDP cerrado en firewall | `sudo ufw status` |
| Sin audio en llamada (one-way) | Puertos RTP 10000-20000/UDP cerrados | `sudo ufw status` |
| Form Builder dejó de responder | Pisamos algún server block | `sudo nginx -t && sudo cat /etc/nginx/sites-enabled/*` |
| n8n dejó de responder | Misma causa | `sudo docker logs <id-n8n>` |

---

# Checklist final antes de dar por listo

- [ ] FASE 0: recon completo, ningún puerto crítico chocaba
- [ ] FASE 1: `dig` resuelve los 3 subdominios
- [ ] FASE 2: Docker up, UFW configurado con 5060/UDP y 10000-20000/UDP
- [ ] FASE 3: `.env` con secretos generados, `chmod 600 .env`
- [ ] FASE 4: 3 server blocks creados, `nginx -t` ok, Form Builder intacto
- [ ] FASE 5: Certbot generó certs, `certbot renew --dry-run` ok
- [ ] FASE 6: `docker compose ps` muestra todos los servicios "Up (healthy)"
- [ ] FASE 7: Login funciona, Form Builder funciona, Asterisk responde
- [ ] FASE 8: backup cron creado, primer backup ejecutado

---

# Pendientes después del despliegue inicial

Estas cosas **no son parte del despliegue base** pero las vas a necesitar pronto:

1. **Configurar SIP trunk** con tu proveedor de telefonía (editar `asterisk/etc/pjsip.conf` con las credenciales del proveedor).
2. **Configurar al menos un DID** para recibir llamadas entrantes.
3. **Crear primera company** desde el panel de super admin y un agente de prueba.
4. **Configurar storage S3** para grabaciones (en vez de disco local) cuando tengas volumen.
5. **Configurar SMTP** para emails transaccionales (`SMTP_*` en `.env`).
6. **Configurar webhooks de salida** si vas a integrar con CRMs externos.
7. **Monitoreo**: agregar Uptime Kuma o similar para alertas.

Cada uno de esos puntos merece su propia mini-guía cuando los necesites.
