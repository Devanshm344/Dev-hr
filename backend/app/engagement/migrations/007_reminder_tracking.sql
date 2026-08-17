-- 007_reminder_tracking.sql — idempotency markers so the reminder sweep
-- never sends the same stage's email twice for the same timesheet

BEGIN;

ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS due_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

COMMIT;
