-- 010_project_creator_and_budget.sql — track who created a project (so they
-- keep edit rights even if reassigned/left unassigned as PM) and let a
-- project carry an optional budget figure.

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES employees(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(14,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_budget_amount_nonneg'
    ) THEN
        ALTER TABLE projects ADD CONSTRAINT projects_budget_amount_nonneg
            CHECK (budget_amount IS NULL OR budget_amount >= 0);
    END IF;
END $$;

COMMIT;
