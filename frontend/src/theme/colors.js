// Single source of truth for the raw brand palette. tailwind.config.js imports
// this for Tailwind utility classes; components that can't use Tailwind classes
// (inline-style-driven components, Recharts) import the same values here
// instead of re-declaring their own hex/rgb literals.

export const primary = {
  50:  '#eff6ff',
  100: '#dbeaff',
  200: '#bfdcff',
  300: '#8fc2ff',
  400: '#4d9dff',
  500: '#1a75f0',
  600: '#0052CC',
  700: '#003C99',
  800: '#032e73',
  900: '#0a2650',
}

export const secondary = {
  50:  '#e6f9ff',
  100: '#ccf2ff',
  200: '#99e5ff',
  300: '#5cd3ff',
  400: '#00B4FF',
  500: '#0090d4',
  600: '#0072a8',
}

export const gray = {
  50:  '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
}

export const success = { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857' }
export const warning  = { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' }
export const error    = { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' }
export const info     = { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' }

// Hex -> "r,g,b" triplet, for callers that need translucent brand tints
// (rgba(...)) in inline styles rather than a Tailwind opacity modifier.
export function hexToRgbTriplet(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

export function rgba(hex, alpha) {
  return `rgba(${hexToRgbTriplet(hex)},${alpha})`
}

// The "icon badge" gradient reused verbatim across every self-service page
// header (Travel, Reimbursement, Off Boarding, Insurance, Policy, Asset
// Requisition, ...). One definition instead of the identical literal string
// copy-pasted per page.
export const BRAND_GRADIENT = `linear-gradient(135deg, ${primary[600]} 0%, ${secondary[400]} 100%)`
