-- 012_notifications.sql — in-app notifications for the four submit/decision
-- events (timesheet submitted/approved/changes-requested, expense
-- submitted/approved/rejected), surfaced via a bell dropdown in the UI.

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    INTEGER NOT NULL REFERENCES employees(id),
    type       TEXT NOT NULL
               CHECK (type IN (
                   'timesheet_submitted', 'timesheet_approved', 'timesheet_changes_requested',
                   'expense_submitted', 'expense_approved', 'expense_rejected'
               )),
    title      TEXT NOT NULL,
    body       TEXT,
    link       TEXT,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

COMMIT;
