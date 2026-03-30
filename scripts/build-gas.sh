#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
CORE="$ROOT/src/gas-core/core.gs"

for platform in docs sheets slides; do
  src="$ROOT/src/gas-core/${platform}.gs"
  dest="$ROOT/src/${platform}/Code.gs"
  cat "$CORE" "$src" > "$dest"
  echo "built $dest"
done
