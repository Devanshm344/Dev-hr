-- 006_shift_schedule.sql — superseded: this app no longer owns a local
-- `users` table (identity now comes from dev-hr's `employees`), so there is
-- nowhere local to hang a per-person shift_start_day column. dev-hr's own
-- shifts/employee_shift_mappings don't carry a weekday-of-week-start either
-- (weekend_days is unset for every seeded shift), so the app defaults every
-- employee to a Monday-start week in code (see app/deps.py). Left as a no-op
-- so migration numbering stays intact.

BEGIN;
COMMIT;
