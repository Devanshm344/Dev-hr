import React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Users } from 'lucide-react'
import clsx from 'clsx'
import ResponsiveTable from '../ui/ResponsiveTable'
import { TABLE_HEAD_ROW, TABLE_HEAD_CELL, TABLE_CELL, TABLE_ROW_HOVER, TABLE_ROW_ZEBRA } from '../ui/tableStyles'
import RowActionsMenu from './RowActionsMenu'
import { formatDateTimeInTz } from '../../utils/timezone'
import { roleDisplayLabel } from '../../rbac/constants'

const RBAC_ROLES = ['Super Admin', 'Admin', 'Employee']

const ROLE_STYLE = {
  'Super Admin': 'bg-purple-50 text-purple-700 border-purple-200',
  Admin:         'bg-red-50 text-red-700 border-red-200',
  Employee:      'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const STATUS_STYLE = {
  active:      'bg-emerald-50 text-emerald-700',
  inactive:    'bg-gray-100 text-gray-600',
  on_leave:    'bg-yellow-50 text-yellow-700',
  terminated:  'bg-red-50 text-red-600',
}

const SORT_COLUMNS = [
  { key: 'name', label: 'Employee' },
  { key: 'department', label: 'Department' },
  { key: null, label: 'Designation' },
  { key: 'employmentType', label: 'Employment Type' },
  { key: null, label: 'Access Role' },
  { key: 'status', label: 'Status' },
  { key: null, label: 'Last Login' },
  { key: null, label: 'MFA' },
  { key: null, label: 'Login Access' },
  { key: null, label: 'Actions' },
]

function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown size={12} className="text-slate-500" />
  return dir === 'asc' ? <ArrowUp size={12} className="text-white" /> : <ArrowDown size={12} className="text-white" />
}

function formatLastLogin(iso) {
  if (!iso) return 'Never'
  const then = new Date(iso)
  const diffMs = Date.now() - then.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays < 1) {
    const diffHours = Math.floor(diffMs / 3600000)
    if (diffHours < 1) return 'Just now'
    return `${diffHours}h ago`
  }
  if (diffDays < 7) return `${diffDays}d ago`
  return then.toLocaleDateString('en-IN')
}

function HeaderCheckbox({ checked, indeterminate, onChange }) {
  const ref = React.useRef(null)
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="rounded border-gray-300 text-primary-600 focus:ring-primary-400" />
}

