#!/usr/bin/env bash
# =====================================================================
# update.sh — Pipeline completo de actualización segura.
# Pasos:
#   1) Crear respaldo previo.
#   2) Aplicar npm update (solo patch + minor).
#   3) Compilar y correr pruebas básicas.
#   4) Si OK, escribir marca de "última actualización".
# Si algo falla, sale con error y NO se marca como completada.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PROJECT="${1:-all}"   # backend | frontend | all
STAMP="$(date '+%Y-%m-%dT%H-%M-%S')"

mkdir -p backups .maintenance

echo "[update] 1/4 Respaldo previo…"
bash scripts/maintenance/backup.sh \
  --out="backups/pre-update-${STAMP}.tar.gz" \
  --db --uploads --config

run_npm_update() {
  local p="$1"
  echo "[update] Aplicando npm update en $p …"
  ( cd "$p" && npm update --json )
}

echo "[update] 2/4 Aplicando actualizaciones seguras (patch+minor)…"
case "$PROJECT" in
  backend)  run_npm_update backend ;;
  frontend) run_npm_update frontend ;;
  all)      run_npm_update backend; run_npm_update frontend ;;
  *) echo "ERROR: proyecto desconocido: $PROJECT" >&2; exit 2 ;;
esac

echo "[update] 3/4 Compilando y pruebas…"
bash scripts/maintenance/run-tests.sh

echo "[update] 4/4 Marca de última actualización…"
date '+%Y-%m-%dT%H:%M:%S%z' > .maintenance/last-update.txt

echo "[update] OK ($PROJECT)"
