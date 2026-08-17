-- 013_dedupe_tasks.sql — tasks had no uniqueness guard, so every re-run of
-- seed.sql inserted a fresh copy of each demo task (seen as repeated names in
-- the Add Time Row task dropdown). Repoint any time entries logged against a
-- duplicate onto the earliest (canonical) row per project, drop the extras,
-- then add a unique index so this can't happen again.

BEGIN;

WITH ranked AS (
    SELECT id, project_id,
           row_number() OVER (PARTITION BY project_id, lower(name) ORDER BY created_at, id) AS rn,
           first_value(id) OVER (PARTITION BY project_id, lower(name) ORDER BY created_at, id) AS canonical_id
    FROM tasks
)
UPDATE time_entries e
SET task_id = r.canonical_id
FROM ranked r
WHERE e.task_id = r.id AND r.rn > 1;

WITH ranked AS (
    SELECT id, project_id,
           row_number() OVER (PARTITION BY project_id, lower(name) ORDER BY created_at, id) AS rn
    FROM tasks
)
DELETE FROM tasks t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_name_unique ON tasks (project_id, lower(name));

COMMIT;
