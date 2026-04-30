#!/usr/bin/env bash
# =====================================================================
# restart.sh — Reinicia uno o varios servicios.
# Uso:
#   bash scripts/maintenance/restart.sh --target=backend|frontend|asterisk|redis|all
#
# Detecta el orquestador disponible:
#   1) docker compose (preferido)
#   2) systemctl (si los servicios están instalados como systemd)
#   3) pm2 (fallback para entornos sin docker)
# =====================================================================
set -euo pipefail

TARGET=""
for arg in "$@"; do
  case "$arg" in
    --target=*) TARGET="${arg#*=}" ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

case "$TARGET" in
  backend|frontend|asterisk|redis|all) ;;
  *) echo "ERROR: --target debe ser backend|frontend|asterisk|redis|all" >&2; exit 2 ;;
esac

# Mapeo nombre interno -> nombre del servicio
service_for() {
  case "$1" in
    backend)  echo "callcenter-backend" ;;
    frontend) echo "callcenter-frontend" ;;
    asterisk) echo "asterisk" ;;
    redis)    echo "redis" ;;
  esac
}

restart_one() {
  local svc="$1"
  echo "[restart] Reiniciando $svc …"

  if command -v docker >/dev/null && [[ -f docker-compose.yml ]]; then
    if docker compose ps --services 2>/dev/null | grep -qx "$svc"; then
      docker compose restart "$svc"
      return 0
    fi
  fi

  if command -v systemctl >/dev/null && systemctl list-units --full -all 2>/dev/null | grep -q "$svc.service"; then
    sudo systemctl restart "$svc"
    return 0
  fi

  if command -v pm2 >/dev/null && pm2 jlist 2>/dev/null | grep -q "\"name\":\"$svc\""; then
    pm2 restart "$svc"
    return 0
  fi

  echo "[restart] (aviso) no encontré $svc en docker/systemd/pm2"
  return 1
}

if [[ "$TARGET" == "all" ]]; then
  ok=0
  for t in backend frontend asterisk redis; do
    restart_one "$(service_for "$t")" || ok=1 || true
  done
  exit "$ok"
else
  restart_one "$(service_for "$TARGET")"
fi
