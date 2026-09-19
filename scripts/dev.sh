#!/usr/bin/env bash
# Start backend (uvicorn) + frontend (Vite) concurrently.
# Ctrl-C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "Stopping dev servers..."
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://127.0.0.1:${BACKEND_PORT} ..."
(
  cd "$ROOT/backend"
  "$ROOT/venv/bin/uvicorn" config.asgi:application --host 127.0.0.1 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:${FRONTEND_PORT} ..."
(
  cd "$ROOT/frontend"
  npm run dev -- --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

wait