export default function UserTable({
  users, loading, sortBy, sortDir, onSort, currentUserId, savingRole, onRoleChange,
  savingAccess, onAccessChange, onOpenUser,
  selectedIds, onToggleSelect, onToggleSelectAll,
  disablingMfa, onDisableMfa,
  onAssignRole, onResetPassword, onSendInvitation, onViewActivity, onToggleArchive,
  resettingId, invitingId, archivingId,
}) {
  const selectableUsers = users.filter(u => u.id !== currentUserId)
  const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedIds?.has(u.id))
  const someSelected = selectableUsers.some(u => selectedIds?.has(u.id))

  return (
    <div className="card overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>No users found</p>
        </div>
      ) : (
        <ResponsiveTable>
          <table className="w-full">
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_HEAD_CELL}>
                  <HeaderCheckbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={onToggleSelectAll} />
                </th>
                {SORT_COLUMNS.map(col => (
                  <th
                    key={col.label || 'actions'}
                    className={clsx(TABLE_HEAD_CELL, col.key && 'cursor-pointer select-none')}
                    onClick={col.key ? () => onSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon active={sortBy === col.key} dir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.id === currentUserId
                const isSaving = savingRole === u.id
                return (
                  <tr
                    key={u.id}
                    className={clsx(TABLE_ROW_ZEBRA, TABLE_ROW_HOVER, 'cursor-pointer')}
                    onClick={() => onOpenUser(u.id)}
                  >
                    <td className={TABLE_CELL} onClick={e => e.stopPropagation()}>
                      {!isSelf && (
                        <input
                          type="checkbox"
                          checked={!!selectedIds?.has(u.id)}
                          onChange={() => onToggleSelect(u.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-400"
                        />
                      )}
                    </td>
                    <td className={TABLE_CELL}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm shrink-0 bg-primary-100">
                          {u.first_name?.charAt(0)}{u.last_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                            {u.name}
                            {isSelf && (
                              <span className="text-dense-tight bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-semibold">You</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={TABLE_CELL}>{u.department || '—'}</td>
                    <td className={TABLE_CELL}>{u.title || '—'}</td>
                    <td className={TABLE_CELL}>{u.employment_type || '—'}</td>
                    <td className={TABLE_CELL} onClick={e => e.stopPropagation()}>
                      {isSelf ? (
                        <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium border', ROLE_STYLE[u.role] || ROLE_STYLE.Employee)}>
                          {roleDisplayLabel(u.role)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            disabled={isSaving}
                            onChange={e => onRoleChange(u.id, e.target.value)}
                            className={clsx(
                              'text-xs px-2.5 py-1 rounded-full font-medium border cursor-pointer',
                              'focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all appearance-none pr-5',
                              isSaving ? 'opacity-60 cursor-not-allowed' : '',
                              ROLE_STYLE[u.role] || ROLE_STYLE.Employee
                            )}
                          >
                            {RBAC_ROLES.map(r => <option key={r} value={r}>{roleDisplayLabel(r)}</option>)}
                          </select>
                          {isSaving && <Loader2 size={13} className="animate-spin text-primary-500 shrink-0" />}
                        </div>
                      )}
                    </td>
                    <td className={TABLE_CELL}>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', u.is_active === false ? 'bg-rose-50 text-rose-600' : (STATUS_STYLE[u.status] || 'bg-gray-100 text-gray-600'))}>
                        {u.is_active === false ? 'Locked' : (u.status?.replace('_', ' ') || '—')}
                      </span>
                    </td>
                    <td className={TABLE_CELL}>
                      <span title={u.last_login ? `${formatDateTimeInTz(u.last_login, u.timezone)} — ${u.name}'s local time` : undefined}>
                        {formatLastLogin(u.last_login)}
                      </span>
                      {u.last_active && (
                        <p className="text-[10px] text-gray-400 mt-0.5" title={`${formatDateTimeInTz(u.last_active, u.timezone)} — ${u.name}'s local time`}>
                          Active {formatLastLogin(u.last_active)}
                        </p>
                      )}
                    </td>
                    <td className={TABLE_CELL}>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', u.mfa_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                        {u.mfa_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className={TABLE_CELL} onClick={e => e.stopPropagation()}>
                      {isSelf ? (
                        <span className="text-dense text-gray-400">—</span>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={u.is_active !== false}
                          disabled={savingAccess === u.id}
                          onClick={() => onAccessChange(u.id, !(u.is_active !== false))}
                          className={clsx(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
                            savingAccess === u.id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                            u.is_active !== false ? 'bg-success-500' : 'bg-gray-200',
                          )}
                        >
                          <span className={clsx(
                            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                            u.is_active !== false ? 'translate-x-[18px]' : 'translate-x-1',
                          )} />
                        </button>
                      )}
                    </td>
                    <td className={TABLE_CELL} onClick={e => e.stopPropagation()}>
                      <RowActionsMenu
                        user={u}
                        isSelf={isSelf}
                        busy={
                          savingAccess === u.id ? 'lock' :
                          disablingMfa === u.id ? 'mfa' :
                          archivingId === u.id ? 'archive' :
                          resettingId === u.id ? 'reset' :
                          invitingId === u.id ? 'invite' : null
                        }
                        onView={() => onOpenUser(u.id)}
                        onAssignRole={() => onAssignRole(u)}
                        onResetPassword={() => onResetPassword(u.id)}
                        onSendInvitation={() => onSendInvitation(u.id)}
                        onToggleLock={() => onAccessChange(u.id, !(u.is_active !== false))}
                        onViewActivity={() => onViewActivity(u.id)}
                        onToggleArchive={() => onToggleArchive(u.id, u.status !== 'inactive')}
                        onDisableMfa={() => onDisableMfa(u.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </div>
  )
}
