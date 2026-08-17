-- 008_project_manager_name.sql — a free-text project manager name for cases
-- where the responsible person doesn't have a user account in the system yet.
-- Display-only: unlike project_manager_id, it grants no edit rights or
-- automatic project membership.

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_manager_name TEXT;

COMMIT;
