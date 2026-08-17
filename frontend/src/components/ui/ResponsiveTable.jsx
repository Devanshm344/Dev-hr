import React from 'react'
import clsx from 'clsx'

// Guarantees every table gets a horizontal-scroll fallback on narrow viewports
// instead of overflowing/breaking the page layout on phone and tablet.
export default function ResponsiveTable({ children, className }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      {children}
    </div>
  )
}
