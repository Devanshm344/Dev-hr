-- 005_task_creator.sql — track who created a task, so members can be given
-- limited edit rights over their own tasks on internal (non-billable) projects

BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES employees(id);

COMMIT;
