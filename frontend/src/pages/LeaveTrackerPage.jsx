import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { canAccess } from '../rbac/constants'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, User, Calendar, Clock, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Plus, Trash2, ChevronDown, ChevronUp,
  AlertCircle, BarChart2, Briefcase, RefreshCw, Edit2, Home,
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { fmtDays } from '../utils/leave'
import {
  ltSearchEmployees, ltGetEmployeeSummary, ltGetEmployeeBalance,
  ltUpdateEmployeeBalance, ltGetEmployeeRequests,
  ltGetAllRequests, ltGetCompRequests, ltApproveRequest,
  ltGetHolidays, ltCreateHoliday, ltDeleteHoliday,
  ltGetLeaveTypes, ltUpdateLeaveType, ltGetMetrics,
  ltGetEnablementRequests, ltDecideEnablement,
} from '../services/api'
import Container from '../components/ui/Container'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'user-ops',        label: 'User-specific Operations' },
  { id: 'leave-requests',  label: 'Leave Requests' },
  { id: 'comp-requests',   label: 'Compensatory Requests' },
  { id: 'enablement',      label: 'Enablement Requests' },
  { id: 'holidays',        label: 'Holidays' },
  { id: 'customize-bal',   label: 'Customize Balance' },
  { id: 'customize-pol',   label: 'Customize Policy' },
]

const STATUS_COLORS = {
  pending:   'bg-yellow-50 text-yellow-700 border border-yellow-200',
  approved:  'bg-green-50  text-green-700  border border-green-200',
  rejected:  'bg-red-50    text-red-700    border border-red-200',
  cancelled: 'bg-gray-50   text-gray-500   border border-gray-200',
}

const HOLIDAY_TYPE_COLORS = {
  public:     'bg-blue-50   text-blue-700   border border-blue-200',
  optional:   'bg-secondary-50 text-secondary-700 border border-secondary-200',
  restricted: 'bg-orange-50 text-orange-700 border border-orange-200',
}

const REGIONS = ['India', 'United States', 'Canada']
const REGION_COLORS = {
  India:            'bg-purple-50 text-purple-700 border border-purple-200',
  'United States':  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Canada:           'bg-rose-50   text-rose-700   border border-rose-200',
}

const BALANCE_PALETTE = [
  { border: 'border-t-blue-400',   num: 'text-blue-600',   icon: 'text-blue-400',   bar: 'bg-blue-400'   },
  { border: 'border-t-cyan-400',   num: 'text-cyan-600',   icon: 'text-cyan-400',   bar: 'bg-cyan-400'   },
  { border: 'border-t-amber-400',  num: 'text-amber-600',  icon: 'text-amber-400',  bar: 'bg-amber-400'  },
  { border: 'border-t-emerald-400', num: 'text-emerald-600', icon: 'text-emerald-400', bar: 'bg-emerald-400' },
  { border: 'border-t-pink-400',   num: 'text-pink-600',   icon: 'text-pink-400',   bar: 'bg-pink-400'   },
  { border: 'border-t-red-400',    num: 'text-red-600',    icon: 'text-red-400',    bar: 'bg-red-400'    },
  { border: 'border-t-teal-400',   num: 'text-teal-600',   icon: 'text-teal-400',   bar: 'bg-teal-400'   },
  { border: 'border-t-orange-400', num: 'text-orange-600', icon: 'text-orange-400', bar: 'bg-orange-400' },
]

function getLeaveTypeIcon(name = '') {
  const n = name.toLowerCase()
  if (n.includes('travel') || n.includes('business')) return Briefcase
  if (n.includes('comp') || n.includes('co')) return Clock
  if (n.includes('sick') || n.includes('medical')) return AlertCircle
  if (n.includes('wfh') || n.includes('work from home') || n.includes('home')) return Home
  if (n.includes('loss') || n.includes('lop')) return XCircle
  return Calendar
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[status] || STATUS_COLORS.cancelled)}>
      {status}
    </span>
  )
}

