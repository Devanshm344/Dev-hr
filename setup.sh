#!/bin/bash

# ============================================================
#   Cotelligent HRMS - One-Click Setup Script
# ============================================================

set -e
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}▶ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║    Cotelligent HRMS Setup Wizard      ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Check PostgreSQL ──────────────────────────────
print_step "Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
  print_error "PostgreSQL not found. Please install PostgreSQL first."
  echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
  echo "  macOS:         brew install postgresql"
  exit 1
fi
print_success "PostgreSQL found"

# ── Step 2: Create Database ───────────────────────────────
print_step "Setting up database..."
read -p "  PostgreSQL username [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "  PostgreSQL password: " DB_PASS
echo ""
read -p "  Database name [cotelligent_hrms]: " DB_NAME
DB_NAME=${DB_NAME:-cotelligent_hrms}

# Update .env
cd backend
cat > .env << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SECRET_KEY=cotelligent-super-secret-key-change-in-production-$(date +%s)
DEBUG=True
UPLOAD_DIR=uploads
EOF

# Create DB if not exists
PGPASSWORD=$DB_PASS psql -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  PGPASSWORD=$DB_PASS psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
print_success "Database '$DB_NAME' ready"

# ── Step 3: Backend Setup ────────────────────────────────
print_step "Setting up Python backend..."
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
print_success "Python dependencies installed"

# ── Step 4: Seed Database ────────────────────────────────
print_step "Seeding database with initial data..."
python seed.py
print_success "Database seeded"

cd ..

# ── Step 5: Frontend Setup ───────────────────────────────
print_step "Setting up React frontend..."
cd frontend
if command -v npm &> /dev/null; then
  npm install --silent
  print_success "Node dependencies installed"
else
  print_error "Node.js/npm not found. Please install Node.js 18+"
  exit 1
fi
cd ..

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗"
echo "║   ✅  Setup Complete!                       ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  To start the app, run: ./start.sh           ║"
echo "║                                              ║"
echo "║  Login credentials:                          ║"
echo "║  Admin:   admin@cotelligent.com / Admin@123  ║"
echo "║  HR Mgr:  hr@cotelligent.com / Hr@12345      ║"
echo "║  Emp:     rahul@cotelligent.com / Welcome@123║"
echo "║                                              ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
