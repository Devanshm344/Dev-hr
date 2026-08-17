import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Laptop, Plus, X, AlertCircle, Loader2,
  Eye, Pencil, Ban, Paperclip, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createAssetTicket, getMyAssetTickets, getAllAssetTickets, getAssetTicket,
  updateAssetTicket, cancelAssetTicket, updateTicketStatus,
  getTicketDepartments, getTicketServiceTypes, getTicketClassifications,
  uploadTicketAttachment,
} from '../services/api'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'

const NEXT_STATUSES = {
  open:        ['in_progress', 'cancelled'],
  in_progress: ['pending', 'resolved', 'cancelled'],
  pending:     ['in_progress', 'resolved', 'cancelled'],
  resolved:    ['closed', 'in_progress'],
}

// ── Status / Priority config ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: 'Open',        cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:     { label: 'Pending',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  resolved:    { label: 'Resolved',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed:      { label: 'Closed',      cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600 border-red-200' },
}

const PRIORITY_CONFIG = {
  low:      { label: 'Low',      cls: 'bg-gray-50 text-gray-500' },
  medium:   { label: 'Medium',   cls: 'bg-blue-50 text-blue-600' },
  high:     { label: 'High',     cls: 'bg-amber-50 text-amber-600' },
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-600 font-semibold' },
}

const TICKET_DEPARTMENTS = new Set([
  'IT Support',
  'HR and Immigration',
  'Finance',
  'CSOC',
  'Design & UX Team',
  'FMMS Support',
])

const EMPTY_FORM = {
  department_id: '',
  service_type: '',
  classification: '',
  subject: '',
  description: '',
  priority: 'medium',
  cc_emails: [],
}

const fmtDate = (dt) =>
  dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = (dt) =>
  dt ? new Date(dt).toLocaleString('en-IN') : '—'

