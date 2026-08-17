-- 003_allocations.sql — planned resource allocation per project/person/week

BEGIN;

CREATE TABLE IF NOT EXISTS allocations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID NOT NULL REFERENCES projects(id),
    user_id           INTEGER NOT NULL REFERENCES employees(id),
    week_start_date   DATE NOT NULL,
    allocated_minutes INTEGER NOT NULL CHECK (allocated_minutes > 0 AND allocated_minutes <= 10080),
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id, week_start_date)
);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON allocations (user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_allocations_project ON allocations (project_id, week_start_date);

COMMIT;
