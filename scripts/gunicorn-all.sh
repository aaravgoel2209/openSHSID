#!/usr/bin/env bash
# OpenSHSID - production all-in-one (backend + SPA static serve).
# Start: Django WSGI (:19424) + Flask (:5000) via gunicorn + React SPA static server (:5173).
# For small self-hosted deployments without nginx.
# The SPA is served from frontend/dist (run `npm run build` in frontend/ first).

set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
ENV_FILE="$ROOT/.env.local"

cd "$ROOT"

flask_pid=""
django_pid=""
spa_pid=""

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    echo
    echo "Stopping services..."
    for pid in "$spa_pid" "$django_pid" "$flask_pid"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done

    exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "=== OpenSHSID Production All-in-One Starting... ==="
echo

# Keep the session secret out of the repository. The generated file is gitignored.
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[Setup]  Generating REI_SESSION_SECRET -> .env.local"
    "$PYTHON" -c "import secrets; print('REI_SESSION_SECRET=' + secrets.token_urlsafe(48))" > "$ENV_FILE"
fi

# Export entries from the local dotenv-style file for both backends.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Create or add missing config keys without overwriting local values.
"$PYTHON" scripts/ensure_config.py

gunicorn_cmd=(gunicorn --workers 2 --bind 0.0.0.0:19424 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - OpenSHSID_backend.wsgi:application)
gunicorn_model_cmd=(gunicorn --workers 1 --bind 0.0.0.0:5000 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - model.app:app)

echo "[Flask]   Starting gunicorn on :5000..."
(
    cd "$ROOT"
    exec "${gunicorn_model_cmd[@]}"
) &
flask_pid=$!

echo "[Django]  Running migrations..."
"$PYTHON" manage.py migrate

echo "[Django]  Starting gunicorn on :19424..."
(
    cd "$ROOT"
    exec "${gunicorn_cmd[@]}"
) &
django_pid=$!

# FAKE_SPA: this is a minimal static file server for demo purposes only.
# `python -m http.server` has no SPA fallback, no compression, no caching
# headers and is single-threaded — fine for a small self-hosted demo, but a
# real CDN / nginx frontend_serve is better for production.
echo "[SPA]     Serving frontend/dist on :5173 (python http.server)..."
(
    cd "$ROOT"
    exec "$PYTHON" -m http.server 5173 --directory frontend/dist
) &
spa_pid=$!

wait_for_port() {
    local name="$1"
    local port="$2"
    local tries=0

    while (( tries < 30 )); do
        if "$PYTHON" - "$port" <<'PY' >/dev/null 2>&1
import socket
import sys

with socket.create_connection(("127.0.0.1", int(sys.argv[1])), timeout=1):
    pass
PY
        then
            echo "[$name]   ready."
            return 0
        fi
        tries=$((tries + 1))
        sleep 2
    done

    echo "[$name]   not ready after ~60s."
}

wait_for_port "Flask" 5000
wait_for_port "Django" 19424
wait_for_port "SPA" 5173

echo
echo "Django  http://localhost:19424"
echo "Flask   http://localhost:5000"
echo "SPA     http://localhost:5173"
echo
echo "Press Ctrl+C to stop all services."

# Keep this launcher alive until the SPA process exits.
wait "$spa_pid"
