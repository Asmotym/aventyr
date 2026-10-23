#!/usr/bin/env bash
set -euo pipefail

dotenv_file="${DOTENV_FILE:-/app/.env}"
if [[ -f "$dotenv_file" ]]; then
  # Load values from .env before computing defaults.
  set -a
  source "$dotenv_file"
  set +a
fi

MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_USER_NAME="${MYSQL_USER:-aventyr}"
MYSQL_USER_PASSWORD="${MYSQL_PASSWORD:-aventyr}"
MYSQL_DATABASE_NAME="${MYSQL_DATABASE:-aventyr}"
backend_pid=""
frontend_pid=""

is_truthy() {
  local value="${1:-}"
  case "${value,,}" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

DEV_MODE=false
if [[ -n "${AVENTYR_DEV_MODE:-}" ]]; then
  is_truthy "$AVENTYR_DEV_MODE" && DEV_MODE=true
elif [[ "${NODE_ENV:-}" != "" ]] && [[ "${NODE_ENV,,}" == "development" ]]; then
  DEV_MODE=true
fi

cleanup() {
  set +e
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
}

trap cleanup SIGINT SIGTERM EXIT

export DATABASE_URL="${DATABASE_URL:-mysql://${MYSQL_USER_NAME}:${MYSQL_USER_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE_NAME}}"
export MYSQL_HOST
export BACKEND_PORT="${BACKEND_PORT:-4000}"
export PORT="$BACKEND_PORT"
export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
export VITE_BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:${BACKEND_PORT}}"
export VITE_PUBLIC_API_BASE_URL="${VITE_PUBLIC_API_BASE_URL:-http://localhost:${BACKEND_PORT}/api}"
export HOST="${HOST:-0.0.0.0}"

wait_for_mysql() {
  echo "Waiting for MySQL at ${MYSQL_HOST}:${MYSQL_PORT}..."
  for _ in $(seq 1 60); do
    if mysqladmin ping --skip-ssl -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER_NAME}" -p"${MYSQL_USER_PASSWORD}" --silent >/dev/null 2>&1; then
      echo "MySQL is available."
      return 0
    fi
    sleep 1
  done

  echo "MySQL is not reachable at ${MYSQL_HOST}:${MYSQL_PORT}" >&2
  exit 1
}

if [[ "$DEV_MODE" == "true" ]]; then
  export NODE_ENV=development
else
  export NODE_ENV="${NODE_ENV:-production}"
fi

start_backend() {
  if [[ "$DEV_MODE" == "true" ]]; then
    npm run server:dev &
  else
    node dist-server/index.js &
  fi
  backend_pid=$!
}

start_frontend() {
  if [[ "$DEV_MODE" == "true" ]]; then
    npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
  else
    npm run preview -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
  fi
  frontend_pid=$!
}

wait_for_mysql
start_backend
start_frontend

wait -n
