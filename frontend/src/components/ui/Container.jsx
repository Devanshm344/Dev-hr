import React from 'react'
import clsx from 'clsx'

// Shared responsive page wrapper used by every module page — centralizes the
// spacing/max-width breakpoints in one place instead of each page repeating them.
// Padding is NOT included here: every page already renders inside Layout's
// <main className="p-4 md:p-6">, so padding lives there (single source).
// `stack` (default true) applies vertical spacing between sections — pass
// stack={false} for pages whose root is a flex/grid layout of its own.
export default function Container({ children, className, stack = true }) {
  return (
    <div className={clsx(stack && 'space-y-5', 'max-w-7xl xl:max-w-none mx-auto', className)}>
      {children}
    </div>
  )
}
