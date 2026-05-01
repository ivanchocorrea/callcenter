#!/bin/bash
# ============================================================================
# Call Center NODOE — Instalación limpia
# ============================================================================
# Este script automatiza:
#   1. Pull código de GitHub (debe estar ya en /opt/callcenter)
#   2. Build de backend y frontend con URL correcta
#   3. Levanta MySQL y Redis
#   4. Aplica TODAS las migraciones SQL
#   5. Levanta backend y frontend
#   6. Verifica que todo responda
#
# Uso (en VPS):
#   cd /opt/callcenter
#   chmod +x install.sh
#   ./install.sh
# ============================================================================

set -e

DOMAIN="${DOMAIN:-app.somoscallcenter.com}"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"

cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║    Call Center NODOE — Instalación limpia                  ║"
echo "║    Dominio: $DOMAIN"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verificar .env
if [ ! -f .env ]; then
  echo "❌ Falta archivo .env. Copia .env.example y configura los secretos."
  exit 1
fi

# Cargar password de MySQL desde .env
PASS=$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2)
if [ -z "$PASS" ]; then
  echo "❌ Falta MYSQL_ROOT_PASSWORD en .env"
  exit 1
fi

echo "[1/6] Levantando MySQL y Redis..."
sudo docker compose $COMPOSE_FILES up -d mysql redis
echo "Esperando que MySQL esté listo (max 60s)..."
for i in $(seq 1 30); do
  if docker exec cc-mysql mysqladmin ping -u root -p"$PASS" 2>/dev/null | grep -q "alive"; then
    echo "✅ MySQL listo"
    break
  fi
  sleep 2
done

echo ""
echo "[2/6] Aplicando migraciones SQL (idempotentes)..."
for f in db/migrations/*.sql; do
  echo "→ $(basename $f)"
  docker exec -i cc-mysql mysql -u root -p"$PASS" callcenter < "$f" 2>&1 | grep -vE "Warning|ERROR 1050|ERROR 1061|already exists" || true
done

echo ""
echo "[3/6] Verificando tablas críticas..."
for tbl in users companies agents calls event_outbox roles permissions; do
  EXISTS=$(docker exec cc-mysql mysql -u root -p"$PASS" callcenter -e "SHOW TABLES LIKE '$tbl';" 2>/dev/null | grep -c "$tbl" || echo 0)
  if [ "$EXISTS" -gt 0 ]; then
    echo "  ✅ $tbl"
  else
    echo "  ❌ $tbl FALTA"
  fi
done

echo ""
echo "[4/6] Build backend y frontend (sin cache, 10-15 min)..."
sudo docker compose $COMPOSE_FILES build --no-cache \
  --build-arg NEXT_PUBLIC_API_URL=https://$DOMAIN \
  --build-arg NEXT_PUBLIC_WS_URL=wss://$DOMAIN \
  --build-arg NEXT_PUBLIC_SIP_WSS_URL=wss://$DOMAIN:8089/ws \
  backend frontend

echo ""
echo "[5/6] Levantando backend y frontend..."
sudo docker compose $COMPOSE_FILES up -d --force-recreate backend frontend
echo "Esperando que backend esté listo (max 60s)..."
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api/auth/me 2>/dev/null || echo "000")
  if [ "$STATUS" = "401" ]; then
    echo "✅ Backend listo (HTTP 401 sin token)"
    break
  fi
  sleep 2
done

echo ""
echo "[6/6] Verificación final..."
echo ""
sudo docker compose $COMPOSE_FILES ps
echo ""
echo "Tests:"
curl -s -o /dev/null -w "  Frontend /login: HTTP %{http_code}\n" https://$DOMAIN/login
curl -s -o /dev/null -w "  Backend /api/auth/me: HTTP %{http_code} (esperado 401)\n" https://$DOMAIN/api/auth/me
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║  ✅ INSTALACIÓN COMPLETA                                    ║"
echo "║                                                              ║"
echo "║  Login en navegador (incógnito):                            ║"
echo "║  https://$DOMAIN/login"
echo "║                                                              ║"
echo "║  Email super_admin: ver BOOTSTRAP_EMAIL en .env             ║"
echo "║  Password: ver BOOTSTRAP_PASSWORD en .env                   ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
