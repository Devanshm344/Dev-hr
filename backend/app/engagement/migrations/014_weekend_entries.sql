-- 014_weekend_entries.sql — append-only audit log of "reason for working a
-- weekend day". No approval gate: submitting immediately unlocks the cell
-- for the employee (see time_service.log_weekend_entry); the manager just
-- gets an FYI notification, same as timesheet/expense submit already does.

BEGIN;

CREATE TABLE IF NOT EXISTS weekend_time_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    INTEGER NOT NULL REFERENCES employees(id),
    work_date  DATE NOT NULL,
    reason     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_weekend_time_entries_user_date
    ON weekend_time_entries (user_id, work_date);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'timesheet_submitted', 'timesheet_approved', 'timesheet_changes_requested',
        'expense_submitted', 'expense_approved', 'expense_rejected',
        'weekend_entry_logged'
    ));

COMMIT;
