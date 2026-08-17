import { primary, secondary, gray, success, warning, error, info } from './src/theme/colors.js'
import { fontSize } from './src/theme/fonts.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: '400px',
      },
      colors: {
        // Brand palette lives in src/theme/colors.js — the single source both
        // Tailwind (here) and JS-only inline-style consumers import from.
        primary,
        secondary,
        gray,
        success,
        warning,
        error,
        info,
        // Legacy flat aliases — kept so the landing page and any existing
        // `brand-*` class references keep working unchanged.
        'brand-primary':      primary[600],
        'brand-primaryLight': secondary[400],
        'brand-primaryDark':  primary[700],
        'brand-secondary':    '#FFCB47',
        'brand-accent':       '#FFE066',
        'brand-gray':         gray[600],
        'brand-lightGray':    '#EFF6FF',
        'brand-darkGray':     gray[900],
        'brand-border':       gray[300],
        // Associate Engagement (Timesheet + PSA) module — its own accent/tone
        // tokens, namespaced under `engagement-*` so they can't collide with
        // (or fall back onto) the tokens above. Values mirror time_sheet-main's
        // own tailwind.config.js exactly.
        engagement: {
          ink:    { DEFAULT: '#101828', soft: '#334155', faint: '#64748B' },
          canvas: '#F7F8FA',
          line:   '#E4E7EC',
          accent: { DEFAULT: '#2563EB', hover: '#1D4ED8', soft: '#EFF6FF', ring: '#BFDBFE' },
          ok:     { DEFAULT: '#047857', soft: '#ECFDF5' },
          warn:   { DEFAULT: '#B45309', soft: '#FFFBEB' },
          bad:    { DEFAULT: '#B91C1C', soft: '#FEF2F2' },
          info:   { DEFAULT: '#0E7490', soft: '#ECFEFF' },
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        // Associate Engagement module fonts — see note above.
        'engagement-display': ['Space Grotesk', 'Inter', 'sans-serif'],
        'engagement-mono':    ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      // App-wide type scale — see src/theme/fonts.js for the single source
      // and the rationale for each tier. 'xs'/'sm'/'base' override Tailwind's
      // defaults with the same px values (12/14/16) to pin a line-height;
      // '2xs' and 'label' are new tiers Tailwind doesn't ship.
      fontSize: {
        '2xs': [fontSize.dense, { lineHeight: '1.4' }],
        xs:    [fontSize.xs,    { lineHeight: '1.5' }],
        sm:    [fontSize.sm,    { lineHeight: '1.5' }],
        label: [fontSize.label, { lineHeight: '1.4' }],
        base:  [fontSize.base,  { lineHeight: '1.5' }],
      },
      spacing: {
        section: '6rem',
      },
    },
  },
  plugins: [],
}
