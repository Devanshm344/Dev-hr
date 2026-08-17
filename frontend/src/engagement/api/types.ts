export interface User {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  timezone: string;
  weekly_capacity_hours: string;
  role: "admin" | "manager" | "employee";
  status: string;
}

export type TimesheetStatus = "draft" | "submitted" | "approved" | "changes_requested" | "not_started";

export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface Expense {
  id: string;
  user_id: string;
  project_id: string;
  category_id: string;
  expense_date: string;
  amount: number;
  currency: string;
  description: string | null;
  billable: boolean;
  receipt_note: string | null;
  other_category_note: string | null;
  status: ExpenseStatus;
  submitted_at: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  project_name: string;
  client_name: string;
  category_name: string;
  user_name: string;
  employee_code: string;
  reviewer_name: string | null;
}

export interface CellEntry {
  id: string;
  minutes: number;
  note: string | null;
}

export interface GridRow {
  project_id: string;
  project_name: string;
  client_name: string;
  task_id: string | null;
  task_name: string | null;
  billable: boolean;
  entries: Record<string, CellEntry>;
  total_minutes: number;
}

export interface TimesheetReview {
  id: string;
  action: "approved" | "changes_requested";
  comment: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
}

export interface WeekGrid {
  timesheet: {
    id: string;
    week_start_date: string;
    week_end_date: string;
    status: TimesheetStatus;
    submitted_at: string | null;
    due_date: string;
    reminder_stage: ReminderStage;
    latest_review?: TimesheetReview | null;
  };
  days: string[];
  capacity_minutes: number;
  rows: GridRow[];
  day_totals: Record<string, number>;
  total_minutes: number;
  billable_minutes: number;
  missing_working_days: string[];
  weekend_days: string[];
  weekend_unlocked_days: string[];
}

export interface ApprovalDetail extends WeekGrid {
  employee: {
    id: string;
    name: string;
    employee_code: string;
    job_title: string | null;
  };
  reviews: TimesheetReview[];
}

export interface ApprovalInboxItem {
  id: string;
  week_start_date: string;
  week_end_date: string;
  total_minutes: number;
  capacity_minutes: number;
  billable_minutes: number;
  submitted_at: string;
  user_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  job_title: string | null;
}

export type AuditGranularity = "day" | "week" | "month";

export interface TeamAuditRow<T = AuditWeek> {
  user: {
    id: string;
    name: string;
    employee_code: string;
    job_title: string | null;
  };
  periods: T[];
}

export interface TimesheetSummary {
  id: string;
  week_start_date: string;
  week_end_date: string;
  total_minutes: number;
  billable_minutes: number;
  status: TimesheetStatus;
  submitted_at: string | null;
}

export interface TimesheetDay {
  date: string;
  total_minutes: number;
  billable_minutes: number;
  status: TimesheetStatus;
  submitted_at: string | null;
  is_today: boolean;
}

export interface TimesheetMonth {
  month: string;
  label: string;
  total_minutes: number;
  billable_minutes: number;
  weeks_total: number;
  weeks_approved: number;
  submitted_at: string | null;
  is_current: boolean;
}

export type ReminderStage = "grace" | "overdue" | "escalated" | null;

export interface AuditWeek {
  week_start_date: string;
  week_end_date: string;
  logged_minutes: number;
  capacity_minutes: number;
  missing_minutes: number;
  status: TimesheetStatus;
  is_current: boolean;
  due_date: string;
  reminder_stage: ReminderStage;
}

export interface AuditDay {
  date: string;
  is_working_day: boolean;
  logged_minutes: number;
  capacity_minutes: number;
  missing_minutes: number;
  status: TimesheetStatus;
  is_today: boolean;
}

export interface AuditMonth {
  month: string;
  label: string;
  logged_minutes: number;
  capacity_minutes: number;
  missing_minutes: number;
  weeks_total: number;
  weeks_approved: number;
  reminder_stage: ReminderStage;
  is_current: boolean;
}

export interface RowOptionTask {
  task_id: string;
  task_name: string;
  description: string | null;
  billable: boolean;
  status: string;
  priority: string;
  assigned_to: string | null;
  assignee: string | null;
  can_edit: boolean;
}

