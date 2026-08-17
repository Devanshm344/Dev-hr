import React from 'react'
import clsx from 'clsx'

const CARD_SHADOW = { boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }

// Shared white card shell used across every module — single source for the
// rounded-corner/shadow/overflow styling that was previously copy-pasted per page.
export default function Card({ children, className, style, ...rest }) {
  return (
    <div
      className={clsx('bg-white rounded-2xl overflow-hidden', className)}
      style={{ ...CARD_SHADOW, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
