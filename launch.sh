#!/usr/bin/env bash
#
# IC — Internal Cheatsheet launcher.
# Installs dependencies if needed, builds the production bundle, and serves it.
#
# Usage:
#   ./launch.sh            # build + serve prod on http://localhost:5173
#   ./launch.sh --dev      # dev server with hot reload
#   PORT=8080 ./launch.sh  # serve on a different port
#
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-5173}"

# --- prerequisites -----------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "[IC] node is not installed — install Node.js 18+ first (https://nodejs.org)." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[IC] npm is not installed — it ships with Node.js." >&2
  exit 1
fi

# --- dependencies (only when missing or stale) -------------------------------
if [ ! -d node_modules ]; then
  echo "[IC] Installing dependencies…"
  npm install
elif [ package-lock.json -nt node_modules ]; then
  echo "[IC] Lockfile changed — refreshing dependencies…"
  npm install
fi

# --- dev mode ----------------------------------------------------------------
if [ "${1:-}" = "--dev" ]; then
  echo "[IC] Starting dev server on http://localhost:${PORT} (hot reload)…"
  exec npm run dev -- --port "${PORT}"
fi

# --- prod: build + serve -----------------------------------------------------
echo "[IC] Building production bundle…"
npm run build

echo "[IC] Serving IC on http://localhost:${PORT}  (Ctrl-C to stop)"
exec npm run preview -- --port "${PORT}"
