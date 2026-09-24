#!/usr/bin/env bash
#
# IC — Internal Cheatsheet launcher.
# Installs dependencies if needed, builds the production bundle, and serves it.
#
# Usage:
#   ./launch.sh                    # build + serve prod on http://localhost:5173
#   ./launch.sh --dev              # dev server with hot reload
#   PORT=8080 ./launch.sh          # different port
#   HOST=0.0.0.0 ./launch.sh       # listen on all interfaces (reachable on the LAN)
#   HOST=10.10.14.5 ./launch.sh    # bind a specific IP
#
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-5173}"
HOST="${HOST:-}"

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

# --- host binding ------------------------------------------------------------
HOST_ARGS=()
DISPLAY_HOST="localhost"
if [ -n "$HOST" ]; then
  HOST_ARGS=(--host "$HOST")
  # for the printed URL, 0.0.0.0 isn't browsable — point at localhost instead
  if [ "$HOST" = "0.0.0.0" ] || [ "$HOST" = "::" ]; then
    DISPLAY_HOST="localhost"
  else
    DISPLAY_HOST="$HOST"
  fi
  echo "[IC] ⚠ Binding ${HOST}:${PORT} — the cheat sheet will be reachable by other"
  echo "     machines on the network. Only do this on a trusted/engagement network."
fi

# --- dev mode ----------------------------------------------------------------
if [ "${1:-}" = "--dev" ]; then
  echo "[IC] Starting dev server on http://${DISPLAY_HOST}:${PORT} (hot reload)…"
  exec npm run dev -- --port "${PORT}" ${HOST_ARGS[@]+"${HOST_ARGS[@]}"}
fi

# --- prod: build + serve -----------------------------------------------------
echo "[IC] Building production bundle…"
npm run build

echo "[IC] Serving IC on http://${DISPLAY_HOST}:${PORT}  (Ctrl-C to stop)"
exec npm run preview -- --port "${PORT}" ${HOST_ARGS[@]+"${HOST_ARGS[@]}"}
