import React from 'react'
import { UserPlus, Loader2 } from 'lucide-react'

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #0052CC, #00B4FF)',
  'linear-gradient(135deg, #10b981, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #00B4FF, #ec4899)',
  'linear-gradient(135deg, #7a6ff0, #06b6d4)',
]

function initials(fullName) {
  return (fullName ?? '').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function fmtJoined(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PersonRow({ person, idx, onClick }) {
  return (
    <div
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl cursor-pointer hover:bg-gray-50"
      onClick={() => onClick?.(person.id)}
    >
      {person.profilePicture ? (
        <img
          src={person.profilePicture}
          alt={person.name}
          className="w-8 h-8 rounded-full object-cover shrink-0"
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
        />
      ) : null}
      <div
        className="w-8 h-8 rounded-full shrink-0 items-center justify-center text-dense-tight font-bold text-white"
        style={{ background: GRADIENT_COLORS[idx % GRADIENT_COLORS.length], display: person.profilePicture ? 'none' : 'flex' }}
      >
        {initials(person.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-dense font-semibold text-gray-800 truncate">{person.name}</p>
        <p className="text-dense-tight text-gray-400 truncate">{person.title ?? person.department ?? '—'}</p>
      </div>
      <p className="text-dense-tight font-bold text-gray-500 shrink-0 whitespace-nowrap">{fmtJoined(person.dateOfJoining)}</p>
    </div>
  )
}

export default function RecentlyAddedUsers({ items, loading, onOpenUser }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body font-bold text-gray-900">Recently Added</h3>
        <UserPlus size={14} className="text-primary-400" />
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-primary-500" />
        </div>
      )}

      {!loading && (!items || items.length === 0) && (
        <div className="flex flex-col items-center py-5 gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
            <UserPlus size={14} className="text-primary-300" />
          </div>
          <p className="text-dense text-gray-400">No recent additions</p>
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="space-y-0.5">
          {items.map((person, idx) => (
            <PersonRow key={person.id} person={person} idx={idx} onClick={onOpenUser} />
          ))}
        </div>
      )}
    </div>
  )
}
