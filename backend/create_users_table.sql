-- ============================================================
-- Users Table for Cotelligent HRMS
-- Run this in pgAdmin Query Tool on: cotelligent_hrms database
-- ============================================================

-- Step 1: Create the role enum (super_admin + admin + existing roles)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_system_role') THEN
        CREATE TYPE user_system_role AS ENUM (
            'super_admin',
            'admin',
            'hr_manager',
            'manager',
            'employee'
        );
    END IF;
END$$;

-- Step 2: Create the users table
CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    employee_id         INTEGER UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    employee_code       VARCHAR(50),                        -- e.g. "EMP001"
    full_name           VARCHAR(200)    NOT NULL,
    email               VARCHAR(255)    UNIQUE NOT NULL,
    role                user_system_role NOT NULL DEFAULT 'employee',
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login          TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active   ON users(is_active);

-- Step 4: Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- ============================================================
-- Step 5: Seed from existing employees (inherits their role)
--         Employees with role 'admin' are kept as 'admin'.
--         All others default to their current role.
--         super_admin must be assigned manually below.
-- ============================================================
INSERT INTO users (employee_id, employee_code, full_name, email, role, is_active, created_at)
SELECT
    e.id,
    e.employee_id,
    e.first_name || ' ' || e.last_name,
    e.email,
    CASE e.role::text
        WHEN 'admin'      THEN 'admin'::user_system_role
        WHEN 'hr_manager' THEN 'hr_manager'::user_system_role
        WHEN 'manager'    THEN 'manager'::user_system_role
        ELSE                   'employee'::user_system_role
    END,
    CASE WHEN e.status::text = 'terminated' THEN FALSE ELSE TRUE END,
    e.created_at
FROM employees e
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Verify
-- ============================================================
SELECT id, employee_code, full_name, email, role, is_active
FROM   users
ORDER  BY role, full_name;
