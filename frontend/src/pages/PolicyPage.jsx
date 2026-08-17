import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPolicyStats, getPolicies, uploadPolicy, downloadPolicy,
  assignPolicy, unassignPolicy, deletePolicy, getEmployees,
} from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import {
  BookOpen, Upload, Download, Trash2, Users, UserPlus,
  X, Loader2, FileText, Shield, ChevronRight, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'

// ── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_META = {
  policy:    { label: 'Policy',    color: 'bg-primary-100 text-primary-700' },
  handbook:  { label: 'Handbook',  color: 'bg-emerald-100 text-emerald-700' },
  sop:       { label: 'SOP',       color: 'bg-amber-100 text-amber-700' },
  hr_manual: { label: 'HR Manual', color: 'bg-secondary-100 text-secondary-700' },
  other:     { label: 'Other',     color: 'bg-gray-100 text-gray-600' },
}

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'policy', label: 'Policy' },
  { value: 'handbook', label: 'Handbook' },
  { value: 'sop', label: 'SOP' },
  { value: 'hr_manual', label: 'HR Manual' },
  { value: 'other', label: 'Other' },
]

function formatBytes(b) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'policy', audience: 'all' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please select a file')
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('category', form.category)
      fd.append('audience', form.audience)
      fd.append('file', file)
      await uploadPolicy(fd)
      toast.success('Policy uploaded successfully')
      onUploaded()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Upload Policy / Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input className="input" required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Employee Leave Policy 2024" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select className="input" required value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="policy">Policy</option>
                <option value="handbook">Handbook</option>
                <option value="sop">SOP</option>
                <option value="hr_manual">HR Manual</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Audience *</label>
              <select className="input" required value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
                <option value="all">All Employees</option>
                <option value="specific">Specific Employees</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">File *</label>
            <input type="file" className="input py-1.5 text-sm" required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={e => setFile(e.target.files[0])} />
            {file && (
              <p className="text-xs text-gray-500 mt-1">{file.name} — {formatBytes(file.size)}</p>
            )}
          </div>
          {form.audience === 'specific' && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              After uploading, use the "Assign to Employee" button on the card to assign specific employees.
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload size={15} />}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Assign Modal ──────────────────────────────────────────────────────────────

