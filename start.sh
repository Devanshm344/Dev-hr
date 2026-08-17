#!/bin/bash

# ============================================================
#   Cotelligent HRMS - Start Script
# ============================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  Starting Cotelligent HRMS..."
echo -e "${NC}"

# Kill existing processes on ports
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8010 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true

# Start Backend
echo -e "${BLUE}▶ Starting FastAPI backend on http://localhost:8001${NC}"
cd backend
source venv/bin/activate 2>/dev/null || true
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd ..

# Start Alumni Network backend (separate app, own DB — see alumni-network/README.md)
echo -e "${BLUE}▶ Starting Alumni Network backend on http://localhost:8010${NC}"
cd alumni-network/backend
source venv/bin/activate 2>/dev/null || true
uvicorn main:app --reload --host 0.0.0.0 --port 8010 &
ALUMNI_BACKEND_PID=$!
cd ../..

sleep 2

# Start Frontend
echo -e "${BLUE}▶ Starting React frontend on http://localhost:3000${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Start Alumni Network frontend
echo -e "${BLUE}▶ Starting Alumni Network frontend on http://localhost:5174${NC}"
cd alumni-network/frontend
npm run dev &
ALUMNI_FRONTEND_PID=$!
cd ../..

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗"
echo "║   🚀  Cotelligent HRMS is Running!           ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║                                               ║"
echo "║  🌐 Frontend:  http://localhost:3000          ║"
echo "║  📡 Backend:   http://localhost:8001          ║"
echo "║  📚 API Docs:  http://localhost:8001/docs     ║"
echo "║                                               ║"
echo "║  🎓 Alumni Frontend: http://localhost:5174    ║"
echo "║  📡 Alumni Backend:  http://localhost:8010    ║"
echo "║  📚 Alumni API Docs: http://localhost:8010/docs║"
echo "║  (Linked from the \"Alumni\" tile on /modules)  ║"
echo "║                                               ║"
echo "║  Press Ctrl+C to stop                        ║"
echo -e "╚═══════════════════════════════════════════════╝${NC}"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID $ALUMNI_BACKEND_PID $ALUMNI_FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT
wait
