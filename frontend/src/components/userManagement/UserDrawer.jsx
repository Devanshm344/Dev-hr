import React, { useEffect, useState } from 'react'
import { X, Loader2, Clock } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { getUserDetail, getUserActivity } from '../../services/api'
import { BRAND_GRADIENT } from '../../theme/colors'
import { formatDateTimeInTz } from '../../utils/timezone'
import { roleDisplayLabel } from '../../rbac/constants'

const TABS = ['Overview', 'Activity']

function KV({ label, value }) {
  return (
    <div>
      <p className="text-dense-tight text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

/**
 * Read-only detail drawer (Overview + Activity). Row-level actions (lock,
 * archive, reset password, assign role/manager, disable MFA) live in
 * RowActionsMenu instead of here, so this stays a pure viewer. `tab` is
 * controlled by the parent so "View Activity" can open the drawer straight
 * to the Activity tab.
 */
export default function UserDrawer({ userId, tab = 0, onTabChange, onClose }) {
  const [user, setUser] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getUserDetail(userId), getUserActivity(userId)])
      .then(([u, a]) => { setUser(u.data); setActivity(a.data) })
      .catch(() => toast.error('Failed to load user details'))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="px-6 py-5 shrink-0" style={{ background: BRAND_GRADIENT }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-white font-bold shrink-0">
                {user ? `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}` : '…'}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold truncate">{user?.name || 'Loading…'}</p>
                <p className="text-white/70 text-xs truncate">{user?.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex border-b shrink-0 px-6">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => onTabChange?.(i)}
              className={clsx(
                'px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === i ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-primary-600" />
            </div>
          ) : tab === 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <KV label="Employee ID" value={user?.employee_id} />
                <KV label="Access Role" value={user?.role ? roleDisplayLabel(user.role) : undefined} />
                <KV label="Department" value={user?.department} />
                <KV label="Designation" value={user?.title} />
                <KV label="Employment Type" value={user?.employment_type} />
                <KV label="Office Location" value={user?.work_location} />
                <KV label="Reporting Manager" value={user?.reporting_manager_name} />
                <KV label="Joined" value={user?.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString('en-IN') : '—'} />
                <KV label="Employment Status" value={user?.status?.replace('_', ' ')} />
                <KV label="Login Access" value={user?.is_active === false ? 'Locked' : 'Enabled'} />
                <KV label="Timezone" value={user?.timezone} />
                <KV label="Last Login" value={user?.last_login ? `${formatDateTimeInTz(user.last_login, user.timezone)} (their local time)` : 'Never'} />
                <KV label="Last Active" value={user?.last_active ? `${formatDateTimeInTz(user.last_active, user.timezone)} (their local time)` : '—'} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No recorded activity yet.</p>
              ) : (
                <div className="relative pl-5">
                  <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200" />
                  {activity.map(a => (
                    <div key={a.id} className="relative pb-5">
                      <div className="absolute -left-3.5 top-1 w-2.5 h-2.5 rounded-full bg-primary-500" />
                      <p className="text-sm text-gray-800 font-medium">{a.detail || a.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock size={11} />
                        {a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN') : '—'}
                        {a.actor && <span>· by {a.actor}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
