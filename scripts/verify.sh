#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/sato-app"

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

REQUESTED_E2E_BACKEND_PORT="${SATO_E2E_BACKEND_PORT:-5001}"
REQUESTED_E2E_FRONTEND_PORT="${SATO_E2E_FRONTEND_PORT:-41731}"
E2E_BACKEND_PORT="$(pick_available_port "$REQUESTED_E2E_BACKEND_PORT")"
E2E_FRONTEND_PORT="$(pick_available_port "$REQUESTED_E2E_FRONTEND_PORT")"
E2E_BACKEND_URL="http://127.0.0.1:$E2E_BACKEND_PORT"
E2E_APP_URL="http://127.0.0.1:$E2E_FRONTEND_PORT"

if [[ "$E2E_BACKEND_PORT" != "$REQUESTED_E2E_BACKEND_PORT" ]]; then
  echo "E2E backend port $REQUESTED_E2E_BACKEND_PORT is busy. Using $E2E_BACKEND_PORT instead."
fi

if [[ "$E2E_FRONTEND_PORT" != "$REQUESTED_E2E_FRONTEND_PORT" ]]; then
  echo "E2E frontend port $REQUESTED_E2E_FRONTEND_PORT is busy. Using $E2E_FRONTEND_PORT instead."
fi

run_step() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  "$@"
}

run_step \
  "Python syntax check" \
  "$BACKEND_PYTHON" -m py_compile \
  "$BACKEND_DIR/app.py" \
  "$BACKEND_DIR/blend_service.py" \
  "$BACKEND_DIR/spotify_client.py" \
  "$BACKEND_DIR/room_store.py" \
  "$BACKEND_DIR/debug_tools.py" \
  "$BACKEND_DIR/e2e_support.py" \
  "$BACKEND_DIR/tests/test_api.py" \
  "$BACKEND_DIR/tests/test_spotify_client.py"

run_step \
  "Backend test suite" \
  "$BACKEND_PYTHON" -m pytest \
  "$BACKEND_DIR/tests/test_api.py" \
  "$BACKEND_DIR/tests/test_spotify_client.py"

run_step \
  "Frontend unit tests" \
  npm --prefix "$FRONTEND_DIR" test -- --run

run_step \
  "Frontend build" \
  npm --prefix "$FRONTEND_DIR" run build

run_step \
  "Browser end-to-end tests" \
  env \
  SATO_E2E_BACKEND_PORT="$E2E_BACKEND_PORT" \
  SATO_E2E_FRONTEND_PORT="$E2E_FRONTEND_PORT" \
  SATO_E2E_BACKEND_URL="$E2E_BACKEND_URL" \
  SATO_E2E_APP_URL="$E2E_APP_URL" \
  SATO_E2E_BACKEND_PYTHON="$BACKEND_PYTHON" \
  npm --prefix "$FRONTEND_DIR" run test:e2e

echo
echo "All Sato verification checks passed."
