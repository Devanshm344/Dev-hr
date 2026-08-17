-- 009_remove_finance_role.sql — superseded: roles are no longer stored in a
-- local table at all (this deployment computes role from dev-hr's
-- user_roles table + manager hierarchy on employees, see app/deps.py), so
-- there is no local "finance role" to retire. Left as a no-op so migration
-- numbering stays intact.

BEGIN;
COMMIT;
