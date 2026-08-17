-- ============================================================
-- Step 1: Add hashed_password column to users table
-- Run in pgAdmin Query Tool on: cotelligent_hrms
-- ============================================================

-- Enable pgcrypto (needed for bcrypt hashing inside PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add hashed_password column (nullable so existing rows are not broken)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);

-- ============================================================
-- Step 2: Set default password "Admin@123" for ALL users
--         (They can reset via Forgot Password later)
-- ============================================================
UPDATE users
SET hashed_password = crypt('Admin@123', gen_salt('bf', 12))
WHERE hashed_password IS NULL;

-- Verify
SELECT id, employee_code, full_name, email, role, is_active,
       CASE WHEN hashed_password IS NOT NULL THEN 'SET' ELSE 'MISSING' END AS password_status
FROM   users
ORDER  BY role, full_name;
