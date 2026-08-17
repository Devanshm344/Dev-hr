-- 004_expenses.sql — expense tracking with manager approval

BEGIN;

CREATE TABLE IF NOT EXISTS expense_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         INTEGER NOT NULL REFERENCES employees(id),
    project_id      UUID NOT NULL REFERENCES projects(id),
    category_id     UUID NOT NULL REFERENCES expense_categories(id),
    expense_date    DATE NOT NULL,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency        TEXT NOT NULL DEFAULT 'INR',
    description     TEXT,
    billable        BOOLEAN NOT NULL DEFAULT true,
    receipt_note    TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','approved','rejected')),
    submitted_at    TIMESTAMPTZ,
    reviewer_id     INTEGER REFERENCES employees(id),
    reviewed_at     TIMESTAMPTZ,
    review_comment  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses (user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses (project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status);

COMMIT;
