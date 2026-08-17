// Single source of truth for the dark header + responsive type scale shared by
// every admin data table (Leave Requests, Team Approvals, Pending Approvals,
// View Approvals). Change sizing here once instead of per-table.
export const TABLE_HEAD_ROW    = 'bg-slate-800'
export const TABLE_HEAD_CELL   = 'px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6 text-table-head text-slate-200 whitespace-nowrap'
export const TABLE_CELL        = 'px-3 py-3 sm:px-4 sm:py-3.5 lg:px-6 lg:py-4 text-dense sm:text-body text-gray-800'
export const TABLE_CELL_MUTED  = 'px-3 py-3 sm:px-4 sm:py-3.5 lg:px-6 lg:py-4 text-dense text-gray-800'

// Row-level tokens — apply to each <tr> in a table body for enterprise-grade
// zebra striping + hover feedback. Not baked into DataTableHead/ResponsiveTable
// since those only render the <thead>/scroll wrapper, not page-specific rows.
export const TABLE_ROW_HOVER    = 'hover:bg-primary-50/40 transition-colors'
export const TABLE_ROW_ZEBRA    = 'even:bg-gray-50/60'
