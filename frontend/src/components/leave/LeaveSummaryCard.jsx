import React from 'react'
import { Loader2 } from 'lucide-react'
import { fmtDays } from '../../utils/leave'

function fmtAsOf(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-')
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-500' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

// Right-side leave summary card — every number here comes straight from the
// backend's /leave/preview response. No balance math happens in this component.
export default function LeaveSummaryCard({ preview, loading, asOf }) {
  const exceeded = preview ? !preview.allow_apply && preview.balance_after_booking < 0 : false

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-900">Leave Summary</p>
        {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {asOf && <p className="text-xs text-gray-400 mb-2">As On {fmtAsOf(asOf)}</p>}

      {!preview ? (
        <p className="text-xs text-gray-400 py-3">Select a leave type and dates to see your balance.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          <Row label="Available Balance" value={fmtDays(preview.available_balance)} />
          <Row label="Current Booking" value={fmtDays(preview.current_booking)} />
          <Row
            label="Balance After Booking"
            value={fmtDays(preview.balance_after_booking)}
            tone={preview.balance_after_booking >= 0 ? 'green' : 'red'}
          />
          <Row label="Estimated Balance" value={fmtDays(preview.estimated_year_end_balance)} />
        </div>
      )}

      {exceeded && (
        <p className="text-xs text-red-500 mt-2">{preview.message}</p>
      )}
    </div>
  )
}
