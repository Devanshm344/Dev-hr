import React from 'react'
import clsx from 'clsx'
import { TABLE_HEAD_ROW, TABLE_HEAD_CELL } from './tableStyles'

// Dark <thead> shared by every admin data table — pass column labels (and which
// ones should center-align) so each table stops re-declaring the same header markup.
export default function DataTableHead({ columns, centered = [], right = [], leading = null }) {
  return (
    <thead>
      <tr className={TABLE_HEAD_ROW}>
        {leading && <th className={clsx(TABLE_HEAD_CELL, 'w-10')}>{leading}</th>}
        {columns.map(label => (
          <th
            key={label}
            className={clsx(
              TABLE_HEAD_CELL,
              right.includes(label) ? 'text-right' : centered.includes(label) ? 'text-center' : 'text-left'
            )}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  )
}
