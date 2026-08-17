-- 002_approvals.sql — manager review history for submitted timesheets

BEGIN;

CREATE TABLE IF NOT EXISTS timesheet_reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    reviewer_id  INTEGER NOT NULL REFERENCES employees(id),
    action       TEXT NOT NULL CHECK (action IN ('approved','changes_requested')),
    comment      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_timesheet ON timesheet_reviews (timesheet_id, created_at DESC);

COMMIT;
