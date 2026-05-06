#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

echo "[1/4] Preparing backend environment..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$BACKEND_DIR/requirements.txt"

echo "[2/4] Preparing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

echo "[3/4] Starting backend on 0.0.0.0:8000..."
cd "$BACKEND_DIR"
nohup "$VENV_DIR/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 > "$ROOT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "[4/4] Starting frontend on 0.0.0.0:5173..."
cd "$FRONTEND_DIR"
npm run dev -- --host 0.0.0.0 > "$ROOT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Backend:  http://$(hostname -I | awk '{print $1}'):8000"
echo "Frontend: http://$(hostname -I | awk '{print $1}'):5173"
echo
echo "Logs:"
echo "  $ROOT_DIR/backend.log"
echo "  $ROOT_DIR/frontend.log"
echo
echo "Use 'kill $BACKEND_PID $FRONTEND_PID' to stop the demo."
