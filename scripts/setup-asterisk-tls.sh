#!/bin/bash
# ============================================================================
# Call Center NODOE — Configura TLS WSS de Asterisk reusando el cert de
# Let's Encrypt del dominio del panel.
# ============================================================================
# Para qué sirve: el navegador del agente se registra al softphone WebRTC
# vía `wss://<DOMAIN>:8089/ws`. Asterisk necesita un cert TLS válido para
# escuchar HTTPS en :8089. Reusamos el de nginx (Let's Encrypt) — no hay
# que generar uno nuevo.
#
# Qué hace:
#   1. Lee el cert+key de /etc/letsencrypt/live/<DOMAIN>/  (o symlinks).
#   2. Los concatena en /opt/callcenter/asterisk/etc/keys/asterisk.pem
#      (formato esperado por res_http_websocket).
#   3. Asegura permisos 644 (leíble por UID 1000 que corre Asterisk).
#   4. Abre puerto 8089 en UFW si está activo.
#   5. Reinicia cc-asterisk.
#   6. Verifica que el puerto 8089 esté escuchando con TLS.
#
# Idempotente: se puede correr cuando se renueva el cert (cada 90 días,
# Let's Encrypt). Idealmente automatizar por cron post-renew de certbot.
#
# Uso (en VPS):
#   sudo bash scripts/setup-asterisk-tls.sh
#   # O con dominio específico:
#   sudo DOMAIN=app.somoscallcenter.com bash scripts/setup-asterisk-tls.sh
# ============================================================================

set -e

DOMAIN=${DOMAIN:-app.somoscallcenter.com}
ASTERISK_KEYS_DIR=${ASTERISK_KEYS_DIR:-/opt/callcenter/asterisk/etc/keys}
LE_BASE=${LE_BASE:-/etc/letsencrypt/live}

# Buscar el cert: primero /etc/letsencrypt/live/<DOMAIN>/, sino /etc/letsencrypt/live/
CERT=""
KEY=""
if [ -f "$LE_BASE/$DOMAIN/fullchain.pem" ]; then
  CERT="$LE_BASE/$DOMAIN/fullchain.pem"
  KEY="$LE_BASE/$DOMAIN/privkey.pem"
elif [ -f "$LE_BASE/fullchain.pem" ]; then
  CERT="$LE_BASE/fullchain.pem"
  KEY="$LE_BASE/privkey.pem"
else
  echo "❌ No encontré fullchain.pem en $LE_BASE/$DOMAIN/ ni en $LE_BASE/"
  echo "   ¿Está instalado certbot y emitido el cert para $DOMAIN?"
  exit 1
fi

echo "==> [1/5] Cert encontrado:"
echo "   cert: $CERT"
echo "   key:  $KEY"

echo "==> [2/5] Generando $ASTERISK_KEYS_DIR/asterisk.pem (cert + key concatenados)..."
mkdir -p "$ASTERISK_KEYS_DIR"
cat "$CERT" "$KEY" > "$ASTERISK_KEYS_DIR/asterisk.pem"
chmod 644 "$ASTERISK_KEYS_DIR/asterisk.pem"
ls -la "$ASTERISK_KEYS_DIR/asterisk.pem"
echo "   ✅ Tamaño: $(wc -c < "$ASTERISK_KEYS_DIR/asterisk.pem") bytes"

echo "==> [3/5] Verificando contenido del .pem (CN del cert + presencia de key)..."
echo "   CN: $(openssl x509 -in "$ASTERISK_KEYS_DIR/asterisk.pem" -noout -subject 2>/dev/null | sed 's|.*CN *= *||')"
echo "   Vence: $(openssl x509 -in "$ASTERISK_KEYS_DIR/asterisk.pem" -noout -enddate 2>/dev/null | cut -d= -f2)"
grep -q "BEGIN PRIVATE KEY\|BEGIN RSA PRIVATE KEY" "$ASTERISK_KEYS_DIR/asterisk.pem" && echo "   ✅ Private key embedded" || echo "   ❌ NO hay key embedded"

echo "==> [4/5] UFW: abrir puerto 8089 si está activo..."
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 8089/tcp comment 'Asterisk WSS para WebRTC' >/dev/null
  echo "   ✅ Regla agregada (8089/tcp)"
else
  echo "   (UFW inactivo, no se requiere regla)"
fi

echo "==> [5/5] Reiniciando cc-asterisk para que tome la nueva config..."
docker restart cc-asterisk >/dev/null
sleep 12

echo ""
echo "--- Verificación: ¿está Asterisk escuchando en 8089 con TLS?"
if ss -tlnp | grep -q ':8089'; then
  ss -tlnp | grep ':8089'
  echo "   ✅ Puerto 8089 escuchando"
else
  echo "   ❌ Nada en puerto 8089. Revisa logs: docker logs cc-asterisk --tail 30"
fi

echo ""
echo "--- Test TLS handshake (debe mostrar el cert):"
timeout 5 openssl s_client -connect 127.0.0.1:8089 -showcerts </dev/null 2>/dev/null | grep -E "subject=|issuer=" | head -2 \
  || echo "   ⚠️  No se completó handshake. Verifica logs de Asterisk."

echo ""
echo "================================================================"
echo "  Ahora el agente debería poder conectarse:"
echo "  https://$DOMAIN/agent → Mi escritorio (badge SIP debe pasar"
echo "  de 'SIP failed' a 'SIP registered')"
echo "================================================================"
