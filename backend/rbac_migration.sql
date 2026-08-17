-- ============================================================
-- RBAC MIGRATION – Employee ID → Role Mapping
-- Run against: cotelligent-hrms (auth DB)
-- Author: RBAC Refactor (2026-06-02)
-- Rollback: rbac_rollback.sql
-- ============================================================

-- 1. Create user_roles table (single source of truth for access control)
CREATE TABLE IF NOT EXISTS user_roles (
    employee_id  VARCHAR(50)  PRIMARY KEY,
    email        VARCHAR(255),
    role         VARCHAR(20)  NOT NULL DEFAULT 'Employee',
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_roles_updated_at ON user_roles;
CREATE TRIGGER user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_roles_updated_at();

-- 3. Index for fast email lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_role  ON user_roles(role);

-- 4. Seed Admin users
--    Only these 7 employee IDs receive Admin access.
--    ALL other employees default to role='Employee' (no row needed).
INSERT INTO user_roles (employee_id, email, role)
VALUES
    ('100311', 'sridhar.iriventi@techdemocracy.com',    'Admin'),
    ('599',    'sai.yalamanchili@techdemocracy.com',     'Admin'),
    ('323',    'lavanya.pedinenikalva@techdemocracy.com','Admin'),
    ('77',     'kamal.senagapati@techdemocracy.com',     'Admin'),
    ('9',      'lakshmi.narayana@techdemocracy.com',     'Admin'),
    ('5',      'mohammad.ameer@techdemocracy.com',       'Admin'),
    ('T00002', 'hr.communications@techdemocracy.com',    'Admin')
ON CONFLICT (employee_id) DO UPDATE SET
    email      = EXCLUDED.email,
    role       = EXCLUDED.role,
    updated_at = NOW();

-- 5. Sync Employee.role for the 7 Admin employees (backward-compat)
--    Sets employees.role = 'admin' where user_roles.role = 'Admin'.
UPDATE employees e
SET    role = 'admin'
FROM   user_roles ur
WHERE  ur.employee_id = e.employee_id
  AND  ur.role = 'Admin';

-- Done.
-- Access logic: look up user_roles by employee_id.
-- If no row exists → default role = 'Employee'.
-- Only 'Admin' role bypasses get_current_admin guard.
