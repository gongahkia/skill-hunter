#!/bin/bash
# Called by the Safari extension target on every Xcode build.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
: "${DERIVED_FILE_DIR:?Run this phase through Xcode or make safari-build}"
: "${TARGET_BUILD_DIR:?Missing Xcode target build directory}"
: "${UNLOCALIZED_RESOURCES_FOLDER_PATH:?Missing Xcode resources path}"
if ! command -v node >/dev/null || ! command -v npm >/dev/null || ! command -v python3 >/dev/null; then
    echo 'error: Node.js 22+, npm, and Python 3.9+ must be available in PATH when Xcode runs.' >&2
    exit 1
fi
if [ ! -d "$repo_root/node_modules" ]; then
    echo "error: Run npm ci in $repo_root before building the Safari app." >&2
    exit 1
fi
cd "$repo_root"
npm run build
python3 scripts/prepare_safari.py \
    --output "$DERIVED_FILE_DIR/SkillHunterWebExtension" \
    --bundle-resources "$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
