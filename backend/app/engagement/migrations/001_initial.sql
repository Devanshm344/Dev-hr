-- 001_initial.sql — EM demo foundation
-- Tables: organization_settings, clients, projects, project_members, tasks,
--         timesheets, time_entries
--
-- Identity is NOT owned by this app: this deployment integrates directly with
-- the existing dev-hr database's `employees` table (INTEGER PK) for who a
-- person is, `departments` for their department, and `user_roles` (plus
-- manager hierarchy) for their system role. No local users/roles tables are
-- created here — every "who did this" column below is an INTEGER FK straight
-- into employees(id).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organization_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name          TEXT NOT NULL,
    default_currency      TEXT NOT NULL DEFAULT 'INR',
    timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    standard_daily_hours  NUMERIC(4,2) NOT NULL DEFAULT 8,
    standard_weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 40,
    week_start_day        TEXT NOT NULL DEFAULT 'monday'
                          CHECK (week_start_day IN ('monday','sunday')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_code   TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    currency      TEXT NOT NULL DEFAULT 'INR',
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','archived')),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code       TEXT NOT NULL UNIQUE,
    name               TEXT NOT NULL,
    client_id          UUID NOT NULL REFERENCES clients(id),
    description        TEXT,
    project_manager_id INTEGER REFERENCES employees(id),
    start_date         DATE,
    end_date           DATE,
    status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('draft','active','on_hold','completed','cancelled','archived')),
    billing_model      TEXT NOT NULL DEFAULT 'time_and_materials'
                       CHECK (billing_model IN ('time_and_materials','fixed_fee','non_billable')),
    currency           TEXT NOT NULL DEFAULT 'INR',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

CREATE TABLE IF NOT EXISTS project_members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects(id),
    user_id      INTEGER NOT NULL REFERENCES employees(id),
    project_role TEXT NOT NULL DEFAULT 'member',
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one active membership per user per project; history rows may repeat
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_active_unique
    ON project_members (project_id, user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members (user_id) WHERE active = true;

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    name            TEXT NOT NULL,
    description     TEXT,
    assigned_to     INTEGER REFERENCES employees(id),
    status          TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','blocked','completed','cancelled')),
    priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high')),
    billable        BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);

CREATE TABLE IF NOT EXISTS timesheets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          INTEGER NOT NULL REFERENCES employees(id),
    week_start_date  DATE NOT NULL,
    week_end_date    DATE NOT NULL,
    total_minutes    INTEGER NOT NULL DEFAULT 0 CHECK (total_minutes >= 0),
    billable_minutes INTEGER NOT NULL DEFAULT 0 CHECK (billable_minutes >= 0),
    status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','approved','changes_requested')),
    submitted_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start_date)
);
CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets (user_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets (status);

CREATE TABLE IF NOT EXISTS time_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id     UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL REFERENCES employees(id),
    work_date        DATE NOT NULL,
    project_id       UUID NOT NULL REFERENCES projects(id),
    task_id          UUID REFERENCES tasks(id),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
    description      TEXT,
    billable         BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one cell per grid row per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_cell_unique
    ON time_entries (timesheet_id, project_id, coalesce(task_id,'00000000-0000-0000-0000-000000000000'::uuid), work_date);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON time_entries (user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries (project_id);

COMMIT;
