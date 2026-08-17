// ============================================================
// RBAC Constants – Single Source of Truth for Frontend Access
// Access is determined ONLY by user.role, sourced from the backend
// user_roles table ('Super Admin' | 'Admin' | 'Employee').
// Super Admin is a superset of Admin — it passes every Admin check.
// ============================================================

export const Role = Object.freeze({
  SuperAdmin: 'Super Admin',
  Admin:      'Admin',
  Employee:   'Employee',
})

// ── Permission Matrix ──────────────────────────────────────
// Module visibility: true = visible to role
export const MODULE_ACCESS = Object.freeze({
  dashboard:         { [Role.Employee]: true,  [Role.Admin]: true  },
  employees:         { [Role.Employee]: false, [Role.Admin]: true  },
  attendance:        { [Role.Employee]: true,  [Role.Admin]: true  },
  leave:             { [Role.Employee]: true,  [Role.Admin]: true  },
  payroll:           { [Role.Employee]: false, [Role.Admin]: true  },
  performance:       { [Role.Employee]: true,  [Role.Admin]: true  },
  documents:         { [Role.Employee]: true,  [Role.Admin]: true  },
  departments:       { [Role.Employee]: false, [Role.Admin]: true  },
  team:              { [Role.Employee]: true,  [Role.Admin]: true  },
  announcements:     { [Role.Employee]: false, [Role.Admin]: true  },
  // <unhide_for_employee> – Set Employee to true to restore Assets access for all employees
  assets:            { [Role.Employee]: false, [Role.Admin]: true  },
  policy:            { [Role.Employee]: false, [Role.Admin]: true  },
  shift:             { [Role.Employee]: true,  [Role.Admin]: true  },
  hrOperation:       { [Role.Employee]: false, [Role.Admin]: true  },
  userManagement:    { [Role.Employee]: false, [Role.Admin]: true  },
  // ── Employee Self-Service modules (visible via "More" dropdown) ──
  travel:            { [Role.Employee]: true,  [Role.Admin]: true  },
  reimbursement:     { [Role.Employee]: true,  [Role.Admin]: true  },
  offboarding:       { [Role.Employee]: true,  [Role.Admin]: true  },
  insurance:         { [Role.Employee]: true,  [Role.Admin]: true  },
  employeePolicy:    { [Role.Employee]: true,  [Role.Admin]: true  },
  assetRequisition:  { [Role.Employee]: true,  [Role.Admin]: true  },
  leaveTracker:      { [Role.Employee]: false, [Role.Admin]: true  },
})

// ── Role Service ───────────────────────────────────────────

/**
 * Returns the canonical RBAC role for a user object.
 * Normalises legacy role values from old sessions to the current tiers.
 * Source of truth after login is the user_roles DB table via the API.
 */
export function getUserRole(user) {
  if (!user?.role) return Role.Employee
  const r = user.role
  // New canonical values
  if (r === Role.SuperAdmin || r === Role.Admin || r === Role.Employee) return r
  // Legacy values (backward-compat for existing sessions)
  if (r === 'admin' || r === 'hr_manager') return Role.Admin
  return Role.Employee
}

/** True iff the user has Admin (or Super Admin) access. */
export function isAdmin(user) {
  const role = getUserRole(user)
  return role === Role.Admin || role === Role.SuperAdmin
}

/** True iff the user has Super Admin access specifically. */
export function isSuperAdmin(user) {
  return getUserRole(user) === Role.SuperAdmin
}

/** True iff a module is accessible by the user's role. */
export function canAccess(user, module) {
  // Super Admin is a superset of Admin — reuse the Admin column.
  const role = isAdmin(user) ? Role.Admin : Role.Employee
  return MODULE_ACCESS[module]?.[role] ?? false
}

// ── Display Labels ─────────────────────────────────────────
// UI-only relabeling: the stored/RBAC values above ('Super Admin',
// 'Admin', 'Employee') never change — only what's shown on screen.
const ROLE_DISPLAY_LABELS = Object.freeze({
  [Role.SuperAdmin]: 'Admin',
  [Role.Admin]:      'Human Resources',
  [Role.Employee]:   'Employee',
})

/** Maps a stored role value to its display label ('Super Admin' -> 'Admin', 'Admin' -> 'Human Resources'). */
export function roleDisplayLabel(role) {
  return ROLE_DISPLAY_LABELS[role] ?? role
}
