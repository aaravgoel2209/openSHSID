#!/bin/bash
# SHSID campus - start all services

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== SHSID Campus ==="
echo ""

# 1. Flask model service (port 5000)
echo "[Flask]  Starting..."
cd "$ROOT/model"
python -m flask run --port 5000 &
FLASK_PID=$!
echo "[Flask]  PID=$FLASK_PID"

sleep 2

# 2. Django API (port 8000)
echo "[Django] Starting..."
cd "$ROOT"
python manage.py runserver 8000 &
DJANGO_PID=$!
echo "[Django] PID=$DJANGO_PID"

sleep 2

# 3. React frontend (port 5173)
echo "[React]  Starting..."
cd "$ROOT/frontend"
npm run dev &
REACT_PID=$!
echo "[React]  PID=$REACT_PID"

echo ""
echo "Django  http://localhost:8000"
echo "Flask   http://localhost:5000"
echo "React   http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all"

trap "kill $FLASK_PID $DJANGO_PID $REACT_PID 2>/dev/null; exit" SIGINT SIGTERM

wait
