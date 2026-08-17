BEGIN;

-- Collapse the 5-state task status model down to pending/completed. Existing
-- todo/in_progress/blocked/cancelled tasks all become "pending" — completed
-- stays completed. Constraint must be dropped before the UPDATE, since
-- "pending" isn't a legal value under the old 5-state constraint.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

UPDATE tasks SET status = 'pending' WHERE status <> 'completed';

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'completed'));

ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;
