// Leave-day values from the backend are often fractional (e.g. 7/12 monthly
// accrual) — round for display everywhere a day count is shown, without
// duplicating the same rounding logic in every component.
export function fmtDays(value) {
  if (value == null || Number.isNaN(value)) return 0
  return Math.round(value * 10) / 10
}
