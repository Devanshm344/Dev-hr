import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getUpcomingBirthdays } from '../../services/api'
import { ChevronDown, ChevronUp, Gift, Loader2 } from 'lucide-react'

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #ec4899, #f97316)',
  'linear-gradient(135deg, #00B4FF, #ec4899)',
  'linear-gradient(135deg, #06b6d4, #0052CC)',
  'linear-gradient(135deg, #10b981, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
]

const INITIAL_SHOW = 5

function initials(fullName) {
  return (fullName ?? '')
    .split(' ')
    .map(n => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function fmtBirthday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function PersonRow({ person, idx }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
      {person.profile_picture ? (
        <img
          src={person.profile_picture}
          alt={person.full_name}
          className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-pink-100"
          onError={e => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextSibling.style.display = 'flex'
          }}
        />
      ) : null}
      <div
        className="w-8 h-8 rounded-full shrink-0 items-center justify-center text-dense-tight font-bold text-white"
        style={{
          background: GRADIENT_COLORS[idx % GRADIENT_COLORS.length],
          display: person.profile_picture ? 'none' : 'flex',
        }}
      >
        {initials(person.full_name)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-dense font-semibold text-gray-800 truncate">{person.full_name}</p>
        <p className="text-dense-tight text-gray-400 truncate">
          {person.title ?? person.department ?? '—'}
        </p>
      </div>

      <p className="text-dense font-bold text-gray-500 shrink-0 whitespace-nowrap">
        🎂 {fmtBirthday(person.date_of_birth)}
      </p>
    </div>
  )
}

export default function BirthdayWidget() {
  const [people,   setPeople]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    getUpcomingBirthdays()
      .then(res => setPeople(res.data ?? []))
      .catch(() => setError('Failed to load birthdays'))
      .finally(() => setLoading(false))
  }, [])

  const visible  = useMemo(() => people.slice(0, INITIAL_SHOW), [people])
  const overflow = useMemo(() => people.slice(INITIAL_SHOW),    [people])
  const hasMore  = overflow.length > 0

  const toggle = useCallback(() => setExpanded(v => !v), [])

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body font-bold text-gray-900">Birthdays</h3>
        <Gift size={14} className="text-pink-400" />
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-secondary-500" />
        </div>
      )}

      {!loading && error && (
        <p className="text-dense text-gray-400 text-center py-4">{error}</p>
      )}

      {!loading && !error && people.length === 0 && (
        <div className="flex flex-col items-center py-5 gap-2">
          <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center">
            <Gift size={14} className="text-pink-300" />
          </div>
          <p className="text-dense text-gray-400">No upcoming birthdays</p>
        </div>
      )}

      {!loading && !error && people.length > 0 && (
        <>
          <div className="space-y-0.5">
            {visible.map((person, idx) => (
              <PersonRow key={person.id} person={person} idx={idx} />
            ))}
          </div>

          {hasMore && (
            <>
              <div
                style={{
                  maxHeight: expanded ? `${overflow.length * 52}px` : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div className="space-y-0.5 pt-0.5">
                  {overflow.map((person, idx) => (
                    <PersonRow key={person.id} person={person} idx={INITIAL_SHOW + idx} />
                  ))}
                </div>
              </div>

              <button
                onClick={toggle}
                className="w-full flex items-center justify-center gap-1 mt-2 py-1.5 text-dense font-semibold text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              >
                {expanded ? (
                  <><ChevronUp size={12} /> View Less</>
                ) : (
                  <><ChevronDown size={12} /> View More ({overflow.length} more)</>
                )}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