// ── Rich Text Editor ──────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange, placeholder = 'Enter description…', disabled = false }) {
  const editorRef = useRef(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const skipSync = useRef(false)

  // Sync external value into DOM only when not currently typing
  useEffect(() => {
    if (editorRef.current && !skipSync.current) {
      const current = editorRef.current.innerHTML
      if (value !== current) {
        editorRef.current.innerHTML = value || ''
        setIsEmpty(!(editorRef.current.innerText || '').trim())
      }
    }
  }, [value])

  const exec = (cmd) => {
    if (disabled) return
    document.execCommand(cmd, false, null)
    editorRef.current?.focus()
    flush()
  }

  const flush = () => {
    skipSync.current = true
    const html  = editorRef.current?.innerHTML || ''
    const plain = editorRef.current?.innerText || ''
    setIsEmpty(!plain.trim())
    onChange(html)
    requestAnimationFrame(() => { skipSync.current = false })
  }

  const btnBase = 'flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 transition-colors text-xs'

  return (
    <div className={`border rounded-lg overflow-hidden ${disabled ? 'bg-gray-50 opacity-60' : 'focus-within:ring-2 focus-within:ring-primary-300 focus-within:border-primary-300'} border-gray-200`}>
      {!disabled && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
          {[
            { title: 'Bold',      label: <strong>B</strong>, cmd: 'bold',      w: 'w-7 h-7' },
            { title: 'Italic',    label: <em>I</em>,         cmd: 'italic',    w: 'w-7 h-7' },
            { title: 'Underline', label: <u>U</u>,           cmd: 'underline', w: 'w-7 h-7' },
          ].map(({ title, label, cmd, w }) => (
            <button key={cmd} type="button" title={title}
              onMouseDown={(e) => { e.preventDefault(); exec(cmd) }}
              className={`${btnBase} ${w}`}>
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button type="button" title="Bullet List"
            onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }}
            className={`${btnBase} px-2 h-7`}>• List</button>
          <button type="button" title="Numbered List"
            onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList') }}
            className={`${btnBase} px-2 h-7`}>1. List</button>
        </div>
      )}
      <div className="relative">
        {isEmpty && (
          <div className="absolute inset-0 p-3 text-sm text-gray-400 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={flush}
          className="min-h-[100px] max-h-56 overflow-y-auto p-3 text-sm focus:outline-none"
        />
      </div>
    </div>
  )
}

// ── Email Tag Input ───────────────────────────────────────────────────────────

function EmailTagInput({ value = [], onChange, disabled = false }) {
  const [raw, setRaw]   = useState('')
  const [err, setErr]   = useState('')
  const inputRef        = useRef(null)

  const addEmail = (email) => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setErr('Invalid email address'); return }
    if (value.includes(trimmed)) { setErr('Already added'); setRaw(''); return }
    onChange([...value, trimmed])
    setRaw('')
    setErr('')
  }

  const removeEmail = (email) => onChange(value.filter(e => e !== email))

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(raw) }
    else if (e.key === 'Backspace' && !raw && value.length > 0) removeEmail(value[value.length - 1])
  }

  return (
    <div>
      <div
        className={`min-h-[42px] flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg ${
          disabled ? 'bg-gray-50' : 'focus-within:ring-2 focus-within:ring-primary-300 cursor-text'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(email => (
          <span key={email} className="flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
            {email}
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); removeEmail(email) }}
                className="ml-0.5 hover:text-red-500 leading-none">×</button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={raw}
            onChange={e => { setRaw(e.target.value); setErr('') }}
            onKeyDown={handleKeyDown}
            onBlur={() => addEmail(raw)}
            placeholder={value.length === 0 ? 'Add email and press Enter…' : ''}
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
          />
        )}
        {disabled && value.length === 0 && <span className="text-gray-400 text-sm">None</span>}
      </div>
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      {!disabled && <p className="text-xs text-gray-400 mt-0.5">Press Enter or comma to add</p>}
    </div>
  )
}

// ── View Modal ────────────────────────────────────────────────────────────────

function ViewModal({ ticket, onClose }) {
  if (!ticket) return null
  const status   = STATUS_CONFIG[ticket.status]   || STATUS_CONFIG.open
  const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-start justify-between p-5 border-b border-gray-100 z-10">
          <div>
            <p className="text-xs font-mono font-semibold text-primary-500">{ticket.ticket_number}</p>
            <h2 className="font-bold text-gray-900 mt-0.5 text-lg">{ticket.subject}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${status.cls}`}>
              {status.label}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${priority.cls}`}>
              {priority.label} Priority
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Department',    val: ticket.department_name || '—' },
              { label: 'Service Type',  val: ticket.service_type    || '—' },
              { label: 'Classification',val: ticket.classification  || '—' },
              { label: 'Created',       val: fmtDateTime(ticket.created_at) },
              { label: 'Last Updated',  val: fmtDateTime(ticket.updated_at) },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-dense font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-gray-700 mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          {/* CC */}
          {ticket.cc_emails?.length > 0 && (
            <div>
              <p className="text-dense font-semibold text-gray-400 uppercase tracking-wider mb-1.5">CC</p>
              <div className="flex flex-wrap gap-1.5">
                {ticket.cc_emails.map(e => (
                  <span key={e} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-dense font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</p>
            <div
              className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: ticket.description }}
            />
          </div>

          {/* Attachments */}
          {ticket.attachments?.length > 0 && (
            <div>
              <p className="text-dense font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Attachments ({ticket.attachments.length})
              </p>
              <div className="space-y-1.5">
                {ticket.attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg text-sm">
                    <Paperclip size={13} className="text-gray-400 shrink-0" />
                    <span className="text-gray-700 flex-1 truncate">{a.file_name}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {a.file_size ? `${(a.file_size / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status History */}
          {ticket.status_history?.length > 0 && (
            <div>
              <p className="text-dense font-semibold text-gray-400 uppercase tracking-wider mb-2">Activity</p>
              <div className="space-y-2">
                {ticket.status_history.map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-xs text-gray-500">
                    <Clock size={11} className="mt-0.5 shrink-0 text-gray-400" />
                    <div>
                      <span className="text-gray-700">
                        {h.remarks || `${h.old_status ? h.old_status + ' → ' : ''}${h.new_status}`}
                      </span>
                      {h.changer_name && (
                        <span className="text-gray-400"> · by {h.changer_name}</span>
                      )}
                      {h.changed_at && (
                        <span className="text-gray-400"> · {fmtDateTime(h.changed_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add / Edit Ticket Modal ───────────────────────────────────────────────────

function TicketModal({ mode, ticket, departments, serviceTypes, classifications, onClose, onSuccess }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(
    isEdit && ticket
      ? {
          department_id:  ticket.department_id  || '',
          service_type:   ticket.service_type   || '',
          classification: ticket.classification || '',
          subject:        ticket.subject        || '',
          description:    ticket.description    || '',
          priority:       ticket.priority       || 'medium',
          cc_emails:      ticket.cc_emails      || [],
        }
      : { ...EMPTY_FORM }
  )

  const [files, setFiles]         = useState([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef              = useRef(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const validate = () => {
    if (!form.department_id)      { toast.error('Department is required');        return false }
    if (!form.service_type)       { toast.error('Service Request Type is required'); return false }
    if (!form.subject.trim())     { toast.error('Subject is required');            return false }
    const plain = new DOMParser()
      .parseFromString(form.description, 'text/html')
      .body?.innerText?.trim()
    if (!plain) { toast.error('Description is required'); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? parseInt(form.department_id, 10) : null,
        service_type:   form.service_type   || null,
        classification: form.classification || null,
      }

      let ticketId
      if (isEdit) {
        await updateAssetTicket(ticket.id, payload)
        ticketId = ticket.id
        toast.success('Ticket updated successfully')
      } else {
        const res = await createAssetTicket(payload)
        ticketId  = res.data.id
        toast.success(`Ticket ${res.data.ticket_number} created successfully`)
      }

      // Upload attachments sequentially
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        try {
          await uploadTicketAttachment(ticketId, fd)
        } catch {
          toast.error(`Failed to upload ${file.name}`)
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} ticket`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelect = (e) => {
    const picked = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent bg-white'
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-start justify-between p-5 border-b border-gray-100 z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">
              {isEdit ? 'Edit Ticket' : 'Submit a Ticket'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update your existing ticket' : 'Fill in the details to create a new support ticket'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">

          {/* ── Section 1: Ticket Information ── */}
          <div>
            <p className="text-dense font-bold text-gray-400 uppercase tracking-wider mb-4">
              Ticket Information
            </p>
            <div className="space-y-4">

              {/* CC */}
              <div>
                <label className={labelCls}>
                  Secondary Contacts (CC)
                  <span className="font-normal text-gray-400 ml-1">— Optional</span>
                </label>
                <EmailTagInput value={form.cc_emails} onChange={v => set('cc_emails', v)} />
              </div>

              {/* Department + Service Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Department <span className="text-red-500">*</span></label>
                  <select
                    value={form.department_id}
                    onChange={e => set('department_id', e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">Select department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Service Request Type <span className="text-red-500">*</span></label>
                  <select
                    value={form.service_type}
                    onChange={e => set('service_type', e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className={labelCls}>Subject <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => set('subject', e.target.value)}
                  placeholder="Brief summary of your request"
                  maxLength={500}
                  className={fieldCls}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description <span className="text-red-500">*</span></label>
                <RichTextEditor
                  value={form.description}
                  onChange={v => set('description', v)}
                  placeholder="Describe your request in detail…"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ── Section 2: Additional Information ── */}
          <div>
            <p className="text-dense font-bold text-gray-400 uppercase tracking-wider mb-4">
              Additional Information
            </p>
            <div className="space-y-4">

              {/* Priority + Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => set('priority', e.target.value)}
                    className={fieldCls}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium (Default)</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Classification</label>
                  <select
                    value={form.classification}
                    onChange={e => set('classification', e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">Select classification</option>
                    {classifications.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Attachments (only on create) */}
              {!isEdit && (
                <div>
                  <label className={labelCls}>
                    Attachments
                    <span className="font-normal text-gray-400 ml-1">— Optional</span>
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all"
                  >
                    <Paperclip size={18} className="mx-auto text-gray-400 mb-1.5" />
                    <p className="text-xs text-gray-500 font-medium">Click to add files</p>
                    <p className="text-dense-tight text-gray-400 mt-0.5">
                      PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG · Max 10 MB each
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Paperclip size={12} className="text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
                          <span className="text-dense-tight text-gray-400 shrink-0">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                          <button type="button" onClick={() => removeFile(i)}
                            className="text-gray-400 hover:text-red-500 transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: BRAND_GRADIENT }}
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? 'Update Ticket' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Ticket Table Row ──────────────────────────────────────────────────────────

function TicketRow({ ticket, view, onView, onEdit, onCancel, onStatusChange, changingStatus }) {
  const status   = STATUS_CONFIG[ticket.status]    || STATUS_CONFIG.open
  const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium
  const nextOptions = NEXT_STATUSES[ticket.status] || []

  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      <td className="py-3 px-4 text-xs font-mono font-semibold text-primary-600 whitespace-nowrap">
        {ticket.ticket_number}
      </td>
      <td className="py-3 px-4 max-w-[200px]">
        <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
        {view === 'all' && ticket.employee_name && (
          <p className="text-xs text-gray-400 truncate">{ticket.employee_name}</p>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
        {ticket.department_name || '—'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap max-w-[160px]">
        <span className="truncate block">{ticket.service_type || '—'}</span>
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-dense font-medium ${priority.cls}`}>
          {priority.label}
        </span>
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        {view === 'all' && nextOptions.length > 0 ? (
          <select
            value=""
            disabled={changingStatus === ticket.id}
            onChange={e => e.target.value && onStatusChange(ticket, e.target.value)}
            className={`text-dense font-medium rounded-full border pl-2 pr-6 py-0.5 cursor-pointer ${status.cls}`}
          >
            <option value="">{status.label}</option>
            {nextOptions.map(s => (
              <option key={s} value={s}>→ {STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
        ) : (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-dense font-medium border ${status.cls}`}>
            {status.label}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">
        {fmtDate(ticket.created_at)}
      </td>
      <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">
        {fmtDate(ticket.updated_at || ticket.created_at)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(ticket)}
            title="View"
            className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
          >
            <Eye size={14} />
          </button>
          {view !== 'all' && ticket.status === 'open' && (
            <>
              <button
                onClick={() => onEdit(ticket)}
                title="Edit"
                className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onCancel(ticket)}
                title="Cancel Ticket"
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Ban size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetRequisitionPage() {
  const { user } = useAuthStore()
  const isAdmin = isAdminRole(user)
  const [view, setView]                       = useState('mine') // 'mine' | 'all' (admin only)
  const [tickets, setTickets]                 = useState([])
  const [departments, setDepartments]         = useState([])
  const [serviceTypes, setServiceTypes]       = useState([])
  const [classifications, setClassifications] = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)
  const [changingStatus, setChangingStatus]   = useState(null)

  // modal state: null | 'add' | 'edit' | 'view'
  const [modal, setModal]     = useState(null)
  const [selected, setSelected] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [ticketsRes, deptsRes, svcRes, classRes] = await Promise.all([
        view === 'all' ? getAllAssetTickets() : getMyAssetTickets(),
        getTicketDepartments(),
        getTicketServiceTypes(),
        getTicketClassifications(),
      ])
      setTickets(ticketsRes.data)
      setDepartments(deptsRes.data.filter(d => TICKET_DEPARTMENTS.has(d.name)))
      setServiceTypes(svcRes.data)
      setClassifications(classRes.data)
    } catch {
      setError('Failed to load asset requisitions')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleStatusChange = async (ticket, newStatus) => {
    let remarks
    if (newStatus === 'cancelled') {
      remarks = window.prompt('Reason for cancelling this ticket (optional):') || undefined
    }
    setChangingStatus(ticket.id)
    try {
      await updateTicketStatus(ticket.id, { status: newStatus, remarks })
      toast.success(`Ticket moved to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update ticket status')
    } finally {
      setChangingStatus(null)
    }
  }

  const handleView = async (ticket) => {
    try {
      const { data } = await getAssetTicket(ticket.id)
      setSelected(data)
      setModal('view')
    } catch {
      toast.error('Failed to load ticket details')
    }
  }

  const handleEdit = (ticket) => {
    setSelected(ticket)
    setModal('edit')
  }

  const handleCancel = async (ticket) => {
    if (!window.confirm(`Cancel ticket ${ticket.ticket_number}? This cannot be undone.`)) return
    try {
      await cancelAssetTicket(ticket.id)
      toast.success('Ticket cancelled')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel ticket')
    }
  }

  const closeModal = () => { setModal(null); setSelected(null) }

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: BRAND_GRADIENT }}
          >
            <Laptop size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asset Requisition</h1>
            <p className="text-xs text-gray-500">Request equipment and assets you need</p>
          </div>
        </div>

        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
          style={{ background: BRAND_GRADIENT }}
        >
          <Plus size={16} /> Add Ticket
        </button>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {[['mine', 'My Tickets'], ['all', 'All Tickets']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === v ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
              }`}
              style={view === v ? { background: BRAND_GRADIENT } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Laptop size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No tickets yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Ticket" to submit a new asset request</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {[
                    'Ticket #', 'Subject', 'Department', 'Service Type',
                    'Priority', 'Status', 'Created', 'Updated', '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-dense font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    view={view}
                    onView={handleView}
                    onEdit={handleEdit}
                    onCancel={handleCancel}
                    onStatusChange={handleStatusChange}
                    changingStatus={changingStatus}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal === 'add' || modal === 'edit') && (
        <TicketModal
          mode={modal}
          ticket={modal === 'edit' ? selected : null}
          departments={departments}
          serviceTypes={serviceTypes}
          classifications={classifications}
          onClose={closeModal}
          onSuccess={fetchAll}
        />
      )}

      {modal === 'view' && selected && (
        <ViewModal ticket={selected} onClose={closeModal} />
      )}
    </Container>
  )
}
