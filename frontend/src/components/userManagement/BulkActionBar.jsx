import React, { useState } from 'react'
import { UserCheck, UserX, ShieldCheck, Users, KeyRound, Mail, Trash2, X, Loader2, Check, ExternalLink, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  bulkUpdateUserAccess, bulkUpdateUserRole, bulkAssignManager, bulkResetPassword, bulkDeleteUsers,
} from '../../services/api'
import ManagerSearchDropdown from '../ManagerSearchDropdown'
import UserExportMenu from './UserExportMenu'
import { roleDisplayLabel } from '../../rbac/constants'

const RBAC_ROLES = ['Super Admin', 'Admin', 'Employee']

function summarizeResults(results, verbPast) {
  const ok = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success)
  if (failed.length === 0) {
    return { ok: true, message: `${ok} user${ok === 1 ? '' : 's'} ${verbPast}` }
  }
  const reasons = [...new Set(failed.map(r => r.error).filter(Boolean))].slice(0, 3)
  const reasonText = reasons.length ? ` — ${reasons.join('; ')}` : ''
  const message = ok === 0
    ? `Failed${reasonText}`
    : `${ok} ${verbPast}, ${failed.length} failed${reasonText}`
  return { ok: ok > 0, message }
}

function toastResults(results, verbPast) {
  const { ok, message } = summarizeResults(results, verbPast)
  ok ? toast.success(message) : toast.error(message)
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-widget-label font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AssignRoleModal({ count, onClose, onConfirm, loading }) {
  const [role, setRole] = useState('Employee')
  return (
    <Modal title={`Assign role to ${count} user${count === 1 ? '' : 's'}`} onClose={onClose}>
      <label className="label">Role</label>
      <select value={role} onChange={e => setRole(e.target.value)} className="input mb-4">
        {RBAC_ROLES.map(r => <option key={r} value={r}>{roleDisplayLabel(r)}</option>)}
      </select>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary text-sm" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-primary text-sm" onClick={() => onConfirm(role)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Assign'}
        </button>
      </div>
    </Modal>
  )
}

function AssignManagerModal({ count, managers, onClose, onConfirm, loading }) {
  const [managerId, setManagerId] = useState(null)
  return (
    <Modal title={`Assign manager to ${count} user${count === 1 ? '' : 's'}`} onClose={onClose}>
      <label className="label">Reporting Manager</label>
      <div className="mb-4">
        <ManagerSearchDropdown employees={managers} value={managerId} onChange={(id) => setManagerId(id)} />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary text-sm" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-primary text-sm" onClick={() => onConfirm(managerId)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Assign'}
        </button>
      </div>
    </Modal>
  )
}

function LinkRow({ name, link, emailed }) {
  const fullLink = `${window.location.origin}${link}`
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <p className="text-sm text-gray-700 mb-0.5 flex items-center gap-1.5">
        {name}
        {emailed === true && <span className="text-dense text-success-600 font-medium">· Emailed</span>}
        {emailed === false && <span className="text-dense text-error-600 font-medium">· Email failed, share the link instead</span>}
      </p>
      <a
        href={fullLink}
        target="_blank"
        rel="noopener noreferrer"
        title={fullLink}
        className="text-dense text-primary-600 hover:underline font-mono truncate flex items-center gap-1"
      >
        <ExternalLink size={11} className="shrink-0" />
        <span className="truncate">{fullLink}</span>
      </a>
    </div>
  )
}

export function ResetPasswordResultsModal({ results, onClose, title = 'Reset / invite links' }) {
  const links = results.filter(r => r.success && r.reset_link)
  const failed = results.filter(r => !r.success)
  const anyEmailAttempted = links.some(r => r.emailed !== undefined)
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-dense text-gray-400 mb-3">
        {anyEmailAttempted
          ? 'The link below was also emailed to each user directly — keep it handy in case an email doesn\'t land.'
          : 'No mail server is configured — click a link to open it, or right-click to copy the address and share it with the user manually.'}
      </p>
      <div className="max-h-72 overflow-y-auto mb-4">
        {links.map(r => <LinkRow key={r.employee_id} name={r.name} link={r.reset_link} emailed={r.emailed} />)}
        {failed.map(r => (
          <div key={r.employee_id} className="text-dense text-error-600 py-1.5">
            Employee #{r.employee_id}: {r.error}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="btn-primary text-sm" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

function PasswordRow({ name, email, password }) {
  const copy = () => {
    navigator.clipboard.writeText(password)
    toast.success('Password copied')
  }
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <p className="text-sm text-gray-700 mb-0.5">{name} <span className="text-gray-400">— {email}</span></p>
      <button onClick={copy} className="text-dense text-primary-600 hover:underline font-mono flex items-center gap-1">
        <Copy size={11} className="shrink-0" />
        {password}
      </button>
    </div>
  )
}

export function ImportResultsModal({ results, onClose }) {
  const created = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  return (
    <Modal title={`Import complete — ${created.length} created${failed.length ? `, ${failed.length} failed` : ''}`} onClose={onClose}>
      <p className="text-dense text-gray-400 mb-3">
        Each new employee got a unique temporary password — copy and share these securely
        (they won't be shown again).
      </p>
      <div className="max-h-72 overflow-y-auto mb-4">
        {created.map((r, i) => <PasswordRow key={i} name={r.name} email={r.email} password={r.temp_password} />)}
        {failed.map((r, i) => (
          <div key={i} className="text-dense text-error-600 py-1.5">
            {r.name}: {r.error}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="btn-primary text-sm" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

function DeleteConfirmModal({ count, names, onClose, onConfirm, loading }) {
  const [confirmText, setConfirmText] = useState('')
  return (
    <Modal title={`Permanently delete ${count} user${count === 1 ? '' : 's'}?`} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-2">
        This <span className="font-semibold text-error-600">cannot be undone</span>. It removes each
        employee's entire record — attendance, payroll, leave, documents, everything — not just their login.
      </p>
      <div className="max-h-32 overflow-y-auto text-dense text-gray-500 mb-3 border border-gray-100 rounded-lg p-2">
        {names.join(', ')}
      </div>
      <label className="label">Type DELETE to confirm</label>
      <input
        type="text"
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        className="input mb-4"
        placeholder="DELETE"
      />
      <div className="flex justify-end gap-2">
        <button className="btn-secondary text-sm" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          className="btn-danger text-sm"
          disabled={confirmText !== 'DELETE' || loading}
          onClick={onConfirm}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Delete permanently'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Sticky bulk-action toolbar shown when one or more User Management rows are
 * selected. Every action posts to a bulk/* endpoint (user_management.py) and
 * reports partial-success results rather than assuming all-or-nothing.
 */
export default function BulkActionBar({ selectedIds, users, filterOptions, onDone, onClear }) {
  const [modal, setModal] = useState(null) // 'role' | 'manager' | 'reset' | 'invite' | 'delete' | null
  const [loading, setLoading] = useState(false)
  const [resetResults, setResetResults] = useState(null)

  const ids = Array.from(selectedIds)
  const count = ids.length
  if (count === 0) return null

  const selectedUsers = users.filter(u => selectedIds.has(u.id))
  const managers = (filterOptions?.managers || []).map(m => ({ id: m.id, full_name: m.name }))

  const runBulk = async (fn, verbPast) => {
    setLoading(true)
    try {
      const res = await fn()
      toastResults(res.data.results, verbPast)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk action failed')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = () => runBulk(() => bulkUpdateUserAccess(ids, true), 'activated')
  const handleDeactivate = () => runBulk(() => bulkUpdateUserAccess(ids, false), 'deactivated')

  const handleAssignRole = async (role) => {
    setLoading(true)
    try {
      const res = await bulkUpdateUserRole(ids, role)
      toastResults(res.data.results, `assigned "${role}"`)
      setModal(null)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign role')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignManager = async (managerId) => {
    setLoading(true)
    try {
      const res = await bulkAssignManager(ids, managerId)
      toastResults(res.data.results, 'updated')
      setModal(null)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign manager')
    } finally {
      setLoading(false)
    }
  }

  const handleResetOrInvite = async () => {
    setLoading(true)
    try {
      const res = await bulkResetPassword(ids)
      setResetResults(res.data.results)
      setModal('reset-results')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate links')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await bulkDeleteUsers(ids)
      toastResults(res.data.results, 'deleted')
      setModal(null)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk delete failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 flex-wrap bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-lg">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Check size={16} className="text-emerald-400" /> {count} user{count === 1 ? '' : 's'} selected
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={handleActivate} disabled={loading}>
            <UserCheck size={14} /> Activate
          </button>
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={handleDeactivate} disabled={loading}>
            <UserX size={14} /> Deactivate
          </button>
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={() => setModal('role')} disabled={loading}>
            <ShieldCheck size={14} /> Assign Role
          </button>
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={() => setModal('manager')} disabled={loading}>
            <Users size={14} /> Assign Manager
          </button>
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={handleResetOrInvite} disabled={loading}>
            <KeyRound size={14} /> Reset Password
          </button>
          <UserExportMenu params={{ ids }} />
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={handleResetOrInvite} disabled={loading}>
            <Mail size={14} /> Invite
          </button>
          <button className="btn-ghost text-dense text-rose-300 hover:bg-white/10" onClick={() => setModal('delete')} disabled={loading}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="btn-ghost text-dense text-white hover:bg-white/10" onClick={onClear}>
            <X size={14} /> Clear
          </button>
        </div>
      </div>

      {modal === 'role' && (
        <AssignRoleModal count={count} onClose={() => setModal(null)} onConfirm={handleAssignRole} loading={loading} />
      )}
      {modal === 'manager' && (
        <AssignManagerModal count={count} managers={managers} onClose={() => setModal(null)} onConfirm={handleAssignManager} loading={loading} />
      )}
      {modal === 'reset-results' && resetResults && (
        <ResetPasswordResultsModal results={resetResults} onClose={() => { setModal(null); onDone() }} />
      )}
      {modal === 'delete' && (
        <DeleteConfirmModal
          count={count}
          names={selectedUsers.map(u => u.name)}
          onClose={() => setModal(null)}
          onConfirm={handleDelete}
          loading={loading}
        />
      )}
    </>
  )
}
