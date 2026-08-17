import React, { useEffect, useRef, useState } from 'react'
import {
  MoreVertical, Eye, ShieldCheck, KeyRound, Mail, Lock, Unlock,
  Activity, Archive, ArchiveRestore, ShieldOff, Loader2,
} from 'lucide-react'
import clsx from 'clsx'

function MenuItem({ icon: Icon, label, onClick, danger, loading, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50',
        danger ? 'text-rose-600' : 'text-gray-700'
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Icon size={14} className="shrink-0" />}
      {label}
    </button>
  )
}

function IconButton({ icon: Icon, title, onClick, loading, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onClick={onClick}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
    </button>
  )
}

/**
 * Per-row actions: a couple of frequent ones (View, Reset Password) sit as
 * always-visible icon buttons, everything else lives behind the "⋮" overflow
 * menu — most of it reuses handlers/endpoints that already exist elsewhere
 * (bulk endpoints called with a single id, the same access-toggle and
 * disable-MFA handlers already wired in UserManagementPage), only "archive"
 * is a genuinely new action.
 */
export default function RowActionsMenu({
  user, isSelf, busy,
  onView, onAssignRole, onResetPassword, onSendInvitation,
  onToggleLock, onViewActivity, onToggleArchive, onDisableMfa,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const isLocked = user.is_active === false
  const isArchived = user.status === 'inactive'

  const run = (fn) => { setOpen(false); fn() }

  return (
    <div className="flex items-center justify-end gap-1">
      <IconButton icon={Eye} title="View User" onClick={onView} />
      {!isSelf && (
        <IconButton icon={KeyRound} title="Reset Password" loading={busy === 'reset'} onClick={onResetPassword} />
      )}
      <div className="relative inline-block" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          <MoreVertical size={16} />
        </button>

        {open && (
          <div className="absolute right-0 z-30 mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-lg py-1">
            <MenuItem icon={Activity} label="View Activity" onClick={() => run(onViewActivity)} />
            {!isSelf && (
              <>
                <MenuItem icon={ShieldCheck} label="Assign Role" onClick={() => run(onAssignRole)} />
                <MenuItem icon={Mail} label="Send Invitation" loading={busy === 'invite'} onClick={() => run(onSendInvitation)} />
                <MenuItem
                  icon={isLocked ? Unlock : Lock}
                  label={isLocked ? 'Unlock Account' : 'Lock Account'}
                  loading={busy === 'lock'}
                  onClick={() => run(onToggleLock)}
                />
                <MenuItem
                  icon={isArchived ? ArchiveRestore : Archive}
                  label={isArchived ? 'Unarchive User' : 'Archive User'}
                  loading={busy === 'archive'}
                  onClick={() => run(onToggleArchive)}
                />
                {user.mfa_enabled && (
                  <MenuItem icon={ShieldOff} label="Disable MFA" danger loading={busy === 'mfa'} onClick={() => run(onDisableMfa)} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
