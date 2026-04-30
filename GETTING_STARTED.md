# Getting Started — Call Center NODOE

Esta guía te lleva desde un VPS Ubuntu vacío hasta un sistema funcional de Fase 0+1+2.

## Requisitos

- VPS Ubuntu 22.04 LTS (mínimo 8 vCPU / 16 GB RAM / 200 GB SSD para producción).
- Docker 24+ y Docker Compose v2.
- Dominio apuntado al VPS (para WSS de WebRTC necesitas TLS válido).
- Una troncal SIP del proveedor que elijas (DIDWW, Voxbeam, Twilio, etc.).

## 1. Clonar y configurar variables

```bash
git clone <tu-repo> callcenter
cd callcenter
cp .env.example .env
```

**Edita `.env`** y reemplaza:
- `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` — passwords fuertes
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — generar con `openssl rand -hex 64`
- `ENCRYPTION_MASTER_KEY` — generar con `openssl rand -hex 32` (debe quedar 64 chars exactos)
- `ASTERISK_AMI_PASSWORD`, `ASTERISK_ARI_PASSWORD` — passwords fuertes (deben coincidir con `asterisk/etc/manager.conf` y `asterisk/etc/ari.conf`)
- `BOOTSTRAP_SUPERADMIN_*` — credenciales del primer super admin
- `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `NEXT_PUBLIC_*_URL` — URLs públicas reales (con tu dominio)
- `CORS_ORIGINS` — incluye tu dominio de frontend

## 2. Ajustar configuración de Asterisk

Edita `asterisk/etc/manager.conf` y `asterisk/etc/ari.conf` para que las contraseñas coincidan con `.env`:

```ini
; manager.conf
[admin]
secret = <ASTERISK_AMI_PASSWORD del .env>
```

```ini
; ari.conf
[ariadmin]
password = <ASTERISK_ARI_PASSWORD del .env>
```

## 3. Levantar el stack

```bash
docker compose up -d
```

La primera vez tarda algunos minutos (descarga imágenes y build del backend/frontend). Las migraciones SQL se aplican automáticamente al inicializar MySQL.

Verifica que todo arrancó:

```bash
docker compose ps
docker compose logs -f backend
```

## 4. Acceder a la aplicación

- **Frontend**: http://app.localhost (en producción tu dominio)
- **Backend Swagger**: http://api.localhost/api/docs
- **Health**: http://api.localhost/health/ready

Login con las credenciales del super-admin definidas en `.env` (`BOOTSTRAP_SUPERADMIN_*`).

> El super-admin se crea automáticamente la primera vez que arranca el backend, si no hay usuarios en la base.

## 5. Crear tu primera empresa

1. Login como super-admin → menú **Empresas → Nueva**.
2. Llenar slug, nombre, país, timezone.
3. Crear un usuario `company_admin` para esa empresa (menú **Usuarios → Nuevo**, asignar rol `company_admin` y `company_id` de la empresa que creaste).
4. Cierra sesión y entra como company_admin.

## 6. Próximos pasos (fases siguientes)

Lo que ya está construido cubre **Fase 0+1+2** (auth, multi-tenancy, panel base). Para llegar a un sistema que reciba llamadas reales, necesitas implementar:

- **Fase 3**: Configurar troncal SIP. La UI ya tiene el menú listo en `/admin/sip-trunks`; hay que conectarla con el endpoint backend (stub en `backend/src/sip/`).
- **Fase 4**: Conectar el backend al ARI/AMI de Asterisk. El stub está en `backend/src/asterisk/asterisk-bridge.service.ts`.
- **Fase 5**: Provisioning WebRTC del agente y SIP.js en frontend.
- **Fase 6**: Detectar llamada entrante y mostrar popup.

Sigue el `ROADMAP.md` y los documentos de diseño en `docs/`.

## 7. Producción

### TLS (Let's Encrypt)

Edita `nginx/conf.d/app.conf` para producción:

```nginx
server {
    listen 443 ssl http2;
    server_name app.tudominio.com;
    ssl_certificate     /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    # ...
}
```

Genera certificados con certbot dentro del container nginx o usa el host.

### Backups MySQL

Cron diario:

```bash
0 2 * * * docker exec cc-mysql mysqldump -uroot -p$MYSQL_ROOT_PASSWORD callcenter | gzip > /backup/callcenter-$(date +\%F).sql.gz
```

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 5060/udp   # SIP UDP
sudo ufw allow 5060/tcp   # SIP TCP
sudo ufw allow 5061/tcp   # SIP TLS
sudo ufw allow 8089/tcp   # WSS WebRTC
sudo ufw allow 10000:20000/udp  # RTP
sudo ufw enable
```

### Monitoreo

Recomendado (Fase 23):
- Prometheus + Grafana para métricas
- Loki para logs
- Uptime Kuma para health checks externos

## Troubleshooting

### El backend no arranca con error de validación de variables
Tu `.env` no tiene todas las variables requeridas o están mal formadas. Mira `backend/src/config/config.schema.ts` para la lista completa con sus restricciones (especialmente `ENCRYPTION_MASTER_KEY` debe ser exactamente 64 chars hex).

### MySQL no aplica las migraciones
Las migraciones solo se ejecutan **la primera vez** que se crea el volumen. Si ya inicializaste MySQL antes:
```bash
docker compose down -v   # CUIDADO: borra datos
docker compose up -d
```

### El frontend muestra "Network Error" en login
Verifica:
1. `NEXT_PUBLIC_API_URL` en `.env` apunta a una URL accesible desde el navegador (no `http://backend:3001`).
2. `CORS_ORIGINS` en `.env` incluye el origen del frontend.

### El agente no se registra en Asterisk
- Verifica que `transport-wss` esté escuchando: `docker exec cc-asterisk asterisk -rx "pjsip show transports"`.
- En producción WebRTC requiere TLS válido.
- Mira logs del navegador (consola) para errores de WSS / certificados.

## Soporte

- Documentos de diseño: ver carpeta `docs/`.
- Backend roadmap por módulo: `backend/src/modules-roadmap.md`.
- Sugerencias añadidas a la spec original: `SUGGESTIONS.md`.
