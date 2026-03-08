#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/sato-app"

BACKEND_PID=""

port_is_available() {
  "$BACKEND_PYTHON" - "$1" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    sock.bind(("127.0.0.1", port))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
PY
}

pick_available_port() {
  local requested_port="$1"
  local port="$requested_port"

  while ! port_is_available "$port"; do
    port=$((port + 1))
  done

  printf '%s\n' "$port"
}

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -f "$BACKEND_DIR/app.py" ]]; then
  echo "Missing backend/app.py" >&2
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Missing sato-app/package.json" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Frontend dependencies are missing. Run 'cd sato-app && npm install' first." >&2
  exit 1
fi

if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"
elif [[ -x "$BACKEND_DIR/myenv/bin/python" ]]; then
  BACKEND_PYTHON="$BACKEND_DIR/myenv/bin/python"
else
  BACKEND_PYTHON="${PYTHON:-python3}"
fi

REQUESTED_BACKEND_PORT="${SATO_BACKEND_PORT:-${PORT:-5000}}"
REQUESTED_FRONTEND_PORT="${SATO_FRONTEND_PORT:-5173}"
BACKEND_PORT="$(pick_available_port "$REQUESTED_BACKEND_PORT")"
FRONTEND_PORT="$(pick_available_port "$REQUESTED_FRONTEND_PORT")"
BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"
FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT"
SPOTIFY_REDIRECT_URI_VALUE="${SPOTIFY_REDIRECT_URI:-$BACKEND_URL/api/auth/callback}"
CLIENT_APP_URL_VALUE="${CLIENT_APP_URL:-$FRONTEND_URL}"

if [[ "$BACKEND_PORT" != "$REQUESTED_BACKEND_PORT" ]]; then
  echo "Backend port $REQUESTED_BACKEND_PORT is busy. Using $BACKEND_PORT instead."
  echo "Spotify OAuth note: add this exact Redirect URI in the Spotify Developer Dashboard before signing in: $SPOTIFY_REDIRECT_URI_VALUE"
fi

if [[ "$FRONTEND_PORT" != "$REQUESTED_FRONTEND_PORT" ]]; then
  echo "Frontend port $REQUESTED_FRONTEND_PORT is busy. Using $FRONTEND_PORT instead."
fi

echo "Starting backend with $BACKEND_PYTHON"
(
  cd "$BACKEND_DIR"
  export HOST="127.0.0.1"
  export PORT="$BACKEND_PORT"
  export SATO_BACKEND_PORT="$BACKEND_PORT"
  export SATO_USE_RELOADER="${SATO_USE_RELOADER:-0}"
  export CLIENT_APP_URL="$CLIENT_APP_URL_VALUE"
  export SPOTIFY_REDIRECT_URI="$SPOTIFY_REDIRECT_URI_VALUE"
  exec "$BACKEND_PYTHON" app.py
) &
BACKEND_PID=$!

sleep 1

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend failed to start." >&2
  wait "$BACKEND_PID"
fi

echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo "Spotify redirect URI for local development: $SPOTIFY_REDIRECT_URI_VALUE"
echo "Spotify app credentials can be pasted into the web UI, or supplied via env vars if you prefer."
echo "Starting frontend with npm run dev"
cd "$FRONTEND_DIR"
env \
  VITE_API_PROXY_TARGET="$BACKEND_URL" \
  npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
