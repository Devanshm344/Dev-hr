// Single source of truth for the app's type scale. tailwind.config.js imports
// this for Tailwind utility classes; components that can't use Tailwind
// classes (inline-style-driven components like OrgChart.jsx) import the same
// values here instead of re-declaring their own px literals.
//
// Three tiers only:
//   body  (14px regular) - instructions, descriptions, general reading
//   dense (12px, down to 10px in tight spaces) - tables, secondary text, captions
//   label/heading (15-16px medium/semibold) - card/widget labels, section headers

export const fontSize = {
  dense: '10px',  // tightest spaces only: micro-badges, calendar/chart cells
  xs:    '12px',  // data tables & dense UI: secondary text, cell values, captions
  sm:    '14px',  // body text & descriptions (also form inputs/labels)
  label: '15px',  // card/widget labels, sub-headers
  base:  '16px',  // section headers, primary UI tags
}

// Plain numeric px values for non-Tailwind consumers (inline style objects).
export const fontSizePx = {
  dense: 10,
  xs:    12,
  sm:    14,
  label: 15,
  base:  16,
}

export const fontWeight = {
  regular:  400,
  medium:   500,
  semibold: 600,
}
