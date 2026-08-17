#!/usr/bin/env bash
# OpenSHSID - start all development services

set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
ENV_FILE="$ROOT/.env.local"

cd "$ROOT"

flask_pid=""
django_pid=""
react_pid=""

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    echo
    echo "Stopping services..."
    for pid in "$react_pid" "$django_pid" "$flask_pid"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done

    exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "=== SHSID Campus Starting... ==="
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

echo "[Flask]  Starting..."
(
    cd "$ROOT"
    exec "$PYTHON" model/app.py
) &
flask_pid=$!

echo "[Django] Running migrations..."
"$PYTHON" manage.py migrate
echo "[Django] Migrations done."
echo

echo "[Django] Starting..."
(
    cd "$ROOT"
    exec "$PYTHON" manage.py runserver 0.0.0.0:19424
) &
django_pid=$!

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
            echo "[$name]  ready."
            return 0
        fi
        tries=$((tries + 1))
        sleep 2
    done

    echo "[$name]  not ready after ~60s, starting React anyway."
}

wait_for_port "Flask" 5000
wait_for_port "Django" 19424

echo "[React]   Starting..."
(
    cd "$ROOT/frontend"
    exec npm run dev
) &
react_pid=$!

echo
echo "Django  http://localhost:19424"
echo "Flask   http://localhost:5000"
echo "React   http://localhost:5173"
echo
echo "Press Ctrl+C to stop all services."

# Keep this launcher alive until the frontend process exits.
wait "$react_pid"
