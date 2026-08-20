#!/usr/bin/env bash
# OpenSHSID - production backend only (no React dev server).
# Start: Django WSGI (:19424) + Flask model service (:5000), both via gunicorn.
# Intended for reverse-proxy deployment (nginx upstreams / frontend_serve).

set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
ENV_FILE="$ROOT/.env.local"

cd "$ROOT"

flask_pid=""
django_pid=""

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    echo
    echo "Stopping backend services..."
    for pid in "$django_pid" "$flask_pid"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done

    exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "=== OpenSHSID Production Backend Starting... ==="
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
gunicorn_model_cmd=(gunicorn --workers 1 --bind 0.0.0.0:5000 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - app:app)

echo "[Flask]   Starting gunicorn on :5000..."
(
    cd "$ROOT/model"
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

echo
echo "Django  http://localhost:19424"
echo "Flask   http://localhost:5000"
echo
echo "Production backend is running. Press Ctrl+C to stop."

wait "$django_pid"
