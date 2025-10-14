#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VENV_PATH="${PROJECT_ROOT}/.venv"
UVICORN_HOST="0.0.0.0"
UVICORN_PORT="${UVICORN_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PROJECT_NAME="${PROJECT_NAME:-doculens}"
export PROJECT_NAME
export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"
export DATABASE_HOST="${DATABASE_HOST:-127.0.0.1}"
export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
STOP_SCRIPT="${PROJECT_ROOT}/scripts/dev_stack_stop.sh"

function log() {
  printf '[dev-stack] %s\n' "$*" >&2
}

if [[ ! -d "${VENV_PATH}" ]]; then
  log "Python virtualenv not found at ${VENV_PATH}."
  log "Create one with: python3 -m venv .venv && source .venv/bin/activate && pip install -r app/requirements.txt"
  exit 1
fi

source "${VENV_PATH}/bin/activate"

if ! command -v docker >/dev/null 2>&1; then
  log "docker command not found. Please install Docker Desktop or CLI."
  exit 1
fi

DOCKER_OK=0
for attempt in {1..10}; do
  if docker info >/dev/null 2>&1; then
    DOCKER_OK=1
    break
  fi
  log "Waiting for Docker daemon to become available (attempt ${attempt}/10)…"
  sleep 3
done

if [[ "${DOCKER_OK}" -ne 1 ]]; then
  log "Docker daemon is not reachable. Ensure Docker Desktop is running and try again."
  exit 1
fi

if ! command -v uvicorn >/dev/null 2>&1; then
  log "uvicorn not available in virtualenv. Install dependencies first."
  exit 1
fi

if ! command -v celery >/dev/null 2>&1; then
  log "celery not available in virtualenv. Install dependencies first."
  exit 1
fi

export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"

if [[ -x "${STOP_SCRIPT}" ]]; then
  log "Stopping any previously running dev stack processes…"
  "${STOP_SCRIPT}" --skip-docker >/dev/null 2>&1 || true
fi

if command -v lsof >/dev/null 2>&1; then
  in_use=$(lsof -ti tcp:"${UVICORN_PORT}" 2>/dev/null || true)
  if [[ -n "${in_use}" ]]; then
    log "Port ${UVICORN_PORT} is already in use; attempting to release it."
    kill ${in_use} >/dev/null 2>&1 || true
  fi
  in_use=$(lsof -ti tcp:"${FRONTEND_PORT}" 2>/dev/null || true)
  if [[ -n "${in_use}" ]]; then
    log "Port ${FRONTEND_PORT} is already in use; attempting to release it."
    kill ${in_use} >/dev/null 2>&1 || true
  fi
fi

log "Ensuring no stale containers are running…"
docker compose -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true

for svc in database redis; do
  cname="${PROJECT_NAME}_${svc}"
  cid=$(docker ps -aq --filter "name=${cname}")
  if [[ -n "${cid}" ]]; then
    log "Stopping orphan container ${cname} (${cid})…"
    docker stop "${cid}" >/dev/null 2>&1 || true
    docker rm "${cid}" >/dev/null 2>&1 || true
  fi
done

log "Starting database and redis containers via docker compose…"
docker compose -f "${COMPOSE_FILE}" up -d database redis

log "Launching FastAPI (uvicorn) on port ${UVICORN_PORT}…"
uvicorn app.main:app \
  --reload \
  --host "${UVICORN_HOST}" \
  --port "${UVICORN_PORT}" \
  --reload-dir "${PROJECT_ROOT}/app" &
UVICORN_PID=$!

log "Launching Celery worker…"
celery -A app.tasks.tasks worker --loglevel=info --pool=solo &
CELERY_PID=$!

cd "${PROJECT_ROOT}/frontend"

if [[ ! -d node_modules ]]; then
  log "Installing frontend dependencies with npm install (first run)…"
  npm install
fi

log "Starting Vite dev server on port ${FRONTEND_PORT}…"
npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

function cleanup() {
  log "Shutting down dev stack…"
  if kill -0 ${FRONTEND_PID} 2>/dev/null; then
    kill ${FRONTEND_PID}
  fi
  if kill -0 ${CELERY_PID} 2>/dev/null; then
    kill ${CELERY_PID}
  fi
  if kill -0 ${UVICORN_PID} 2>/dev/null; then
    kill ${UVICORN_PID}
  fi
  wait || true
  log "Services stopped. Containers remain running; use 'docker compose -f ${COMPOSE_FILE} down' to stop them."
}

trap cleanup EXIT INT TERM

log "Dev stack is running. Access API at http://localhost:${UVICORN_PORT} and UI at http://localhost:${FRONTEND_PORT}"
log "Press Ctrl+C to stop."

wait
