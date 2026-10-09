#!/usr/bin/env bash
# Rebuilds the README screenshots from scratch: fake photos -> docker stack (this checkout
# + a mock Immich) -> browser capture -> README regeneration -> teardown.
# Usage: tools/screenshots/run.sh [feature-id]    (needs docker, node, python3 + Pillow)
set -euo pipefail
cd "$(dirname "$0")"
export SCREENSHOT_PORT="${SCREENSHOT_PORT:-18080}"
COMPOSE=(docker compose -f docker-compose.yml)

python3 -I gen-images.py
[ -d node_modules ] || npm ci
# Playwright's own browser, unless CHROMIUM_PATH points at one you already have.
[ -n "${CHROMIUM_PATH:-}" ] || npx playwright-core install chromium

trap '"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1' EXIT
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true   # always start from a fresh settings DB
"${COMPOSE[@]}" up -d --build

echo "Waiting for ImmichFrame on :$SCREENSHOT_PORT ..."
for _ in $(seq 1 60); do
	curl -fs "http://127.0.0.1:$SCREENSHOT_PORT/api/Admin/Status" >/dev/null && break
	sleep 1
done

node capture.mjs "$@"
# A full run also refreshes the README; a single-feature run only re-captures.
[ $# -gt 0 ] || node build-readme.mjs
