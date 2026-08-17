-- 011_expense_other_category_note.sql — when an expense is filed under the
-- "Other" category, capture what it actually is.

BEGIN;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS other_category_note TEXT;

COMMIT;
