import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

/**
 * Ellipsis-window numbered pagination, shared by every paginated list page
 * (originally EmployeesPage's inline block) instead of each page
 * re-implementing the same page-number windowing logic.
 */
export default function Pagination({ page, pageSize, total, onPageChange, itemLabel = 'items' }) {
  if (total <= pageSize) return null

  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pageNumbers = () => {
    const pages = []
    const delta = 2
    const left = Math.max(2, page - delta)
    const right = Math.min(totalPages - 1, page + delta)
    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages - 1) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-gray-700">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>

        {pageNumbers().map((pg, i) =>
          pg === '...'
            ? <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm select-none">…</span>
            : (
              <button
                key={pg}
                onClick={() => onPageChange(pg)}
                className={clsx(
                  'w-9 h-9 rounded-lg text-sm font-medium border transition-colors',
                  pg === page
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {pg}
              </button>
            )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
