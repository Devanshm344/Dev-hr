-- ============================================================
-- Assign Roles to Specific Users in cotelligent_hrms
-- Run in pgAdmin Query Tool
-- ============================================================

-- STEP 1: Verify employees exist (run this first to confirm)
-- ============================================================
SELECT
    e.id            AS db_id,
    e.employee_id   AS employee_code,
    e.first_name || ' ' || e.last_name AS full_name,
    e.email,
    e.role          AS current_employee_role,
    u.role          AS current_users_role
FROM employees e
LEFT JOIN users u ON u.employee_id = e.id
WHERE e.employee_id IN ('599', '100311', '9', '294', '272', '597')
ORDER BY e.employee_id;


-- ============================================================
-- STEP 2: UPSERT all 6 users with correct roles + password
--         (Inserts if missing, updates if already seeded)
-- ============================================================

INSERT INTO users (employee_id, employee_code, full_name, email, hashed_password, role, is_active)
SELECT
    e.id,
    e.employee_id,
    e.first_name || ' ' || e.last_name,
    e.email,
    crypt('Admin@123', gen_salt('bf', 12)),
    v.assigned_role::user_system_role,
    TRUE
FROM employees e
JOIN (VALUES
    ('599',    'admin'::text),
    ('100311', 'admin'),
    ('9',      'super_admin'),
    ('294',    'manager'),
    ('272',    'manager'),
    ('597',    'employee')
) AS v(emp_code, assigned_role)
  ON e.employee_id = v.emp_code
ON CONFLICT (employee_id)
DO UPDATE SET
    role            = EXCLUDED.role,
    hashed_password = EXCLUDED.hashed_password,
    is_active       = TRUE,
    updated_at      = NOW();

-- Also sync email conflict (in case row exists by email but not employee_id FK)
INSERT INTO users (employee_id, employee_code, full_name, email, hashed_password, role, is_active)
SELECT
    e.id,
    e.employee_id,
    e.first_name || ' ' || e.last_name,
    e.email,
    crypt('Admin@123', gen_salt('bf', 12)),
    v.assigned_role::user_system_role,
    TRUE
FROM employees e
JOIN (VALUES
    ('599',    'admin'::text),
    ('100311', 'admin'),
    ('9',      'super_admin'),
    ('294',    'manager'),
    ('272',    'manager'),
    ('597',    'employee')
) AS v(emp_code, assigned_role)
  ON e.employee_id = v.emp_code
ON CONFLICT (email)
DO UPDATE SET
    role            = EXCLUDED.role,
    hashed_password = EXCLUDED.hashed_password,
    employee_id     = EXCLUDED.employee_id,
    employee_code   = EXCLUDED.employee_code,
    is_active       = TRUE,
    updated_at      = NOW();


-- ============================================================
-- STEP 3: Confirm the final state
-- ============================================================
SELECT
    u.id,
    u.employee_code,
    u.full_name,
    u.email,
    u.role,
    u.is_active,
    CASE WHEN u.hashed_password IS NOT NULL THEN 'Admin@123 (set)' ELSE 'MISSING' END AS password
FROM users u
WHERE u.employee_code IN ('599', '100311', '9', '294', '272', '597')
ORDER BY
    CASE u.role
        WHEN 'super_admin' THEN 1
        WHEN 'admin'       THEN 2
        WHEN 'manager'     THEN 3
        WHEN 'hr_manager'  THEN 4
        ELSE 5
    END,
    u.full_name;
