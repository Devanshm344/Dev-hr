-- ============================================================
-- RBAC ROLLBACK – Reverting REVERT_RBAC_CHANGES
-- Restores state prior to rbac_migration.sql
-- Run against: cotelligent-hrms (auth DB)
-- ============================================================

-- 1. Drop trigger and function
DROP TRIGGER  IF EXISTS user_roles_updated_at ON user_roles;
DROP FUNCTION IF EXISTS update_user_roles_updated_at();

-- 2. Drop indexes
DROP INDEX IF EXISTS idx_user_roles_email;
DROP INDEX IF EXISTS idx_user_roles_role;

-- 3. Drop user_roles table (removes all RBAC data)
DROP TABLE IF EXISTS user_roles;

-- 4. Restore pre-RBAC Employee.role values
--    Re-assign hr_manager role to users who had it before.
--    Adjust the WHERE clause to match your actual pre-RBAC state.
--    The employee IDs below are the ones that were hr_manager in assign_user_roles.sql.
-- UPDATE employees SET role = 'hr_manager'
-- WHERE employee_id IN ('323', '77');   -- example: adjust as needed

-- 5. Restore manager roles if needed
-- UPDATE employees SET role = 'manager'
-- WHERE employee_id IN ('294', '272');  -- example: adjust as needed

-- ============================================================
-- Frontend rollback steps (perform manually):
--   1. Revert App.jsx – remove AdminRoute from employees/payroll routes
--   2. Revert Layout.jsx – restore original navItems (remove adminOnly flags)
--   3. Revert authStore.js – remove normalizeRole()
--   4. Revert all pages – change user?.role === 'Admin'
--                         back to ['admin','hr_manager'].includes(user?.role)
--   5. Delete frontend/src/rbac/constants.js
-- ============================================================
-- Git-based rollback (fastest):
--   git diff HEAD~1 --stat       # see what changed
--   git revert <rbac-commit-hash>
-- ============================================================
