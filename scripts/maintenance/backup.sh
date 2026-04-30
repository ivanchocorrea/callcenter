#!/usr/bin/env bash
# =====================================================================
# backup.sh — Crea un respaldo del sistema (BD + uploads + config)
# Uso:
#   bash scripts/maintenance/backup.sh \
#        --out=/ruta/backup-YYYYMMDD.tar.gz \
#        [--db|--no-db] [--uploads|--no-uploads] [--config|--no-config]
#
# Variables de entorno necesarias (.env):
#   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
#   STORAGE_LOCAL_PATH (carpeta de uploads)
#
# El panel /admin/maintenance llama a este script. También puede usarse
# desde la consola por el desarrollador.
# =====================================================================
set -euo pipefail

OUT=""
INC_DB=true
INC_UPLOADS=true
INC_CONFIG=true

for arg in "$@"; do
  case "$arg" in
    --out=*)         OUT="${arg#*=}" ;;
    --db)            INC_DB=true ;;
    --no-db)         INC_DB=false ;;
    --uploads)       INC_UPLOADS=true ;;
    --no-uploads)    INC_UPLOADS=false ;;
    --config)        INC_CONFIG=true ;;
    --no-config)     INC_CONFIG=false ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$OUT" ]]; then
  echo "ERROR: falta --out=<ruta>" >&2
  exit 2
fi

# Cargar .env si existe
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "[backup] Carpeta temporal: $TMPDIR"

# ---------- Base de datos ----------
if $INC_DB; then
  DUMP_FILE="$TMPDIR/db.sql"
  echo "[backup] Volcando MySQL ($MYSQL_DATABASE)…"
  mysqldump \
    --host="${MYSQL_HOST:-127.0.0.1}" \
    --port="${MYSQL_PORT:-3306}" \
    --user="${MYSQL_USER}" \
    --password="${MYSQL_PASSWORD}" \
    --single-transaction --routines --triggers --events \
    --default-character-set=utf8mb4 \
    "${MYSQL_DATABASE}" > "$DUMP_FILE"
fi

# ---------- Uploads ----------
if $INC_UPLOADS; then
  UP="${STORAGE_LOCAL_PATH:-./storage/uploads}"
  if [[ -d "$UP" ]]; then
    echo "[backup] Copiando uploads desde $UP …"
    mkdir -p "$TMPDIR/uploads"
    cp -a "$UP/." "$TMPDIR/uploads/"
  else
    echo "[backup] (info) carpeta $UP no existe, se omite"
  fi
fi

# ---------- Configuración (sin secretos en plano) ----------
if $INC_CONFIG; then
  echo "[backup] Empaquetando configuración…"
  mkdir -p "$TMPDIR/config"
  # Estructura sí, secretos NO: copiamos archivos pero los .env los ofuscamos.
  if [[ -f .env ]]; then
    sed -E 's/(PASSWORD|SECRET|TOKEN|KEY)=.*/\1=***REDACTED***/I' .env > "$TMPDIR/config/env.redacted"
  fi
  if [[ -d nginx ]];    then cp -a nginx    "$TMPDIR/config/"; fi
  if [[ -d asterisk ]]; then cp -a asterisk "$TMPDIR/config/"; fi
  if [[ -f docker-compose.yml ]]; then cp -a docker-compose.yml "$TMPDIR/config/"; fi
fi

# ---------- Empaquetar ----------
mkdir -p "$(dirname "$OUT")"
echo "[backup] Comprimiendo en $OUT …"
tar -czf "$OUT" -C "$TMPDIR" .

echo "[backup] OK ($(du -h "$OUT" | cut -f1))"
