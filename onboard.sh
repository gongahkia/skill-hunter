#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

WITH_BUILD=0

usage() {
  cat <<'EOF'
Skill Hunter onboarding script

Usage:
  ./onboard.sh [--build] [--help]

Options:
  --build   Run project builds after dependency installation.
  --help    Show this help message.
EOF
}

log() {
  printf "\n[onboard] %s\n" "$*"
}

run_cmd() {
  log "$*"
  "$@"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Missing required command: $cmd"
    exit 1
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  if command -v corepack >/dev/null 2>&1; then
    log "pnpm not found. Attempting setup via corepack."
    run_cmd corepack enable
    run_cmd corepack prepare pnpm@9.12.3 --activate
  fi

  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  log "pnpm still not found. Attempting install via npm."
  run_cmd npm install -g pnpm

  if ! command -v pnpm >/dev/null 2>&1; then
    log "Failed to install pnpm automatically. Install pnpm manually and rerun ./onboard.sh."
    exit 1
  fi
}

install_pnpm_project() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    log "Expected folder not found: $path"
    exit 1
  fi
  run_cmd pnpm -C "$path" install
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      WITH_BUILD=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      log "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

require_cmd node
require_cmd npm
ensure_pnpm

log "Installing lovely-ghostwriter dependencies (npm)."
run_cmd npm --prefix "$ROOT_DIR/lovely-ghostwriter" install

log "Installing pnpm dependencies across monorepo projects."
PNPM_PATHS=(
  "double-face"
  "convert-hands/api"
  "convert-hands/web"
  "convert-hands/worker-export"
  "order-stamp/api"
  "order-stamp/worker-detection"
  "sun-and-moon/api"
  "sun-and-moon/web"
  "sun-and-moon/worker-timeline"
  "fun-fun-cloth/api"
  "fun-fun-cloth/web"
  "fun-fun-cloth/worker-compiler"
)

for project_path in "${PNPM_PATHS[@]}"; do
  install_pnpm_project "$project_path"
done

if [[ "$WITH_BUILD" -eq 1 ]]; then
  log "Running builds."
  run_cmd npm --prefix "$ROOT_DIR/lovely-ghostwriter" run build
  run_cmd pnpm -C "double-face" build
  run_cmd pnpm -C "convert-hands" build
  run_cmd pnpm -C "order-stamp" build
  run_cmd pnpm -C "sun-and-moon" build
  run_cmd pnpm -C "fun-fun-cloth" build
fi

cat <<'EOF'

[onboard] Setup complete.

Quick start:
  pnpm -C convert-hands dev:api
  pnpm -C order-stamp dev:api
  pnpm -C sun-and-moon dev:api
  pnpm -C fun-fun-cloth dev:api

Use --build if you also want build artifacts generated:
  ./onboard.sh --build
EOF
