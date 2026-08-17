-- RBAC admin roster migration
-- Sets the canonical Admin/Super Admin roster in the authoritative `user_roles`
-- table, and syncs the legacy `employees.role` column (display/backward-compat
-- only — access control always reads user_roles, see app/core/security.py
-- get_effective_role()).
--
-- Canonical roster (9 named users):
--   Super Admin : Lakshminarayana Telagamsetty (9)
--   Admin       : Sridhar Iriventi (100311), Lavanya Pedinenikalva (323),
--                 Ameer Mohammed (5), Yalamanchili Padma Sai (599),
--                 Kamal Manohar Senagapati (77), Sudhir Gumte (3),
--                 Shaik Shajahan Shama (466), Srikiran Patibandla (100001)
--   Kept as-is  : T00002 (HR Communications, shared mailbox) stays Admin
--                 per explicit decision — not part of the named roster but
--                 not being revoked.
-- Everyone else defaults to Employee (no user_roles row = Employee).

BEGIN;

-- 1. Upsert user_roles for the 9 named users.
INSERT INTO user_roles (employee_id, email, role) VALUES
    ('100311', 'sridhar.iriventi@techdemocracy.com',      'Admin'),
    ('323',    'lavanya.pedinenikalva@techdemocracy.com', 'Admin'),
    ('5',      'mohammad.ameer@techdemocracy.com',        'Admin'),
    ('599',    'sai.yalamanchili@techdemocracy.com',      'Admin'),
    ('77',     'kamal.senagapati@techdemocracy.com',      'Admin'),
    ('9',      'lakshmi.narayana@techdemocracy.com',      'Super Admin'),
    ('3',      'sudhir.gumte@techdemocracy.com',          'Admin'),
    ('466',    'shama.shaik@techdemocracy.com',           'Admin'),
    ('100001', 'sri.patibandla@techdemocracy.com',        'Admin')
ON CONFLICT (employee_id) DO UPDATE
    SET role  = EXCLUDED.role,
        email = EXCLUDED.email,
        updated_at = now();

-- 2. Sync legacy employees.role for the 9 named users to 'admin'
--    (RoleEnum has no 'super_admin' value; legacy col only distinguishes
--    admin vs employee and is not used for access decisions).
UPDATE employees
SET role = 'admin'
WHERE employee_id IN ('100311','323','5','599','77','9','3','466','100001')
  AND role <> 'admin';

-- 3. Demote every other employee's legacy role to 'employee' so the legacy
--    column stops disagreeing with the RBAC roster. T00002 is intentionally
--    excluded (kept Admin per decision).
UPDATE employees
SET role = 'employee'
WHERE employee_id NOT IN ('100311','323','5','599','77','9','3','466','100001','T00002')
  AND role <> 'employee';

COMMIT;

-- Verification
SELECT employee_id, email, role, updated_at FROM user_roles ORDER BY employee_id;
SELECT role, count(*) FROM employees GROUP BY role;
