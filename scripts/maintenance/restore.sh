#!/usr/bin/env bash
# =====================================================================
# restore.sh — Restaura un respaldo creado por backup.sh
# Uso:
#   bash scripts/maintenance/restore.sh --file=/ruta/backup.tar.gz
#
# IMPORTANTE: este script REEMPLAZA datos. Siempre lo dispara el panel
# después de doble confirmación + frase "RESTAURAR" + respaldo previo.
# =====================================================================
set -euo pipefail

FILE=""
for arg in "$@"; do
  case "$arg" in
    --file=*) FILE="${arg#*=}" ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "ERROR: archivo de respaldo no encontrado: $FILE" >&2
  exit 2
fi

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "[restore] Extrayendo $FILE …"
tar -xzf "$FILE" -C "$TMPDIR"

# ---------- BD ----------
if [[ -f "$TMPDIR/db.sql" ]]; then
  echo "[restore] Restaurando MySQL ($MYSQL_DATABASE)…"
  mysql \
    --host="${MYSQL_HOST:-127.0.0.1}" \
    --port="${MYSQL_PORT:-3306}" \
    --user="${MYSQL_USER}" \
    --password="${MYSQL_PASSWORD}" \
    --default-character-set=utf8mb4 \
    "${MYSQL_DATABASE}" < "$TMPDIR/db.sql"
fi

# ---------- Uploads ----------
if [[ -d "$TMPDIR/uploads" ]]; then
  UP="${STORAGE_LOCAL_PATH:-./storage/uploads}"
  echo "[restore] Restaurando uploads en $UP …"
  mkdir -p "$UP"
  cp -a "$TMPDIR/uploads/." "$UP/"
fi

echo "[restore] OK. Se recomienda reiniciar el backend."
