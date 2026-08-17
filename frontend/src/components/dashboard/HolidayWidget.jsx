import React, { useEffect, useState } from 'react'
import { ltGetHolidays } from '../../services/api'
import { Calendar, Loader2 } from 'lucide-react'

const TYPE_META = {
  public:     { dot: 'bg-primary-600', badge: 'text-primary-600 bg-primary-50 border-primary-100' },
  optional:   { dot: 'bg-amber-500',  badge: 'text-amber-600  bg-amber-50  border-amber-100'  },
  restricted: { dot: 'bg-rose-500',   badge: 'text-rose-600   bg-rose-50   border-rose-100'   },
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
}

function daysUntil(dateStr) {
  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const target  = new Date(dateStr + 'T00:00:00')
  const diff    = Math.round((target - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

export default function HolidayWidget() {
  const [holidays, setHolidays] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    const year = new Date().getFullYear()
    ltGetHolidays(year)
      .then(res => {
        const todayStr  = new Date().toISOString().split('T')[0]
        const upcoming  = (res.data?.holidays ?? [])
          .filter(h => h.date >= todayStr)
          .slice(0, 6)
        setHolidays(upcoming)
      })
      .catch(() => setError('Failed to load holidays'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body font-bold text-gray-900">Schedule &amp; Holidays</h3>
        <Calendar size={14} className="text-gray-300" />
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-secondary-500" />
        </div>
      )}

      {!loading && error && (
        <p className="text-dense text-gray-400 text-center py-4">{error}</p>
      )}

      {!loading && !error && holidays.length === 0 && (
        <div className="flex flex-col items-center py-5 gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
            <Calendar size={14} className="text-gray-300" />
          </div>
          <p className="text-dense text-gray-400">No upcoming holidays</p>
        </div>
      )}

      {!loading && !error && holidays.length > 0 && (
        <div className="space-y-2">
          {holidays.map(h => {
            const meta = TYPE_META[h.holiday_type] ?? TYPE_META.public
            return (
              <div key={h.id} className="flex items-center gap-2.5 py-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-dense font-semibold text-gray-800 truncate">{h.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-dense-tight font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border capitalize ${meta.badge}`}>
                      {h.holiday_type}
                    </span>
                    <span className="text-dense-tight text-gray-400">{fmtDate(h.date)}</span>
                  </div>
                </div>
                <span className="text-dense-tight font-semibold text-secondary-500 shrink-0 whitespace-nowrap">
                  {daysUntil(h.date)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