function AssignModal({ policy, onClose, onAssigned }) {
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(null)
  const [unassigning, setUnassigning] = useState(null)
  const [localPolicy, setLocalPolicy] = useState(policy)

  useEffect(() => {
    getEmployees({ limit: 300 }).then(r => setEmployees(r.data.employees || []))
  }, [])

  const assignedIds = new Set(localPolicy.assignments?.map(a => a.employee_id) || [])

  const filtered = search.trim()
    ? employees.filter(e =>
        `${e.name} ${e.title || ''} ${e.department || ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : employees

  const handleAssign = async (emp) => {
    setSaving(emp.id)
    try {
      const res = await assignPolicy(localPolicy.id, { employee_id: emp.id })
      setLocalPolicy(res.data)
      toast.success(`Assigned to ${emp.name}`)
      onAssigned()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign')
    } finally { setSaving(null) }
  }

  const handleUnassign = async (assignment) => {
    setUnassigning(assignment.employee_id)
    try {
      await unassignPolicy(localPolicy.id, assignment.employee_id)
      setLocalPolicy(p => ({
        ...p,
        assignments: p.assignments.filter(a => a.employee_id !== assignment.employee_id),
        assignment_count: (p.assignment_count || 1) - 1,
      }))
      toast.success('Assignment removed')
      onAssigned()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove')
    } finally { setUnassigning(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Assign Employees</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{localPolicy.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Currently assigned */}
        {localPolicy.assignments?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Currently Assigned</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {localPolicy.assignments.map(a => (
                <div key={a.employee_id} className="flex items-center justify-between bg-primary-50 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-dense-tight font-bold flex items-center justify-center">
                      {a.employee_initials || '?'}
                    </span>
                    <span className="text-sm text-gray-800">{a.employee_name}</span>
                  </div>
                  <button
                    disabled={unassigning === a.employee_id}
                    onClick={() => handleUnassign(a)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium">
                    {unassigning === a.employee_id ? <Loader2 size={12} className="animate-spin" /> : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + employee list */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="Search employees…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.slice(0, 50).map(emp => {
            const isAssigned = assignedIds.has(emp.id)
            return (
              <div key={emp.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                  <p className="text-xs text-gray-500">{emp.title}{emp.department ? ` · ${emp.department}` : ''}</p>
                </div>
                <button
                  disabled={isAssigned || saving === emp.id}
                  onClick={() => handleAssign(emp)}
                  className={clsx(
                    'text-xs font-semibold px-3 py-1 rounded-lg',
                    isAssigned
                      ? 'bg-green-100 text-green-600 cursor-default'
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  )}>
                  {saving === emp.id ? <Loader2 size={12} className="animate-spin" /> : isAssigned ? 'Assigned' : 'Assign'}
                </button>
              </div>
            )
          })}
        </div>
        <button onClick={onClose}
          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Done
        </button>
      </div>
    </div>
  )
}

// ── Policy Card ───────────────────────────────────────────────────────────────

function PolicyCard({ policy, isAdmin, onDeleted, onAssigned, onDownload }) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const cat = CATEGORY_META[policy.category] || CATEGORY_META.other

  const handleDelete = async () => {
    if (!confirm(`Delete "${policy.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deletePolicy(policy.id)
      toast.success('Policy deleted')
      onDeleted()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{policy.title}</p>
              <span className={clsx('text-dense-tight font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block', cat.color)}>
                {cat.label}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {policy.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{policy.description}</p>
        )}

        {/* File info */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <FileText size={12} />
          <span className="truncate max-w-[180px]">{policy.file_name || '—'}</span>
          <span>·</span>
          <span>{formatBytes(policy.file_size)}</span>
        </div>

        {/* Audience */}
        <div className="flex items-center gap-2">
          {policy.audience === 'all' ? (
            <button
              onClick={() => navigate('/employees')}
              className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full hover:bg-green-200 transition-colors">
              <Users size={12} />
              All Employees
              <ChevronRight size={11} />
            </button>
          ) : (
            <span className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
              <Users size={12} />
              {policy.assignment_count} Employee{policy.assignment_count !== 1 ? 's' : ''} Assigned
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <span>Uploaded {formatDate(policy.created_at)}</span>
          {policy.uploader_name && <><span>·</span><span>by {policy.uploader_name}</span></>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
          <button
            onClick={() => onDownload(policy)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 px-2 py-1 rounded-lg hover:bg-primary-50">
            <Download size={13} />
            Download
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-secondary-600 hover:text-secondary-700 px-2 py-1 rounded-lg hover:bg-secondary-50">
              <UserPlus size={13} />
              Assign to Employee
            </button>
          )}
          {isAdmin && (
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="ml-auto flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
          )}
        </div>
      </div>

      {showAssign && (
        <AssignModal
          policy={policy}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { onAssigned(); setShowAssign(false) }}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PolicyPage() {
  const { user } = useAuthStore()
  const isAdmin = isAdminRole(user)

  const [stats, setStats] = useState(null)
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [statsRes, listRes] = await Promise.all([
        getPolicyStats(),
        getPolicies(categoryFilter ? { category: categoryFilter } : {}),
      ])
      setStats(statsRes.data)
      setPolicies(listRes.data)
    } catch {
      toast.error('Failed to load policies')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [categoryFilter])

  const handleDownload = async (policy) => {
    try {
      const res = await downloadPolicy(policy.id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = policy.file_name || 'document'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download file')
    }
  }

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policy &amp; Handbook</h1>
          <p className="text-sm text-gray-500 mt-0.5">Company policies, HR manual, SOP documentation repository</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowUpload(true)}
            className="btn-primary flex items-center gap-2">
            <Upload size={16} />
            Upload Document
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total documents</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-3xl font-bold text-green-600 tabular-nums">{stats.all_employees}</p>
            <p className="text-xs text-gray-500 mt-0.5">For all employees</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-3xl font-bold text-blue-600 tabular-nums">{stats.specific}</p>
            <p className="text-xs text-gray-500 mt-0.5">Specific assignments</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-3xl font-bold text-secondary-600 tabular-nums">
              {stats.by_category?.handbook || 0}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Handbooks</p>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c.value}
            onClick={() => setCategoryFilter(c.value)}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
              categoryFilter === c.value
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
            )}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 flex flex-col items-center gap-3">
          <BookOpen size={40} className="text-gray-200" />
          <p className="text-gray-500 font-medium">No documents found</p>
          {isAdmin && (
            <button onClick={() => setShowUpload(true)}
              className="btn-primary flex items-center gap-2 mt-1">
              <Upload size={15} />
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map(p => (
            <PolicyCard
              key={p.id}
              policy={p}
              isAdmin={isAdmin}
              onDeleted={load}
              onAssigned={load}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={load} />
      )}
    </Container>
  )
}
