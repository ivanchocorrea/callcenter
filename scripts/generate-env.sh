#!/usr/bin/env bash
# =====================================================================
#  generate-env.sh
#  Versión Linux/macOS de generate-env.ps1.
#  Uso: bash scripts/generate-env.sh
# =====================================================================
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

hex() { openssl rand -hex "$1"; }
pass() { tr -dc 'A-Za-z0-9!@#$%^&*' </dev/urandom | head -c "$1"; }

if [[ -f "$ENV_FILE" ]]; then
  read -r -p "⚠ Ya existe .env. Sobrescribir? (s/N) " ans
  [[ "$ans" =~ ^[sS]$ ]] || exit 0
fi

MYSQL_ROOT_PWD="$(pass 24)"
MYSQL_USER_PWD="$(pass 24)"
JWT_ACCESS="$(hex 32)"
JWT_REFRESH="$(hex 32)"
ENC_MASTER="$(hex 32)"
AMI_PWD="$(pass 16)"
ARI_PWD="$(pass 16)"
BOOT_PWD="ChangeMeNow!$(pass 8)"

cat > "$ENV_FILE" <<EOF
# Generado automáticamente $(date '+%Y-%m-%d %H:%M:%S')

NODE_ENV=development
PUBLIC_APP_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:3001

BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0
FRONTEND_PORT=3000

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_SIP_WSS_URL=wss://localhost:8089/ws

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=callcenter
MYSQL_USER=callcenter
MYSQL_PASSWORD=${MYSQL_USER_PWD}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PWD}

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_MASTER_KEY=${ENC_MASTER}

ASTERISK_HOST=asterisk
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=admin
ASTERISK_AMI_PASSWORD=${AMI_PWD}
ASTERISK_ARI_HOST=asterisk
ASTERISK_ARI_PORT=8088
ASTERISK_ARI_USER=ariadmin
ASTERISK_ARI_PASSWORD=${ARI_PWD}
ASTERISK_ARI_APP=callcenter-app

STORAGE_DRIVER=local
LOCAL_RECORDINGS_PATH=/var/recordings

CORS_ORIGINS=http://localhost:3000

LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_METRICS=true
ENABLE_TRACING=false

RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

BOOTSTRAP_SUPERADMIN_EMAIL=admin@nodoe.test
BOOTSTRAP_SUPERADMIN_PASSWORD=${BOOT_PWD}
BOOTSTRAP_SUPERADMIN_NAME=Super Admin
EOF

# Sincronizar passwords con asterisk/etc/*.conf
sed -i.bak -E "s/secret = .*/secret = ${AMI_PWD}/" "$ROOT/asterisk/etc/manager.conf" 2>/dev/null && rm -f "$ROOT/asterisk/etc/manager.conf.bak" || true
sed -i.bak -E "s/password = .*/password = ${ARI_PWD}/" "$ROOT/asterisk/etc/ari.conf" 2>/dev/null && rm -f "$ROOT/asterisk/etc/ari.conf.bak" || true

cat <<EOF

✓ .env generado en: $ENV_FILE

Credenciales del super-admin (guárdalas):
  Email:    admin@nodoe.test
  Password: ${BOOT_PWD}

Siguiente paso:
  docker compose -f docker-compose.dev.yml up -d --build
EOF
