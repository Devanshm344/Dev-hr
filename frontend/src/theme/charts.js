// Single source of truth for chart/sparkline colors — derives from the same
// palette as tailwind.config.js (src/theme/colors.js). Recharts needs real hex
// values (it can't consume Tailwind classes), so this is the one place a
// component is allowed to import raw color values for chart rendering.

import { primary, secondary, success, warning, error, gray } from './colors'

export const CHART_THEMES = {
  primary:   { icon: primary[600],   iconBg: primary[50],   line: primary[600] },
  secondary: { icon: secondary[500], iconBg: secondary[50], line: secondary[400] },
  success:   { icon: success[600],   iconBg: success[50],   line: success[500] },
  warning:   { icon: warning[600],   iconBg: warning[50],   line: warning[500] },
}

// 7 stops (up from 5) so multi-slice pies with more categories (e.g. a
// department breakdown) cycle through more distinct colors before repeating.
// Reuses shades already defined in colors.js — no new hex values introduced.
export const CHART_SERIES_COLORS = [
  primary[600], secondary[400], success[500], warning[500], error[500], primary[300], gray[500],
]
