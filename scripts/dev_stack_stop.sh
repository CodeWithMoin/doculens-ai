#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
PROJECT_NAME="${PROJECT_NAME:-doculens}"
export PROJECT_NAME
export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

SKIP_DOCKER=0

for arg in "$@"; do
  case "${arg}" in
    --skip-docker)
      SKIP_DOCKER=1
      ;;
    *)
      ;;
  esac
done

log() {
  printf '[dev-stack:stop] %s\n' "$*" >&2
}

kill_processes() {
  local pattern
  for pattern in "uvicorn app.main:app" "celery -A app.tasks.tasks" "celery -A tasks.tasks" "vite --host" "watchmedo auto-restart"; do
    if pgrep -f "${pattern}" >/dev/null 2>&1; then
      log "Stopping processes matching '${pattern}'"
      pkill -f "${pattern}" >/dev/null 2>&1 || true
    fi
  done
}

kill_processes

if [[ ${SKIP_DOCKER} -eq 0 ]]; then
  if command -v docker >/dev/null 2>&1; then
    log "Stopping docker compose services…"
    docker compose -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
    for svc in database redis; do
      cname="${PROJECT_NAME}_${svc}"
      cid=$(docker ps -aq --filter "name=${cname}")
      if [[ -n "${cid}" ]]; then
        log "Removing lingering container ${cname} (${cid})"
        docker stop "${cid}" >/dev/null 2>&1 || true
        docker rm "${cid}" >/dev/null 2>&1 || true
      fi
    done
  else
    log "docker command not found; skipping container shutdown."
  fi
fi

log "Cleanup complete."
