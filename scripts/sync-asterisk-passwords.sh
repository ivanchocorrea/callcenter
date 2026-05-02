#!/bin/bash
# ============================================================================
# Call Center NODOE — Sincroniza passwords de AMI/ARI desde .env a los .conf
# de Asterisk
# ============================================================================
# Problema que resuelve: los archivos `manager.conf` y `ari.conf` traen
# placeholders (`change_me_ami`, `change_me_ari`) y NO se sincronizan
# automáticamente con `ASTERISK_AMI_PASSWORD` / `ASTERISK_ARI_PASSWORD`
# del `.env`. Si quedan desincronizados, AMI/ARI dan auth failed y el panel
# /admin/asterisk muestra "Desconectado".
#
# Qué hace:
#   1. Lee los passwords reales del .env.
#   2. Hace backup con timestamp de manager.conf y ari.conf.
#   3. Reemplaza la línea `secret = ...` en manager.conf y `password = ...`
#      en la sección [<ariuser>] de ari.conf.
#   4. Reinicia cc-asterisk para que tome la nueva config.
#   5. Reinicia cc-backend para que reconecte con el password correcto.
#   6. Verifica que AMI muestre 1 conexión activa y ARI tenga la app
#      `callcenter-app` registrada.
#
# Uso (en el VPS):
#   sudo bash scripts/sync-asterisk-passwords.sh
#
# Idempotente: se puede correr cuantas veces se necesite.
# ============================================================================

set -e

ENV_FILE=${ENV_FILE:-/opt/callcenter/.env}
ASTERISK_DIR=${ASTERISK_DIR:-/opt/callcenter/asterisk/etc}

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No existe $ENV_FILE"
  exit 1
fi

echo "==> [1/6] Leyendo passwords desde $ENV_FILE..."
AMI_PASS=$(grep '^ASTERISK_AMI_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
ARI_PASS=$(grep '^ASTERISK_ARI_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$AMI_PASS" ] || [ -z "$ARI_PASS" ]; then
  echo "❌ Falta ASTERISK_AMI_PASSWORD o ASTERISK_ARI_PASSWORD en $ENV_FILE"
  exit 1
fi
echo "   AMI password: ${#AMI_PASS} caracteres"
echo "   ARI password: ${#ARI_PASS} caracteres"

TS=$(date +%s)

echo "==> [2/6] Backup de manager.conf y ari.conf..."
cp "$ASTERISK_DIR/manager.conf" "$ASTERISK_DIR/manager.conf.bak.$TS"
cp "$ASTERISK_DIR/ari.conf"     "$ASTERISK_DIR/ari.conf.bak.$TS"
echo "   Backups con sufijo .bak.$TS"

echo "==> [3/6] Reemplazando passwords..."
sed -i "s|^secret = .*|secret = ${AMI_PASS}|" "$ASTERISK_DIR/manager.conf"
sed -i "s|^password = .*|password = ${ARI_PASS}|" "$ASTERISK_DIR/ari.conf"
echo "   Líneas actualizadas (oculto valores):"
grep '^secret'   "$ASTERISK_DIR/manager.conf" | sed 's|=.*|= ***ocultado***|'
grep '^password' "$ASTERISK_DIR/ari.conf"     | sed 's|=.*|= ***ocultado***|'

echo "==> [4/6] Reiniciando contenedor cc-asterisk..."
docker restart cc-asterisk >/dev/null
sleep 10

echo "==> [5/6] Reiniciando contenedor cc-backend..."
docker restart cc-backend >/dev/null
sleep 18

echo "==> [6/6] Verificación:"
echo ""
echo "--- Conexiones AMI activas (debe mostrar 1, usuario 'admin'):"
docker exec cc-asterisk asterisk -rx "manager show connected" 2>/dev/null | grep -v "Unable to open" || true
echo ""
echo "--- Apps ARI registradas (debe aparecer 'callcenter-app'):"
docker exec cc-asterisk asterisk -rx "ari show apps" 2>/dev/null | grep -v "Unable to open" || true
echo ""
echo "--- Logs Asterisk (NO debería haber 'failed to authenticate'):"
docker logs cc-asterisk --tail 30 2>&1 | grep -iE 'failed to auth' | tail -3 || echo "   (sin errores de auth)"

echo ""
echo "================================================================"
echo "  Recarga la página: https://app.somoscallcenter.com/admin/asterisk"
echo "  Ambos badges deben aparecer en verde 'Conectado'."
echo "================================================================"
