-- seed.sql — demo PSA data for the EM app, layered on top of the real
-- dev-hr employees. This file no longer creates any local user/role/password
-- data — identity, roles and passwords all come from dev-hr's own
-- employees/user_roles tables (see app/deps.py). It only seeds this app's
-- own PSA tables: organization settings, a couple of demo clients/projects,
-- their tasks, and project membership drawn from real employees.

BEGIN;

INSERT INTO organization_settings (company_name, default_currency, timezone, standard_daily_hours, standard_weekly_hours, week_start_day)
SELECT 'TechDemocracy', 'INR', 'Asia/Kolkata', 8, 40, 'monday'
WHERE NOT EXISTS (SELECT 1 FROM organization_settings);

-- Clients & projects -------------------------------------------------
INSERT INTO clients (client_code, name, currency, status, notes) VALUES
 ('CL-001','TechDemocracy LLC','INR','active','Internal work and operations'),
 ('CL-002','Meridian Retail Group','USD','active','Fictional demo client')
ON CONFLICT (client_code) DO NOTHING;

-- Both demo projects are managed by Akash Menon (DVH0001), the Engineering
-- lead with the most direct reports in dev-hr — a realistic "manager" whose
-- approvals inbox and team auditing will actually have data in them.
INSERT INTO projects (project_code, name, client_id, description, project_manager_id, start_date, status, billing_model, currency) VALUES
 ('PRJ-001','Internal Tasks',
   (SELECT id FROM clients WHERE client_code='CL-001'),
   'Internal operations, meetings and administrative work',
   (SELECT id FROM employees WHERE employee_id='DVH0001'),
   date_trunc('year', CURRENT_DATE)::date, 'active','non_billable','INR'),
 ('PRJ-002','E-commerce Replatform',
   (SELECT id FROM clients WHERE client_code='CL-002'),
   'Rebuild of the Meridian storefront and order services',
   (SELECT id FROM employees WHERE employee_id='DVH0001'),
   (CURRENT_DATE - INTERVAL '90 days')::date, 'active','time_and_materials','USD')
ON CONFLICT (project_code) DO NOTHING;

-- Internal Tasks: every active employee in dev-hr is a member, so anyone who
-- signs in can log time immediately with no manual setup.
INSERT INTO project_members (project_id, user_id, project_role)
SELECT p.id, e.id, CASE WHEN e.employee_id = 'DVH0001' THEN 'project_manager' ELSE 'member' END
FROM projects p
CROSS JOIN employees e
WHERE p.project_code = 'PRJ-001' AND e.status = 'active'
ON CONFLICT DO NOTHING;

-- E-commerce Replatform: scoped to the Engineering department (Akash's own
-- reports), for a realistic client-billable team.
INSERT INTO project_members (project_id, user_id, project_role)
SELECT p.id, e.id, CASE WHEN e.employee_id = 'DVH0001' THEN 'project_manager' ELSE 'member' END
FROM projects p
CROSS JOIN employees e
WHERE p.project_code = 'PRJ-002' AND e.department_id = (SELECT id FROM departments WHERE code = 'ENG')
  AND e.status = 'active'
ON CONFLICT DO NOTHING;

-- Tasks --------------------------------------------------------------
INSERT INTO tasks (project_id, name, status, priority, billable) VALUES
 ((SELECT id FROM projects WHERE project_code='PRJ-001'),'Meetings','in_progress','medium',false),
 ((SELECT id FROM projects WHERE project_code='PRJ-001'),'Administrative Work','in_progress','low',false),
 ((SELECT id FROM projects WHERE project_code='PRJ-001'),'HR and Recruiting','in_progress','medium',false),
 ((SELECT id FROM projects WHERE project_code='PRJ-001'),'Team Event','todo','low',false),
 ((SELECT id FROM projects WHERE project_code='PRJ-001'),'Documentation','in_progress','medium',false),
 ((SELECT id FROM projects WHERE project_code='PRJ-002'),'Discovery and Design','completed','high',true),
 ((SELECT id FROM projects WHERE project_code='PRJ-002'),'Backend Development','in_progress','high',true),
 ((SELECT id FROM projects WHERE project_code='PRJ-002'),'Frontend Development','in_progress','high',true),
 ((SELECT id FROM projects WHERE project_code='PRJ-002'),'QA and Testing','in_progress','medium',true)
ON CONFLICT DO NOTHING;

-- Expense categories ---------------------------------------------------
INSERT INTO expense_categories (name, description) VALUES
 ('Travel','Flights, trains, mileage, and transit'),
 ('Accommodation','Hotels and lodging'),
 ('Meals','Client and travel meals'),
 ('Software & Tools','Subscriptions and licenses'),
 ('Office Supplies','Equipment and consumables'),
 ('Other','Anything that does not fit the above')
ON CONFLICT (name) DO NOTHING;

COMMIT;
