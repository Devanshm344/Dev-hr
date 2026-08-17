import React, { useState, useMemo, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, addYears, subYears, isToday, isSameDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function CalendarWidget() {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())

  const days = useMemo(() => {
    const start = startOfMonth(viewDate)
    const end   = endOfMonth(viewDate)
    return eachDayOfInterval({ start, end })
  }, [viewDate])

  const startOffset = useMemo(() => getDay(startOfMonth(viewDate)), [viewDate])

  const prevMonth  = useCallback(() => setViewDate(v => subMonths(v, 1)), [])
  const nextMonth  = useCallback(() => setViewDate(v => addMonths(v, 1)), [])
  const prevYear   = useCallback(() => setViewDate(v => subYears(v, 1)),  [])
  const nextYear   = useCallback(() => setViewDate(v => addYears(v, 1)),  [])
  const goToToday  = useCallback(() => {
    const now = new Date()
    setViewDate(now)
    setSelected(now)
  }, [])

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">

      {/* Month/year header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-0.5">
          <button
            onClick={prevYear}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
            title="Previous year"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            onClick={prevMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
            title="Previous month"
          >
            <ChevronLeft size={13} />
          </button>
        </div>

        <button
          onClick={goToToday}
          className="text-body font-bold text-gray-800 hover:text-primary-600 transition-colors px-1"
          title="Go to today"
        >
          {format(viewDate, 'MMMM yyyy')}
        </button>

        <div className="flex items-center gap-0.5">
          <button
            onClick={nextMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
            title="Next month"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={nextYear}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
            title="Next year"
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => {
          const isToday = i === new Date().getDay()
          return (
            <div
              key={d}
              className={[
                'text-center text-dense-tight font-semibold py-1',
                isToday
                  ? 'text-primary-600 underline underline-offset-2 decoration-primary-600'
                  : 'text-gray-600',
              ].join(' ')}
            >
              {d}
            </div>
          )
        })}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map(day => {
          const todayHighlight = isToday(day)
          const isSelected     = isSameDay(day, selected)
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(day)}
              className={[
                'w-full aspect-square flex items-center justify-center text-dense font-medium rounded-lg transition-all leading-none',
                isSelected
                  ? 'bg-primary-600 text-white shadow-sm font-bold'
                  : todayHighlight
                    ? 'bg-primary-50 text-primary-600 font-bold'
                    : 'text-gray-800 hover:bg-gray-100',
              ].filter(Boolean).join(' ')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Today pill */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex justify-center">
        <button
          onClick={goToToday}
          className="text-dense-tight font-semibold text-primary-500 hover:text-primary-700 transition-colors"
        >
          Today: {format(new Date(), 'EEE, d MMM yyyy')}
        </button>
      </div>
    </div>
  )
}