export interface RowOptionProject {
  project_id: string;
  project_name: string;
  client_name: string;
  billing_model: string;
  can_add_tasks: boolean;
  tasks: RowOptionTask[];
}

export interface PortfolioProject {
  id: string;
  project_code: string;
  name: string;
  status: string;
  billing_model: string;
  start_date: string | null;
  end_date: string | null;
  project_manager: string | null;
  task_count: number;
  logged_minutes: number;
}

export interface PortfolioClient {
  id: string;
  client_code: string;
  name: string;
  currency: string;
  status: string;
  projects: PortfolioProject[];
}

export interface ProjectTask {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  billable: boolean;
  assigned_to?: string | null;
  assignee: string | null;
  created_by: string | null;
  creator_name: string | null;
  can_edit: boolean;
  can_set_status: boolean;
}

export interface ProjectMember {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  job_title: string | null;
  weekly_capacity_hours: string;
}

export interface ProjectDetail {
  id: string;
  project_code: string;
  name: string;
  description: string | null;
  status: string;
  billing_model: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  client_id: string;
  client_name: string;
  project_manager: string | null;
  project_manager_id: string | null;
  project_manager_name: string | null;
  created_by: string | null;
  budget_amount: number | null;
  can_edit: boolean;
  can_add_tasks: boolean;
  tasks: ProjectTask[];
  members: ProjectMember[];
}

export interface Client {
  id: string;
  client_code: string;
  name: string;
  currency: string;
  status: string;
  notes: string | null;
}

export interface ManagedUser {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  job_title: string | null;
  manager_id: string | null;
  role: "admin" | "manager" | "employee";
}

export interface AllocationCell {
  minutes: number;
  note: string | null;
}

export interface AllocationMatrixPerson {
  user_id: string;
  name: string;
  job_title: string | null;
  capacity_minutes: number;
  cells: Record<string, AllocationCell>;
}

export interface AllocationMatrix {
  project: { id: string; name: string; client_name: string };
  weeks: string[];
  people: AllocationMatrixPerson[];
}

export interface ProjectSummary {
  week_start_date: string | null;
  week_end_date: string | null;
  total_projects: number;
  active_projects: number;
  client_projects: number;
  internal_projects: number;
  active_client_projects: number;
  active_internal_projects: number;
  active_client_project_names: string[];
  active_internal_project_names: string[];
}

export interface MyAllocationRow {
  project_id: string;
  project_name: string;
  client_name: string;
  week_start_date: string;
  allocated_minutes: number;
  note: string | null;
}

export interface UtilizationWeek {
  week_start_date: string;
  week_end_date: string;
  allocated_minutes: number;
  logged_minutes: number;
  capacity_minutes: number;
  is_current: boolean;
}

export interface Utilization {
  user: { id: string; name: string };
  weeks: UtilizationWeek[];
}

export type NotificationType =
  | "timesheet_submitted"
  | "timesheet_approved"
  | "timesheet_changes_requested"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "weekend_entry_logged"
  | "task_assigned";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface TimeReport {
  start: string;
  end: string;
  group_by: string;
  rows: { label: string; total_minutes: number; billable_minutes: number; entry_count: number }[];
  total_minutes: number;
  billable_minutes: number;
}

export interface ReportsDashboardProjectRow {
  project_id: string;
  label: string;
  total_minutes: number;
  billable_minutes: number;
}

export interface ReportsDashboardPersonRow {
  user_id: string;
  label: string;
  total_minutes: number;
}

export interface ReportsDashboardMatrixCell {
  user_id: string;
  person_label: string;
  project_id: string;
  project_label: string;
  total_minutes: number;
}

export interface ReportsDashboard {
  start: string;
  end: string;
  total_minutes: number;
  billable_minutes: number;
  project_count: number;
  contributor_count: number | null;
  by_project: ReportsDashboardProjectRow[];
  by_person: ReportsDashboardPersonRow[] | null;
  matrix: ReportsDashboardMatrixCell[] | null;
}
