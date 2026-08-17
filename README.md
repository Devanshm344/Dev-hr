# 🏢 Cotelligent HRMS

A complete **Zoho People replacement** built for Cotelligent — a full-stack HR Management System with React JS frontend, FastAPI backend, and PostgreSQL database.

---

## 🌟 Features

| Module | Features |
|--------|----------|
| **Employee Management** | Add/Edit/View employees, employee profiles, org hierarchy |
| **Attendance** | Check-in/Check-out, daily records, monthly reports, work hours tracking |
| **Leave Management** | Apply leave, balance tracker, manager approvals, leave types |
| **Payroll** | Auto salary calculation, payslips, bulk generation, mark as paid |
| **Performance** | Review cycles, ratings, goals, strengths/improvements |
| **Documents** | Upload/manage HR documents per employee |
| **Departments** | Manage departments, assign heads |
| **Announcements** | Company-wide announcements with priority levels |
| **Role-Based Access** | Admin, HR Manager, Manager, Employee roles |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (pgAdmin compatible) |
| Auth | JWT (python-jose + bcrypt) |
| ORM | SQLAlchemy 2.0 + Alembic |
| State | Zustand |
| Charts | Recharts |

---

## 🚀 Quick Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Option 1 — Auto Setup
```bash
chmod +x setup.sh start.sh
./setup.sh
./start.sh
```

### Option 2 — Manual Setup

#### 1. PostgreSQL Database
```sql
-- In pgAdmin or psql:
CREATE DATABASE cotelligent_hrms;
```

#### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Edit .env with your DB credentials
cp .env.example .env
# Set: DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/cotelligent_hrms

# Run migrations & seed
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

#### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Access

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Main Application |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:8000/redoc | API ReDoc |

---

## 🔑 Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@cotelligent.com | Admin@123 |
| HR Manager | hr@cotelligent.com | Hr@12345 |
| Manager | rahul@cotelligent.com | Welcome@123 |
| Employee | ananya@cotelligent.com | Welcome@123 |

---

## 📁 Project Structure

```
cotelligent-hrms/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # All API endpoints
│   │   │   ├── auth.py
│   │   │   ├── employees.py
│   │   │   ├── attendance.py
│   │   │   ├── leave.py
│   │   │   ├── payroll.py
│   │   │   ├── performance.py
│   │   │   ├── documents.py
│   │   │   ├── departments.py
│   │   │   └── announcements.py
│   │   ├── core/
│   │   │   ├── config.py      # App configuration
│   │   │   └── security.py    # JWT + auth
│   │   ├── db/
│   │   │   └── database.py    # SQLAlchemy setup
│   │   ├── models/
│   │   │   └── base.py        # All DB models
│   │   └── main.py            # FastAPI app
│   ├── seed.py                # Database seeder
│   ├── requirements.txt
│   └── .env
│
└── frontend/
    └── src/
        ├── pages/             # All page components
        │   ├── LoginPage.jsx
        │   ├── Dashboard.jsx
        │   ├── EmployeesPage.jsx
        │   ├── EmployeeDetail.jsx
        │   ├── AttendancePage.jsx
        │   ├── LeavePage.jsx
        │   ├── PayrollPage.jsx
        │   ├── PerformancePage.jsx
        │   ├── DocumentsPage.jsx
        │   ├── DepartmentsPage.jsx
        │   ├── AnnouncementsPage.jsx
        │   └── ProfilePage.jsx
        ├── components/layout/ # Sidebar + Layout
        ├── services/api.js    # All API calls
        ├── store/authStore.js # Auth state (Zustand)
        └── App.jsx
```

---

## 🔒 Role Permissions

| Feature | Admin | HR Manager | Manager | Employee |
|---------|-------|-----------|---------|----------|
| View all employees | ✅ | ✅ | ✅ | ✅ |
| Add/Edit employees | ✅ | ✅ | ❌ | ❌ |
| View own attendance | ✅ | ✅ | ✅ | ✅ |
| Edit any attendance | ✅ | ✅ | ❌ | ❌ |
| Approve leaves | ✅ | ✅ | ✅ | ❌ |
| Generate payroll | ✅ | ✅ | ❌ | ❌ |
| View own payslip | ✅ | ✅ | ✅ | ✅ |
| Performance reviews | ✅ | ✅ | ✅ | View only |
| Manage departments | ✅ | ✅ | ❌ | ❌ |
| Post announcements | ✅ | ✅ | ❌ | ❌ |

---

## 🗄 pgAdmin Setup

1. Open pgAdmin → Add Server
2. Host: `localhost`, Port: `5432`
3. Database: `cotelligent_hrms`
4. Username: your postgres user

Key tables: `employees`, `departments`, `attendance`, `leave_requests`, `payslips`, `performance_reviews`, `documents`, `announcements`

---

## 🔧 Environment Variables (backend/.env)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/cotelligent_hrms
SECRET_KEY=your-secret-key-here
DEBUG=True
UPLOAD_DIR=uploads
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

Built with ❤️ for Cotelligent