function kpiItemsFromMetrics(metrics, periodLabel = 'This Month') {
  const suffix = periodLabel ? ` ${periodLabel}` : ''
  return [
    { label: 'Pending Requests', value: metrics.total_pending, color: 'text-yellow-600', dot: 'bg-yellow-500' },
    { label: `Approved${suffix}`, value: metrics.approved, color: 'text-green-600', dot: 'bg-green-500', live: true },
    { label: `Rejected${suffix}`, value: metrics.rejected, color: 'text-red-600', dot: 'bg-red-500' },
    { label: 'On Leave Today', value: metrics.on_leave_today, color: 'text-primary-600', dot: 'bg-primary-600', live: true },
  ]
}

function KpiCards({ items }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(({ label, value, color, dot, live }) => (
        <div key={label} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
          <span className={clsx('w-2 h-2 rounded-full shrink-0', dot, live && 'animate-pulse')} />
          <span className={clsx('text-lg font-bold tabular-nums', color)}>{value ?? '—'}</span>
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={32} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

function EmployeeSearchBar({ value, onChange, onClear, placeholder, autoFocus }) {
  const inputRef = useRef(null)
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  return (
    <div className="relative max-w-xl w-full mx-auto">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClear() }}
        placeholder={placeholder || 'Search by name, employee ID, or email address'}
        className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent shadow-sm"
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

function RequestTable({ requests, onApprove, showEmployee = true }) {
  if (!requests.length) {
    return <EmptyState icon={Calendar} title="No leave requests found" />
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {showEmployee && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>}
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">From</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">To</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            {onApprove && <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              {showEmployee && (
                <td className="py-3 px-4 font-medium text-gray-800">{r.employee_name || '—'}</td>
              )}
              <td className="py-3 px-4 text-gray-600">{r.leave_type || '—'}</td>
              <td className="py-3 px-4 text-gray-600">{r.start_date}</td>
              <td className="py-3 px-4 text-gray-600">{r.end_date}</td>
              <td className="py-3 px-4 text-gray-600 text-right tabular-nums">{r.days}</td>
              <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
              {onApprove && r.status === 'pending' && (
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => onApprove(r.id, 'approved')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onApprove(r.id, 'rejected')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              )}
              {onApprove && r.status !== 'pending' && <td className="py-3 px-4" />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab 1: User-specific Operations ───────────────────────────────────────────

function UserOpsTab({ onScopeChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [summary, setSummary] = useState(null)
  const [balance, setBalance] = useState([])
  const [requests, setRequests] = useState([])
  const [activeSubTab, setActiveSubTab] = useState('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await ltSearchEmployees(query.trim())
        setResults(res.data)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback(async (emp) => {
    setSelected(emp)
    setQuery('')
    setResults([])
    setLoading(true)
    try {
      const [sumRes, balRes, reqRes] = await Promise.all([
        ltGetEmployeeSummary(emp.id),
        ltGetEmployeeBalance(emp.id),
        ltGetEmployeeRequests(emp.id),
      ])
      setSummary(sumRes.data)
      setBalance(balRes.data)
      setRequests(reqRes.data)
    } catch { toast.error('Failed to load employee data') }
    finally { setLoading(false) }
  }, [])

  const handleClearSearch = () => { setQuery(''); setResults([]) }
  const handleClearSelected = () => {
    setSelected(null); setSummary(null); setBalance([]); setRequests([]); setActiveSubTab('all')
  }

  const filteredRequests = activeSubTab === 'all'
    ? requests
    : requests.filter((r) => r.status === activeSubTab)

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  // Keep the page-level KPI row in sync with this employee's own Leave History
  // counts (same numbers shown in the pills below) instead of a separate,
  // differently-scoped query — so the two never disagree.
  useEffect(() => {
    if (!selected) { onScopeChange?.(null); return }
    const todayStr = new Date().toISOString().slice(0, 10)
    const onLeaveToday = requests.some(
      (r) => r.status === 'approved' && r.start_date <= todayStr && r.end_date >= todayStr
    )
    onScopeChange?.({
      total_pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      on_leave_today: onLeaveToday ? 1 : 0,
    })
    return () => onScopeChange?.(null)
  }, [selected, requests]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Search bar – always visible */}
      <EmployeeSearchBar value={query} onChange={setQuery} onClear={handleClearSearch} autoFocus={!selected} />

      {searching && (
        <div className="flex justify-center py-4">
          <RefreshCw size={18} className="text-primary-500 animate-spin" />
        </div>
      )}

      {!searching && query && results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {results.map((emp) => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0">
                {emp.first_name?.[0]}{emp.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{emp.full_name}</p>
                <p className="text-xs text-gray-400 truncate">{emp.employee_id} · {emp.email}</p>
              </div>
              <span className="text-xs text-gray-400">{emp.department || ''}</span>
            </button>
          ))}
        </div>
      )}

      {!searching && query && results.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-6">No employees found for "{query}"</p>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <RefreshCw size={24} className="text-primary-500 animate-spin" />
        </div>
      )}

      {!selected && !query && !loading && !searching && (
        <EmptyState
          icon={User}
          title="Please begin typing to search for an employee"
          subtitle="Search by name, employee ID, or email address"
        />
      )}

      {/* Employee detail – shown after selection, only while no active search query */}
      {selected && summary && !loading && !query && (
        <div className="space-y-6">

          {/* Employee profile card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-600 shrink-0">
                {summary.employee.first_name?.[0]}{summary.employee.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base">{summary.employee.full_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500">{summary.employee.department || 'N/A'}</p>
                  <span className={clsx(
                    'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                    summary.employee.status === 'active'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-500'
                  )}>
                    {summary.employee.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{summary.employee.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-700">ID: {summary.employee.employee_id}</p>
                <button
                  onClick={handleClearSelected}
                  className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 ml-auto"
                >
                  <X size={12} /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* Leave Balance */}
          {balance.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1 h-4 rounded-full bg-primary-600" />
                <h4 className="text-xs font-bold tracking-widest uppercase text-gray-900">Leave Balance</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {balance.map((b, idx) => {
                  const p = BALANCE_PALETTE[idx % BALANCE_PALETTE.length]
                  const Icon = getLeaveTypeIcon(b.leave_type)
                  const used = b.used_days || 0
                  const total = b.total_days || 0
                  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
                  return (
                    <div key={b.leave_type_id} className={clsx('bg-white rounded-2xl border border-gray-100 border-t-4 shadow-sm p-4 flex flex-col', p.border)}>
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-dense-tight font-bold uppercase tracking-wider text-gray-500 leading-tight max-w-[70%]">{b.leave_type}</p>
                        <Icon size={16} className={p.icon} />
                      </div>
                      <p className={clsx('text-3xl font-bold mt-1', p.num)}>{fmtDays(b.remaining_days ?? 0)}</p>
                      <p className="text-xs text-gray-400 mt-0.5 mb-4">days available</p>
                      <div className="mt-auto">
                        <div className="w-full bg-gray-100 rounded-full h-1 mb-1.5">
                          <div className={clsx('h-1 rounded-full', p.bar)} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-dense-tight text-gray-400">{used}d used</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leave History */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-1 h-4 rounded-full bg-primary-600" />
              <h4 className="text-xs font-bold tracking-widest uppercase text-gray-900">Leave History</h4>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex gap-2 flex-wrap">
                {['all', 'pending', 'approved', 'rejected'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSubTab(s)}
                    className={clsx(
                      'text-xs px-3 py-1 rounded-lg capitalize font-medium transition-colors flex items-center gap-1.5',
                      activeSubTab === s ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {s}
                    <span className={clsx(
                      'text-dense-tight px-1.5 py-0.5 rounded-full font-bold',
                      activeSubTab === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                    )}>
                      {counts[s]}
                    </span>
                  </button>
                ))}
              </div>
              <RequestTable requests={filteredRequests} showEmployee={false} />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Tab 2: Leave Requests ─────────────────────────────────────────────────────

function LeaveRequestsTab() {
  const [data, setData] = useState({ total: 0, requests: [] })
  const [statusFilter, setStatusFilter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ltGetAllRequests(statusFilter ? { status: statusFilter } : {})
      setData(res.data)
    } catch { toast.error('Failed to load leave requests') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleApprove = async (leaveId, status) => {
    setActing(true)
    try {
      await ltApproveRequest(leaveId, { status })
      toast.success(`Request ${status}`)
      load()
    } catch { toast.error('Action failed') }
    finally { setActing(false) }
  }

  const filters = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">All Leave Requests</h3>
        <p className="text-xs text-gray-400">View and manage leave requests across all employees</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {filters.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(value)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              statusFilter === value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {label}
            {value === null && ` ${data.total}`}
            {value === 'pending' && ` ${data.requests.filter(r => r.status === 'pending').length}`}
            {value === 'approved' && ` ${data.requests.filter(r => r.status === 'approved').length}`}
            {value === 'rejected' && ` ${data.requests.filter(r => r.status === 'rejected').length}`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="text-primary-500 animate-spin" /></div>
        ) : (
          <RequestTable requests={data.requests} onApprove={acting ? undefined : handleApprove} />
        )}
      </div>
    </div>
  )
}

// ── Tab 3: Compensatory Requests ──────────────────────────────────────────────

function CompRequestsTab() {
  const [data, setData] = useState({ total: 0, requests: [], comp_type: null })
  const [statusFilter, setStatusFilter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ltGetCompRequests(statusFilter ? { status: statusFilter } : {})
      setData(res.data)
    } catch { toast.error('Failed to load compensatory requests') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleApprove = async (leaveId, status) => {
    setActing(true)
    try {
      await ltApproveRequest(leaveId, { status })
      toast.success(`Request ${status}`)
      load()
    } catch { toast.error('Action failed') }
    finally { setActing(false) }
  }

  const filters = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">Compensatory Requests</h3>
        <p className="text-xs text-gray-400">Manage compensatory off requests</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {filters.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(value)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              statusFilter === value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {label}
            {value === null && ` ${data.total}`}
            {value === 'pending' && ` ${data.requests.filter(r => r.status === 'pending').length}`}
            {value === 'approved' && ` ${data.requests.filter(r => r.status === 'approved').length}`}
            {value === 'rejected' && ` ${data.requests.filter(r => r.status === 'rejected').length}`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="text-primary-500 animate-spin" /></div>
        ) : data.comp_type === null ? (
          <EmptyState
            icon={Briefcase}
            title="No compensatory leave type configured"
            subtitle="Create a leave type with 'comp' in its name to enable this tab"
          />
        ) : (
          <RequestTable requests={data.requests} onApprove={acting ? undefined : handleApprove} />
        )}
      </div>
    </div>
  )
}

// ── Tab: Enablement Requests (Maternity / Paternity self-enable workflow) ─────

function EnablementRequestsTab() {
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ltGetEnablementRequests(statusFilter || undefined)
      setRequests(res.data || [])
    } catch { toast.error('Failed to load enablement requests') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const decide = async (id, status) => {
    const rejection_reason = status === 'rejected' ? window.prompt('Reason for rejection (optional):') || '' : undefined
    setActing(id)
    try {
      await ltDecideEnablement(id, { status, rejection_reason })
      toast.success(`Request ${status}`)
      load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Action failed')
    } finally { setActing(null) }
  }

  const filters = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: null },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">Enablement Requests</h3>
        <p className="text-xs text-gray-400">Approve or reject employee requests to enable Maternity / Paternity leave</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {filters.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(value)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              statusFilter === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="text-primary-500 animate-spin" /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No requests" subtitle="Nothing to review here right now" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Employee</th>
                <th className="text-left px-5 py-3 font-medium">Leave Type</th>
                <th className="text-left px-5 py-3 font-medium">Reason</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(r => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.employee_name || r.employee_id}</td>
                  <td className="px-5 py-3 text-gray-600">{r.leave_type}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{r.reason || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={clsx('inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize', STATUS_COLORS[r.status] || 'bg-gray-50 text-gray-500')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => decide(r.id, 'approved')}
                          disabled={acting === r.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50"
                        ><CheckCircle size={12} /> Approve</button>
                        <button
                          onClick={() => decide(r.id, 'rejected')}
                          disabled={acting === r.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50"
                        ><XCircle size={12} /> Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Tab 4: Holidays ───────────────────────────────────────────────────────────

function HolidaysTab() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [regionFilter, setRegionFilter] = useState('all')
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', region: 'India', holiday_type: 'public', description: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ltGetHolidays(year, regionFilter)
      setHolidays(res.data.holidays || [])
    } catch { toast.error('Failed to load holidays') }
    finally { setLoading(false) }
  }, [year, regionFilter])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    try {
      await ltCreateHoliday(form)
      toast.success('Holiday added')
      setForm({ name: '', date: '', region: 'India', holiday_type: 'public', description: '' })
      setShowAdd(false)
      load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add holiday')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await ltDeleteHoliday(id)
      toast.success('Holiday removed')
      load()
    } catch { toast.error('Failed to delete holiday') }
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Company Holidays</h3>
          <p className="text-xs text-gray-400">Declared public and optional holidays, per office</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="all">All offices</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
            <button onClick={() => setYear((y) => y - 1)} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={14} /></button>
            <span className="text-sm font-semibold text-gray-800 min-w-[3rem] text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="text-gray-400 hover:text-gray-600"><ChevronRight size={14} /></button>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus size={13} /> Add Holiday
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-primary-50 border border-primary-100 rounded-2xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-primary-700">New Holiday</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Holiday name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={form.holiday_type}
              onChange={(e) => setForm((f) => ({ ...f, holiday_type: e.target.value }))}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="public">Public</option>
              <option value="optional">Optional</option>
              <option value="restricted">Restricted</option>
            </select>
            <input
              type="text"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Holiday'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm px-4 py-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="text-primary-500 animate-spin" /></div>
        ) : holidays.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={`No holidays configured for ${year}`}
            subtitle="Holidays can be added via the Add Holiday button above"
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {holidays.map((h) => {
              const d = new Date(h.date)
              return (
                <div key={h.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-lg font-bold text-gray-800 leading-none">{d.getDate()}</p>
                    <p className="text-xs text-gray-400">{MONTHS[d.getMonth()]}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{h.name}</p>
                    {h.description && <p className="text-xs text-gray-400 truncate">{h.description}</p>}
                  </div>
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full shrink-0', REGION_COLORS[h.region] || REGION_COLORS.India)}>
                    {h.region}
                  </span>
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full capitalize', HOLIDAY_TYPE_COLORS[h.holiday_type] || HOLIDAY_TYPE_COLORS.public)}>
                    {h.holiday_type}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
                  </span>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Delete holiday"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 5: Customize Balance ──────────────────────────────────────────────────

function CustomizeBalanceTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [balance, setBalance] = useState([])
  const [loading, setLoading] = useState(false)
  const [rowEdits, setRowEdits] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await ltSearchEmployees(query.trim())
        setResults(res.data)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const todayStr = () => new Date().toISOString().slice(0, 10)

  const initRowEdits = (list) => {
    const next = {}
    list.forEach((b) => { next[b.leave_type_id] = { date: todayStr(), newBalance: '', reason: '' } })
    return next
  }

  const updateRow = (leaveTypeId, field, value) => {
    setRowEdits((prev) => ({ ...prev, [leaveTypeId]: { ...prev[leaveTypeId], [field]: value } }))
  }

  const handleSelect = async (emp) => {
    setSelected(emp)
    setQuery('')
    setResults([])
    setLoading(true)
    try {
      const res = await ltGetEmployeeBalance(emp.id)
      setBalance(res.data)
      setRowEdits(initRowEdits(res.data))
    } catch { toast.error('Failed to load balance') }
    finally { setLoading(false) }
  }

  const handleClear = () => { setSelected(null); setBalance([]); setRowEdits({}) }

  const saveAll = async ({ resetForNew = false } = {}) => {
    const edited = balance.filter((b) => b.id != null && rowEdits[b.leave_type_id]?.newBalance !== '')
    if (edited.length === 0) { toast.error('Enter a new balance to save'); return }
    setSaving(true)
    try {
      await Promise.all(edited.map((b) =>
        ltUpdateEmployeeBalance(selected.id, b.id, { remaining_days: parseFloat(rowEdits[b.leave_type_id].newBalance) })
      ))
      toast.success('Balance updated')
      if (resetForNew) {
        handleClear()
      } else {
        const res = await ltGetEmployeeBalance(selected.id)
        setBalance(res.data)
        setRowEdits(initRowEdits(res.data))
      }
    } catch { toast.error('Failed to update balance') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">Customize Leave Balance</h3>
        <p className="text-xs text-gray-400">View and adjust individual leave allocations for employees</p>
      </div>

      <EmployeeSearchBar
        value={query}
        onChange={setQuery}
        onClear={() => { setQuery(''); setResults([]) }}
        placeholder="Search employee to view or edit balance..."
      />

      {searching && <div className="flex justify-center py-4"><RefreshCw size={18} className="text-primary-500 animate-spin" /></div>}

      {!searching && query && results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {results.map((emp) => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0">
                {emp.first_name?.[0]}{emp.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{emp.full_name}</p>
                <p className="text-xs text-gray-400 truncate">{emp.employee_id} · {emp.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && !query && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                {selected.first_name?.[0]}{selected.last_name?.[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{selected.full_name}</p>
                <p className="text-xs text-gray-400">{selected.employee_id}</p>
              </div>
            </div>
            <button onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><RefreshCw size={20} className="text-primary-500 animate-spin" /></div>
          ) : balance.length === 0 ? (
            <EmptyState icon={BarChart2} title="No balance records found" subtitle="Balance records are created when leave is allocated" />
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leave Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Existing Balance</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">New Balance</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.map((b) => {
                    const edit = rowEdits[b.leave_type_id] || { date: todayStr(), newBalance: '', reason: '' }
                    const editable = b.id != null
                    return (
                      <tr key={b.leave_type_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-800">{b.leave_type}</td>
                        <td className="py-2 px-4">
                          <input
                            type="date"
                            value={edit.date}
                            onChange={(e) => updateRow(b.leave_type_id, 'date', e.target.value)}
                            disabled={!editable}
                            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:bg-gray-50"
                          />
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-right tabular-nums">{fmtDays(b.remaining_days)}</td>
                        <td className="py-2 px-4 text-right">
                          {editable ? (
                            <input
                              type="number"
                              value={edit.newBalance}
                              onChange={(e) => updateRow(b.leave_type_id, 'newBalance', e.target.value)}
                              className="w-20 text-sm text-right border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                              min="0" step="0.5"
                            />
                          ) : (
                            <span className="text-dense-tight text-gray-300 italic">Not allocated</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            value={edit.reason}
                            onChange={(e) => updateRow(b.leave_type_id, 'reason', e.target.value)}
                            placeholder="Manual correction"
                            disabled={!editable}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:bg-gray-50"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 px-4 py-4">
              <button
                onClick={() => saveAll({ resetForNew: false })}
                disabled={saving}
                className="text-sm px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => saveAll({ resetForNew: true })}
                disabled={saving}
                className="text-sm px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Submit and New
              </button>
              <button
                onClick={handleClear}
                disabled={saving}
                className="text-sm px-4 py-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            </>
          )}
        </div>
      )}

      {!selected && !query && (
        <EmptyState icon={BarChart2} title="Select an employee to view their leave balance" />
      )}
    </div>
  )
}

// ── Tab 6: Customize Policy ───────────────────────────────────────────────────

function CustomizePolicyTab() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await ltGetLeaveTypes()
      setTypes(res.data)
    } catch { toast.error('Failed to load leave types') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const startEdit = (lt) => {
    setEditingId(lt.id)
    setEditForm({
      name: lt.name,
      days_allowed: lt.days_allowed,
      carry_forward: lt.carry_forward,
      paid: lt.paid,
      description: lt.description || '',
      accrual_mode: lt.accrual_mode || 'none',
      accrual_amount: lt.accrual_amount ?? '',
      max_balance: lt.max_balance ?? '',
      day_count_mode: lt.day_count_mode || 'weekday',
      requires_admin_enable: !!lt.requires_admin_enable,
    })
  }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      await ltUpdateLeaveType(id, {
        ...editForm,
        days_allowed: parseInt(editForm.days_allowed, 10),
        accrual_amount: editForm.accrual_amount === '' ? null : parseFloat(editForm.accrual_amount),
        max_balance: editForm.max_balance === '' ? null : parseFloat(editForm.max_balance),
      })
      toast.success('Leave type updated')
      setEditingId(null)
      load()
    } catch { toast.error('Failed to update leave type') }
    finally { setSaving(false) }
  }

  const POLICY_COLORS = [
    'bg-blue-50 border-blue-200',
    'bg-red-50 border-red-200',
    'bg-green-50 border-green-200',
    'bg-secondary-50 border-secondary-200',
    'bg-orange-50 border-orange-200',
    'bg-gray-50 border-gray-200',
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">Leave Policy Configuration</h3>
        <p className="text-xs text-gray-400">Manage leave types and entitlement rules</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw size={20} className="text-primary-500 animate-spin" /></div>
      ) : types.length === 0 ? (
        <EmptyState icon={AlertCircle} title="No leave types configured" subtitle="Add leave types via the Leave configuration" />
      ) : (
        <div className="space-y-2">
          {types.map((lt, idx) => {
            const isOpen = openId === lt.id
            const isEditing = editingId === lt.id
            return (
              <div
                key={lt.id}
                className={clsx('rounded-2xl border transition-all duration-200', POLICY_COLORS[idx % POLICY_COLORS.length])}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : lt.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    {lt.code && (
                      <span className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">
                        {lt.code?.slice(0, 2)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-800">{lt.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{lt.days_allowed} days/year</span>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 border-t border-gray-100/60">
                    {isEditing ? (
                      <div className="space-y-3 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 font-medium">Leave Type Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-medium">Days Allowed Per Year</label>
                            <input
                              type="number"
                              value={editForm.days_allowed}
                              onChange={(e) => setEditForm((f) => ({ ...f, days_allowed: e.target.value }))}
                              min="0"
                              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-medium">Description</label>
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            rows={2}
                            className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                          />
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.carry_forward}
                              onChange={(e) => setEditForm((f) => ({ ...f, carry_forward: e.target.checked }))}
                              className="accent-primary-600"
                            />
                            <span className="text-xs text-gray-600">Carry Forward</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.paid}
                              onChange={(e) => setEditForm((f) => ({ ...f, paid: e.target.checked }))}
                              className="accent-primary-600"
                            />
                            <span className="text-xs text-gray-600">Paid Leave</span>
                          </label>
                        </div>

                        {/* Policy engine fields — drive the accrual/reset scheduler and day-counting mode */}
                        <div className="pt-2 border-t border-gray-100/60">
                          <p className="text-xs text-gray-500 font-medium mb-2">Accrual &amp; Scheduler</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 font-medium">Accrual Mode</label>
                              <select
                                value={editForm.accrual_mode}
                                onChange={(e) => setEditForm((f) => ({ ...f, accrual_mode: e.target.value }))}
                                className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                              >
                                <option value="none">None (admin-allocated)</option>
                                <option value="monthly_credit">Monthly credit</option>
                                <option value="monthly_reset">Monthly reset</option>
                                <option value="yearly_allocation">Yearly allocation</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-medium">Accrual Amount</label>
                              <input
                                type="number" step="0.01" placeholder="—"
                                value={editForm.accrual_amount}
                                onChange={(e) => setEditForm((f) => ({ ...f, accrual_amount: e.target.value }))}
                                className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-medium">Max Balance</label>
                              <input
                                type="number" step="0.01" placeholder="Unlimited"
                                value={editForm.max_balance}
                                onChange={(e) => setEditForm((f) => ({ ...f, max_balance: e.target.value }))}
                                className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3">
                            <div>
                              <label className="text-xs text-gray-500 font-medium block mb-1">Day Counting</label>
                              <select
                                value={editForm.day_count_mode}
                                onChange={(e) => setEditForm((f) => ({ ...f, day_count_mode: e.target.value }))}
                                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                              >
                                <option value="weekday">Weekdays (excl. holidays)</option>
                                <option value="calendar">Calendar days (incl. weekends)</option>
                              </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-5">
                              <input
                                type="checkbox"
                                checked={editForm.requires_admin_enable}
                                onChange={(e) => setEditForm((f) => ({ ...f, requires_admin_enable: e.target.checked }))}
                                className="accent-primary-600"
                              />
                              <span className="text-xs text-gray-600">Requires admin enablement</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(lt.id)}
                            disabled={saving}
                            className="text-sm px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
                          >
                            {saving ? 'Saving…' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-sm px-4 py-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div><p className="text-xs text-gray-400">Code</p><p className="font-medium text-gray-700">{lt.code || '—'}</p></div>
                          <div><p className="text-xs text-gray-400">Days/Year</p><p className="font-medium text-gray-700">{lt.days_allowed}</p></div>
                          <div>
                            <p className="text-xs text-gray-400">Carry Forward</p>
                            <p className={clsx('font-medium', lt.carry_forward ? 'text-green-600' : 'text-gray-400')}>
                              {lt.carry_forward ? 'Yes' : 'No'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Type</p>
                            <p className={clsx('font-medium', lt.paid ? 'text-green-600' : 'text-red-500')}>
                              {lt.paid ? 'Paid' : 'Unpaid'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Accrual</p>
                            <p className="font-medium text-gray-700">{(lt.accrual_mode || 'none').replace('_', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Max Balance</p>
                            <p className="font-medium text-gray-700">{lt.max_balance ?? 'Unlimited'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Day Counting</p>
                            <p className="font-medium text-gray-700 capitalize">{lt.day_count_mode || 'weekday'}</p>
                          </div>
                          {lt.requires_admin_enable && (
                            <div>
                              <p className="text-xs text-gray-400">Access</p>
                              <p className="font-medium text-amber-600">Admin-enable required</p>
                            </div>
                          )}
                        </div>
                        {lt.description && (
                          <p className="text-xs text-gray-500">{lt.description}</p>
                        )}
                        <button
                          onClick={() => startEdit(lt)}
                          className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <Edit2 size={12} /> Edit Policy
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Metrics bar ───────────────────────────────────────────────────────────────

function MetricsBar() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    ltGetMetrics().then((r) => setMetrics(r.data)).catch(() => {})
  }, [])

  if (!metrics) return null

  const items = kpiItemsFromMetrics({
    total_pending: metrics.total_pending,
    approved: metrics.approved_this_month,
    rejected: metrics.rejected_this_month,
    on_leave_today: metrics.employees_on_leave_today,
  })

  return (
    <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
      <KpiCards items={items} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaveTrackerPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('user-ops')
  const [employeeScope, setEmployeeScope] = useState(null)

  // Guard: redirect if not admin (belt-and-suspenders on top of AdminRoute)
  useEffect(() => {
    if (user && !canAccess(user, 'leaveTracker')) navigate('/', { replace: true })
  }, [user, navigate])

  const renderTab = () => {
    switch (activeTab) {
      case 'user-ops':       return <UserOpsTab onScopeChange={setEmployeeScope} />
      case 'leave-requests': return <LeaveRequestsTab />
      case 'comp-requests':  return <CompRequestsTab />
      case 'enablement':     return <EnablementRequestsTab />
      case 'holidays':       return <HolidaysTab />
      case 'customize-bal':  return <CustomizeBalanceTab />
      case 'customize-pol':  return <CustomizePolicyTab />
      default:               return null
    }
  }

  return (
    <Container>
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-gray-900">Leave Tracker</h1>
        <p className="text-sm text-gray-500">Admin · manage employee leave operations</p>
      </div>

      {/* Metrics: org-wide by default, swaps to the selected employee's own KPIs
          while viewing their detail in the User-specific Operations tab */}
      {activeTab === 'user-ops' && employeeScope
        ? <KpiCards items={kpiItemsFromMetrics(employeeScope, '')} />
        : <MetricsBar />}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="animate-fade-up">
        {renderTab()}
      </div>
    </Container>
  )
}
