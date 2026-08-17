import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, Monitor, Cloud, Globe, Paperclip, Loader2, Search, ChevronDown, X } from 'lucide-react'
import { applyLeave, uploadLeaveAttachment, getLeaveTypes, getLeavePreview } from '../../services/api'
import toast from 'react-hot-toast'
import LeaveSummaryCard from './LeaveSummaryCard'

function formatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-')
}

function DateField({ value, onChange, placeholder = 'dd-MMM-yyyy', min, error }) {
  const hiddenRef = useRef(null)

  const trigger = () => {
    if (!hiddenRef.current) return
    if (hiddenRef.current.showPicker) {
      hiddenRef.current.showPicker()
    } else {
      hiddenRef.current.click()
    }
  }

  return (
    <div
      className={`relative flex items-center border rounded-md px-3 py-2 cursor-pointer bg-white transition-colors
        ${error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'}`}
      onClick={trigger}
    >
      <span className={`flex-1 text-sm select-none ${value ? 'text-gray-800' : 'text-gray-400'}`}>
        {formatDate(value) || placeholder}
      </span>
      <Calendar size={15} className="text-gray-400 flex-shrink-0" />
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        min={min}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  )
}

function SearchableSelect({ options, value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const searchRef = useRef(null)

  const selected = options.find(o => String(o.id) === String(value))
  const filtered = useMemo(
    () => options.filter(o => o.name.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  )

  useEffect(() => {
    if (!open) { setQuery(''); return }
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-white text-left transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500
          ${error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.name : 'Select'}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${!value ? 'bg-gray-50 text-gray-500' : 'text-gray-700'}`}
              >
                Select
              </button>
            </li>
            {filtered.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => { onChange(String(o.id)); setOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors
                    ${String(o.id) === String(value) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800'}`}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-2 text-sm text-gray-400">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = { leave_type_id: '', start_date: '', end_date: '', day_part: 'full', team_email: '', reason: '' }

// Reusable Apply Leave form — shared by any surface (currently the full-page
// /leave/apply route) that needs to submit a leave request. Contains all
// business logic (validation, file upload, submit) so callers only need to
// supply leave types + initial dates and handle success/cancel navigation.
export default function ApplyLeaveForm({ leaveTypes: leaveTypesProp = [], initialDates, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    start_date: initialDates?.start ?? '',
    end_date: initialDates?.end ?? '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [leaveTypes, setLeaveTypes] = useState(leaveTypesProp)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch leave types from API if the parent hasn't already supplied them (self-contained, no hardcoding)
  useEffect(() => {
    if (leaveTypesProp.length > 0) {
      setLeaveTypes(leaveTypesProp)
      return
    }
    getLeaveTypes()
      .then(res => setLeaveTypes(res.data || []))
      .catch(() => toast.error('Could not load leave types'))
  }, [leaveTypesProp])

  // Debounced Leave Preview call — the backend is the single source of truth
  // for balance math; this component never computes it locally.
  useEffect(() => {
    if (!form.leave_type_id || !form.start_date || !form.end_date || form.end_date < form.start_date) {
      setPreview(null)
      return
    }
    setPreviewLoading(true)
    const handle = setTimeout(() => {
      getLeavePreview({
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        day_part: form.day_part,
      })
        .then(res => setPreview(res.data))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [form.leave_type_id, form.start_date, form.end_date, form.day_part])

  const validate = () => {
    const errs = {}
    if (!form.leave_type_id) errs.leave_type_id = 'Leave type is required'
    if (!form.start_date) errs.start_date = 'Start date is required'
    if (!form.end_date) errs.end_date = 'End date is required'
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      errs.end_date = 'End date cannot be before start date'
    if (form.team_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.team_email))
      errs.team_email = 'Enter a valid email address'
    if (file && file.size > 5 * 1024 * 1024)
      errs.file = 'File size must be under 5 MB'
    return errs
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5 MB.')
      e.target.value = ''
      return
    }
    setFile(f)
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (preview && !preview.allow_apply) { toast.error(preview.message || 'This leave request cannot be submitted.'); return }
    setSaving(true)
    try {
      let attachment_url = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadLeaveAttachment(fd)
        attachment_url = res.data.file_url
      }
      await applyLeave({
        leave_type_id: parseInt(form.leave_type_id),
        start_date: form.start_date,
        end_date: form.end_date,
        day_part: form.day_part,
        reason: form.reason || null,
        team_email: form.team_email || null,
        attachment_url,
      })
      toast.success('Leave request submitted!')
      onSuccess?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit leave request')
    } finally {
      setSaving(false)
    }
  }

  const isSingleDay = form.start_date && form.end_date && form.start_date === form.end_date
  const exceeded = preview && !preview.allow_apply

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <p className="text-sm font-semibold text-gray-900">Leave</p>

        {/* Leave Type */}
        <div>
          <label className="block text-sm text-gray-700 mb-1.5">
            Leave type <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={leaveTypes}
            value={form.leave_type_id}
            onChange={v => {
              setForm(f => ({ ...f, leave_type_id: v }))
              setErrors(errs => ({ ...errs, leave_type_id: undefined }))
            }}
            error={errors.leave_type_id}
          />
          {errors.leave_type_id && <p className="text-xs text-red-500 mt-1">{errors.leave_type_id}</p>}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm text-gray-700 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <DateField
                value={form.start_date}
                onChange={v => {
                  setForm(f => {
                    const end_date = f.end_date < v ? '' : f.end_date
                    return { ...f, start_date: v, end_date, day_part: end_date === v ? f.day_part : 'full' }
                  })
                  setErrors(errs => ({ ...errs, start_date: undefined }))
                }}
                error={errors.start_date}
              />
              {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date}</p>}
            </div>
            <div>
              <DateField
                value={form.end_date}
                onChange={v => {
                  setForm(f => ({ ...f, end_date: v, day_part: v === f.start_date ? f.day_part : 'full' }))
                  setErrors(errs => ({ ...errs, end_date: undefined }))
                }}
                min={form.start_date || undefined}
                error={errors.end_date}
              />
              {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date}</p>}
            </div>
          </div>

          {isSingleDay && (
            <div className="flex items-center gap-2 mt-2.5">
              {['full', 'half'].map(part => (
                <button
                  key={part}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, day_part: part }))}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors
                    ${form.day_part === part ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {part === 'full' ? 'Full Day' : 'Half Day'}
                </button>
              ))}
            </div>
          )}

          {exceeded && <p className="text-xs text-red-500 mt-2">{preview.message}</p>}
        </div>

        {/* Team Email ID */}
        <div>
          <label className="block text-sm text-gray-700 mb-1.5">Team Email ID</label>
          <input
            type="text"
            value={form.team_email}
            onChange={e => {
              setForm(f => ({ ...f, team_email: e.target.value }))
              setErrors(errs => ({ ...errs, team_email: undefined }))
            }}
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors
              ${errors.team_email ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.team_email && <p className="text-xs text-red-500 mt-1">{errors.team_email}</p>}
        </div>

        {/* Reason for leave */}
        <div>
          <label className="block text-sm text-gray-700 mb-1.5">Reason for leave</label>
          <textarea
            rows={4}
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
          />
        </div>

        {/* Info note */}
        <p className="text-xs text-gray-600 leading-relaxed">
          Please note that you may apply for leaves against the leave balance available.&nbsp;
          Contact{' '}
          <a href="mailto:hr@techdemocracy.com" className="text-blue-500 hover:underline">
            hr@techdemocracy.com
          </a>{' '}
          for any further clarifications.
        </p>

        {/* File Upload */}
        <div>
          <label className="block text-sm text-gray-700 mb-1.5">File upload</label>
          <div
            className={`border rounded-md py-4 px-3 text-center cursor-pointer transition-colors
              ${errors.file ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                <Paperclip size={13} className="text-blue-500 flex-shrink-0" />
                <span className="truncate max-w-sm">{file.name}</span>
                <button
                  type="button"
                  onClick={ev => { ev.stopPropagation(); setFile(null) }}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  aria-label="Remove file"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                Upload from{' '}
                <span className="text-blue-500 font-medium inline-flex items-center gap-1">
                  <Monitor size={12} /> Desktop
                </span>
                {' / '}
                <span className="text-blue-500 font-medium inline-flex items-center gap-1">
                  <Cloud size={12} /> Zoho WorkDrive
                </span>
                {' / '}
                <span className="text-blue-500 font-medium inline-flex items-center gap-1">
                  <Globe size={12} /> Others
                </span>
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Max. size is 5 MB</p>
          {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file}</p>}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <LeaveSummaryCard preview={preview} loading={previewLoading} asOf={form.start_date || undefined} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-5">
        <button
          type="submit"
          disabled={saving || exceeded}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Submit
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
