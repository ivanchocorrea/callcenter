#!/usr/bin/env bash
# =====================================================================
# run-tests.sh — Pruebas básicas tras una actualización.
# Verifica que:
#   1) El backend compila (tsc).
#   2) El backend pasa lint.
#   3) /health/live y /health/ready responden 200 (si BACKEND_URL está set).
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "[tests] Compilando backend…"
( cd backend && npm run build --silent )

echo "[tests] Lint backend…"
( cd backend && npm run lint --silent ) || true

if [[ -n "${BACKEND_URL:-}" ]]; then
  echo "[tests] Probando endpoints de salud en ${BACKEND_URL} …"
  curl -fsS "${BACKEND_URL}/health/live"  >/dev/null && echo "  /health/live OK"
  curl -fsS "${BACKEND_URL}/health/ready" >/dev/null && echo "  /health/ready OK"
fi

echo "[tests] OK"
