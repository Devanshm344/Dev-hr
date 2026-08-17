import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  searchShiftEmployees, getShifts, createShift, updateShift, deleteShift,
  getShiftMappings, assignShift, removeShiftMapping, getShiftStats,
  getShiftSwaps, approveShiftSwap, requestShiftSwap, getEmployeeSwapRequests,
  getUserSpecificShifts, getShiftMappingsCalendar,
} from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import {
  Search, X, Plus, Loader2, Clock, Users, Calendar, ChevronLeft, ChevronRight,
  Edit2, Trash2, ArrowLeftRight, Download, Upload, Printer, MoreHorizontal,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'
import AddShiftForm from '../components/shift/AddShiftForm'
import { primary, secondary, BRAND_GRADIENT } from '../theme/colors'

// ── Date utilities ─────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isoDate(d) {
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayIso() { return isoDate(new Date()) }

function getWeekStart(d) {
  const date = new Date(d)
  date.setDate(date.getDate() - date.getDay())
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d, n) {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function getMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const weeks = []
  let week = Array(firstDay.getDay()).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

function formatMonthYear(year, month) {
  return `${MONTH_NAMES[month]} ${year}`
}

function formatWeekRange(weekStart) {
  const we = addDays(weekStart, 6)
  const fmt = d => `${d.getDate()}-${MONTH_NAMES[d.getMonth()].slice(0, 3)}-${d.getFullYear()}`
  return `${fmt(weekStart)} - ${fmt(we)}`
}


// ── Reusable Components ────────────────────────────────────────────────────────

function ShiftEventCard({ event, compact = false }) {
  if (!event) return null
  if (event.type === 'leave') {
    return (
      <div
        className={clsx('rounded text-xs px-1.5 font-medium truncate', compact ? 'py-0.5' : 'py-1 mb-0.5')}
        style={{ background: secondary[50], color: secondary[600], border: `1px solid ${secondary[200]}` }}
      >
        {event.leave_name}
      </div>
    )
  }
  const color = event.color || primary[600]
  return (
    <div
      className={clsx('rounded text-xs px-1.5 truncate', compact ? 'py-0.5' : 'py-1 mb-0.5')}
      style={{ background: color + '1a', color, border: `1px solid ${color}33` }}
    >
      <div className="font-semibold truncate leading-tight">
        {event.shift_name} · {event.start_time}–{event.end_time}
      </div>
      {!compact && (
        <div className="text-dense-tight opacity-75 leading-tight">{event.start_time} - {event.end_time}</div>
      )}
    </div>
  )
}

function ViewToggle({ value, options, onChange }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'px-3 py-1.5 transition-colors',
            value === opt.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ExportMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const items = [
    { icon: Upload,   label: 'Import',          action: () => toast('Import coming soon') },
    { icon: Download, label: 'Export',           action: () => toast('Export coming soon') },
    { icon: Download, label: 'Download as PDF',  action: () => toast('PDF download coming soon') },
    { icon: Printer,  label: 'Print',            action: () => window.print() },
  ]
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <item.icon size={14} className="text-gray-400" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '18' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{value ?? '–'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function EmptySearch() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative w-28 h-28">
        <div className="absolute inset-0 rounded-full bg-primary-50 flex items-center justify-center">
          <svg viewBox="0 0 120 100" className="w-24 h-20" fill="none">
            <ellipse cx="60" cy="85" rx="40" ry="8" fill={primary[100]} />
            <circle cx="60" cy="38" r="28" fill={primary[200]} />
            <circle cx="60" cy="38" r="20" fill={primary[300]} />
            <circle cx="52" cy="34" r="3" fill="white" />
            <circle cx="62" cy="34" r="3" fill="white" />
            <path d="M53 44 Q60 49 67 44" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            <rect x="44" y="66" width="32" height="20" rx="4" fill={primary[400]} />
            <path d="M44 72 L30 58" stroke={primary[600]} strokeWidth="3" strokeLinecap="round" />
            <circle cx="27" cy="55" r="5" fill={primary[600]} />
          </svg>
        </div>
      </div>
      <p className="text-sm text-gray-500 font-medium">Search and select an employee to view their shift calendar</p>
    </div>
  )
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Icon size={22} className="text-gray-300" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}


// ── Assign Shift Modal ─────────────────────────────────────────────────────────

function AssignShiftModal({ onClose, onSuccess, preEmployee = null }) {
  const [shifts, setShifts] = useState([])
  const [empSearch, setEmpSearch] = useState(preEmployee?.name || '')
  const [empResults, setEmpResults] = useState([])
  const [form, setForm] = useState({
    employee_id: preEmployee?.id || '',
    shift_id: '',
    effective_from: isoDate(new Date()),
    effective_to: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const debRef = useRef(null)

  useEffect(() => {
    getShifts({ active_only: true }).then(r => setShifts(r.data)).catch(() => {})
  }, [])

  const handleEmpSearch = val => {
    setEmpSearch(val)
    setForm(f => ({ ...f, employee_id: '' }))
    clearTimeout(debRef.current)
    if (!val.trim()) { setEmpResults([]); return }
    debRef.current = setTimeout(async () => {
      try { const r = await searchShiftEmployees(val); setEmpResults(r.data) } catch {}
    }, 300)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.employee_id || !form.shift_id) { toast.error('Employee and shift are required'); return }
    setSaving(true)
    try {
      await assignShift({
        employee_id: parseInt(form.employee_id),
        shift_id: parseInt(form.shift_id),
        effective_from: form.effective_from,
        effective_to: form.effective_to || null,
        notes: form.notes || null,
      })
      toast.success('Shift assigned!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign shift')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center"><Users size={16} className="text-white" /></div>
            <div>
              <h2 className="text-sm font-bold text-white">Assign Shift</h2>
              <p className="text-sky-200 text-xs">Map employee to a shift</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {preEmployee ? (
            <div className="flex items-center gap-3 py-2 px-3 bg-primary-50 rounded-xl">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                style={{ background: BRAND_GRADIENT }}>
                {preEmployee.name?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{preEmployee.name}</p>
                <p className="text-xs text-gray-500">{preEmployee.employee_id}</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Employee *</label>
              <input type="text" placeholder="Search by name or ID…"
                className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                value={empSearch} onChange={e => handleEmpSearch(e.target.value)} />
              {empResults.length > 0 && (
                <div className="mt-1 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden max-h-36 overflow-y-auto">
                  {empResults.map(e => (
                    <button key={e.id} type="button"
                      onClick={() => { setForm(f => ({ ...f, employee_id: e.id })); setEmpSearch(e.name); setEmpResults([]) }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 transition-colors">
                      {e.name} <span className="text-gray-400">({e.employee_id})</span>
                    </button>
                  ))}
                </div>
              )}
              {form.employee_id && <p className="text-xs text-emerald-600 font-medium mt-1">Employee selected ✓</p>}
            </div>
          )}
          <div>
            <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Shift *</label>
            <select required className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
              value={form.shift_id} onChange={e => setForm(f => ({ ...f, shift_id: e.target.value }))}>
              <option value="">Select Shift</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Effective From *</label>
              <input required type="date" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div>
              <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Effective To</label>
              <input type="date" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                value={form.effective_to} min={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea rows={2} className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white resize-none transition-all"
              placeholder="Optional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.employee_id || !form.shift_id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-60"
              style={{ background: BRAND_GRADIENT }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Assign Shift
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ── Calendar Views ─────────────────────────────────────────────────────────────

function MonthlyCalendarView({ year, month, events }) {
  const today = todayIso()
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month])

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
          {week.map((day, di) => {
            const key = day ? isoDate(day) : `p-${wi}-${di}`
            const dayEvents = day ? (events[isoDate(day)] || []) : []
            const isToday = day && isoDate(day) === today
            return (
              <div
                key={key}
                className={clsx(
                  'min-h-[88px] p-1.5 border-r border-gray-50 last:border-r-0',
                  !day && 'bg-gray-50/40',
                  isToday && 'bg-blue-50/60'
                )}
              >
                {day && (
                  <>
                    <div className={clsx(
                      'w-6 h-6 mb-1 flex items-center justify-center text-xs font-bold rounded-full',
                      isToday ? 'bg-blue-500 text-white' : 'text-gray-700'
                    )}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.map((e, i) => <ShiftEventCard key={i} event={e} />)}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function WeeklyCalendarView({ weekStart, events }) {
  const today = todayIso()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="grid grid-cols-7">
        {days.map(d => {
          const key = isoDate(d)
          const isToday = key === today
          const dayEvents = events[key] || []
          return (
            <div key={key} className="border-r border-gray-50 last:border-r-0">
              <div className={clsx('py-3 text-center border-b border-gray-100', isToday && 'bg-blue-50/60')}>
                <div className="text-dense-tight font-bold text-gray-400 uppercase tracking-wider">{DAY_NAMES[d.getDay()]}</div>
                <div className={clsx(
                  'w-7 h-7 mx-auto mt-1 flex items-center justify-center text-sm font-bold rounded-full',
                  isToday ? 'bg-blue-500 text-white' : 'text-gray-800'
                )}>
                  {d.getDate()}
                </div>
              </div>
              <div className="p-2 min-h-[120px] space-y-1">
                {dayEvents.length === 0
                  ? <div className="text-dense-tight text-gray-300 text-center pt-3">—</div>
                  : dayEvents.map((e, i) => <ShiftEventCard key={i} event={e} />)
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Tab: User-specific Operations ─────────────────────────────────────────────

function UserTab({ isAdmin }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [viewType, setViewType]   = useState('monthly')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents]       = useState({})
  const [loadingCal, setLoadingCal] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const debRef = useRef(null)

  const { startDate, endDate, title } = useMemo(() => {
    if (viewType === 'monthly') {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth()
      return {
        startDate: isoDate(new Date(y, m, 1)),
        endDate:   isoDate(new Date(y, m + 1, 0)),
        title:     formatMonthYear(y, m),
      }
    }
    const ws = getWeekStart(currentDate)
    return {
      startDate: isoDate(ws),
      endDate:   isoDate(addDays(ws, 6)),
      title:     formatWeekRange(ws),
    }
  }, [viewType, currentDate])

  useEffect(() => {
    if (!selected) return
    setLoadingCal(true)
    getUserSpecificShifts(selected.id, startDate, endDate)
      .then(r => setEvents(r.data.events || {}))
      .catch(() => setEvents({}))
      .finally(() => setLoadingCal(false))
  }, [selected?.id, startDate, endDate])

  const handleQuery = val => {
    setQuery(val)
    setNoResults(false)
    if (!val.trim()) { setResults([]); return }
    clearTimeout(debRef.current)
    debRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchShiftEmployees(val)
        setResults(r.data)
        setNoResults(r.data.length === 0)
      } catch { toast.error('Search failed') } finally { setSearching(false) }
    }, 300)
  }

  const selectEmployee = emp => { setSelected(emp); setResults([]); setQuery('') }
  const clearEmployee  = ()  => { setSelected(null); setEvents({}); setResults([]) }

  const handlePrev = () => viewType === 'monthly'
    ? setCurrentDate(d => addMonths(d, -1))
    : setCurrentDate(d => addDays(d, -7))

  const handleNext = () => viewType === 'monthly'
    ? setCurrentDate(d => addMonths(d, 1))
    : setCurrentDate(d => addDays(d, 7))

  const refreshCalendar = () => {
    if (!selected) return
    getUserSpecificShifts(selected.id, startDate, endDate)
      .then(r => setEvents(r.data.events || {}))
      .catch(() => {})
  }

  return (
    <div className="space-y-4">
      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Employee selector */}
        <div className="relative min-w-[220px] max-w-[300px]">
          <div className="flex items-center bg-white rounded-xl border border-gray-200 px-3 py-2 gap-2 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
            {searching
              ? <Loader2 size={14} className="animate-spin text-primary-400 flex-shrink-0" />
              : <Search size={14} className="text-gray-400 flex-shrink-0" />
            }
            {selected && !query ? (
              <div className="flex-1 flex items-center justify-between gap-1">
                <span className="text-sm font-medium text-gray-800 truncate">{selected.name}</span>
                <button onClick={clearEmployee} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={12} /></button>
              </div>
            ) : (
              <>
                <input
                  type="text" value={query}
                  onChange={e => handleQuery(e.target.value)}
                  placeholder="Search Employee"
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
                {query && <button onClick={() => { setQuery(''); setResults([]); setNoResults(false) }} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
              </>
            )}
          </div>
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-xl z-10 overflow-hidden">
              {results.map(emp => (
                <button key={emp.id} onClick={() => selectEmployee(emp)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary-50 transition-colors text-left">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: BRAND_GRADIENT }}>
                    {emp.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{emp.name}</p>
                    <p className="text-xs text-gray-500 truncate">{emp.employee_id} · {emp.department || 'N/A'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Calendar navigation (only when employee selected) */}
        {selected && (
          <div className="flex items-center gap-1">
            <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft size={15} /></button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{title}</span>
            </div>
            <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight size={15} /></button>
          </div>
        )}

        <div className="flex-1" />

        {/* View toggle */}
        <ViewToggle
          value={viewType}
          options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]}
          onChange={setViewType}
        />

        {/* Add Shift */}
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/30"
          >
            <Plus size={13} /> Add Shift
          </button>
        )}

        {/* Assign Shift */}
        {isAdmin && (
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/30"
          >
            <Plus size={13} /> Assign shift
          </button>
        )}

        {/* Export/Import/Print menu */}
        <ExportMenu />
      </div>

      {/* ── No results ── */}
      {!selected && !searching && noResults && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Search size={28} className="text-gray-200" />
          <p className="text-sm font-medium">No employees found for "{query}"</p>
          <p className="text-xs">Try a different name, ID, or email</p>
        </div>
      )}

      {/* ── Empty (no employee selected) ── */}
      {!selected && !noResults && <EmptySearch />}

      {/* ── Calendar ── */}
      {selected && loadingCal && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin text-primary-400" />
        </div>
      )}

      {selected && !loadingCal && viewType === 'monthly' && (
        <MonthlyCalendarView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          events={events}
        />
      )}

      {selected && !loadingCal && viewType === 'weekly' && (
        <WeeklyCalendarView weekStart={getWeekStart(currentDate)} events={events} />
      )}

      {showAssign && (
        <AssignShiftModal
          preEmployee={selected}
          onClose={() => setShowAssign(false)}
          onSuccess={refreshCalendar}
        />
      )}

      {showAddForm && (
        <AddShiftForm
          onClose={() => setShowAddForm(false)}
          onSuccess={refreshCalendar}
        />
      )}
    </div>
  )
}


// ── Tab: Manage Shifts ─────────────────────────────────────────────────────────

const SHIFT_TYPES  = ['general', 'morning', 'evening', 'night', 'rotational']
const SHIFT_COLORS = [primary[600], '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', secondary[400], '#14b8a6', '#f43f5e']

function ManageShiftsTab({ isAdmin }) {
  const [shifts, setShifts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ name: '', shift_type: 'general', start_time: '09:00', end_time: '18:00', color: primary[600], description: '', grace_period_minutes: 15, is_night_shift: false })

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await getShifts({ active_only: false }); setShifts(r.data) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = s => {
    setEditing(s)
    setForm({ name: s.name, shift_type: s.shift_type, start_time: s.start_time, end_time: s.end_time, color: s.color || primary[600], description: s.description || '', grace_period_minutes: s.grace_period_minutes || 15, is_night_shift: s.is_night_shift || false })
    setShowModal(true)
  }

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, grace_period_minutes: parseInt(form.grace_period_minutes) }
      if (editing) { await updateShift(editing.id, payload); toast.success('Shift updated!') }
      else { await createShift(payload); toast.success('Shift created!') }
      setShowModal(false); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save shift') }
    finally { setSaving(false) }
  }

  const handleDelete = async s => {
    if (!window.confirm(`Delete shift "${s.name}"?\n\nThis will also permanently remove all employee assignments for this shift.`)) return
    try { await deleteShift(s.id); toast.success('Shift and all its mappings deleted'); load() }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{shifts.length} shift{shifts.length !== 1 ? 's' : ''} defined</p>
        {isAdmin && (
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/30">
            <Plus size={13} /> Add Shift
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={26} className="animate-spin text-primary-400" /></div>
      ) : shifts.length === 0 ? (
        <EmptyState icon={Clock} message="No shifts defined yet" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shifts.map(s => (
            <div key={s.id} className={clsx('bg-white rounded-2xl p-4 relative overflow-hidden', !s.is_active && 'opacity-60')} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl" style={{ backgroundColor: s.color || primary[600] }} />
              <div className="flex items-start justify-between mb-3 pt-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (s.color || primary[600]) + '18' }}>
                  <Clock size={18} style={{ color: s.color || primary[600] }} />
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{s.shift_type?.replace('_', ' ')}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 tabular-nums">{s.start_time} – {s.end_time}</span>
                <div className="flex items-center gap-1.5">
                  {s.is_night_shift && <span className="text-dense-tight font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">Night</span>}
                  {!s.is_active && <span className="text-dense-tight font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Inactive</span>}
                </div>
              </div>
              {s.description && <p className="text-dense text-gray-500 mt-1 line-clamp-1">{s.description}</p>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center"><Clock size={16} className="text-white" /></div>
                <div>
                  <h2 className="text-sm font-bold text-white">{editing ? 'Edit Shift' : 'Create Shift'}</h2>
                  <p className="text-sky-200 text-xs">Define shift timing and properties</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Shift Name *</label>
                  <input required type="text" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                    placeholder="e.g. Morning Shift" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Type *</label>
                  <select required className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                    value={form.shift_type} onChange={e => setForm(f => ({ ...f, shift_type: e.target.value }))}>
                    {SHIFT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Start Time *</label>
                  <input required type="time" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                    value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">End Time *</label>
                  <input required type="time" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                    value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Grace Period (min)</label>
                  <input type="number" min="0" max="60" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
                    value={form.grace_period_minutes} onChange={e => setForm(f => ({ ...f, grace_period_minutes: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-10 rounded-xl border border-gray-100 cursor-pointer bg-slate-50 p-1"
                      value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
                    <div className="flex flex-wrap gap-1.5">
                      {SHIFT_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                          className={clsx('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110', form.color === c ? 'border-gray-800 scale-110' : 'border-transparent')}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea rows={2} className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white resize-none transition-all"
                    placeholder="Optional description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input type="checkbox" id="night" checked={form.is_night_shift} onChange={e => setForm(f => ({ ...f, is_night_shift: e.target.checked }))}
                    className="w-4 h-4 rounded text-primary-600 accent-primary-600" />
                  <label htmlFor="night" className="text-sm text-gray-700 font-medium">Night shift (crosses midnight)</label>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-60"
                  style={{ background: BRAND_GRADIENT }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? 'Save Changes' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddShiftForm
          onClose={() => setShowAddForm(false)}
          onSuccess={load}
        />
      )}
    </div>
  )
}


// ── Tab: Employee Shift Mapping (grid view) ───────────────────────────────────

function MappingTab({ isAdmin }) {
  const [viewType, setViewType]   = useState('weekly')  // 'weekly' | 'daily'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [employees, setEmployees] = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(0)
  const [showAssign, setShowAssign] = useState(false)
  const LIMIT = 20

  const { startDate, endDate, dates, title } = useMemo(() => {
    if (viewType === 'weekly') {
      const ws = getWeekStart(currentDate)
      const dts = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
      return {
        startDate: isoDate(ws),
        endDate:   isoDate(addDays(ws, 6)),
        dates:     dts,
        title:     formatWeekRange(ws),
      }
    }
    // Daily
    return {
      startDate: isoDate(currentDate),
      endDate:   isoDate(currentDate),
      dates:     [currentDate],
      title:     `${currentDate.getDate()}-${MONTH_NAMES[currentDate.getMonth()].slice(0, 3)}-${currentDate.getFullYear()}`,
    }
  }, [viewType, currentDate])

  const load = useCallback(async (pg = 0) => {
    setLoading(true)
    try {
      const r = await getShiftMappingsCalendar({
        start_date: startDate,
        end_date:   endDate,
        skip:       pg * LIMIT,
        limit:      LIMIT,
      })
      if (pg === 0) setEmployees(r.data.employees)
      else setEmployees(prev => [...prev, ...r.data.employees])
      setTotal(r.data.total)
    } catch {} finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { setPage(0); load(0) }, [load])

  const loadMore = () => { const np = page + 1; setPage(np); load(np) }

  const handlePrev = () => viewType === 'weekly'
    ? setCurrentDate(d => addDays(d, -7))
    : setCurrentDate(d => addDays(d, -1))

  const handleNext = () => viewType === 'weekly'
    ? setCurrentDate(d => addDays(d, 7))
    : setCurrentDate(d => addDays(d, 1))

  const today = todayIso()
  const COL_W = viewType === 'weekly' ? 'min-w-[110px]' : 'min-w-[180px]'
  const EMP_W = 'w-[180px] min-w-[180px]'

  return (
    <div className="space-y-4">
      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft size={15} /></button>
          <div className="flex items-center gap-1.5 px-2">
            <Calendar size={13} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{title}</span>
          </div>
          <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight size={15} /></button>
        </div>

        <div className="flex-1" />

        <ViewToggle
          value={viewType}
          options={[{ value: 'weekly', label: 'Weekly' }, { value: 'daily', label: 'Daily' }]}
          onChange={setViewType}
        />

        {isAdmin && (
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/30">
            <Plus size={13} /> Assign shift
          </button>
        )}
        <ExportMenu />
      </div>

      {/* ── Grid ── */}
      {loading && employees.length === 0 ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={26} className="animate-spin text-primary-400" /></div>
      ) : employees.length === 0 ? (
        <EmptyState icon={Users} message="No employee shift data found" />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 180 + dates.length * 120 }}>

              {/* Header row */}
              <div className="flex border-b border-gray-100 bg-gray-50/60">
                <div className={clsx(EMP_W, 'flex-shrink-0 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100')}>
                  Employee
                </div>
                {dates.map(d => {
                  const key = isoDate(d)
                  const isToday = key === today
                  return (
                    <div key={key} className={clsx(COL_W, 'flex-1 py-3 text-center border-r border-gray-100 last:border-r-0', isToday && 'bg-blue-50/70')}>
                      <div className="text-dense-tight font-bold text-gray-400 uppercase tracking-wider">{DAY_NAMES[d.getDay()]}</div>
                      <div className={clsx(
                        'w-6 h-6 mx-auto mt-0.5 flex items-center justify-center text-xs font-bold rounded-full',
                        isToday ? 'bg-blue-500 text-white' : 'text-gray-700'
                      )}>
                        {d.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Employee rows */}
              {employees.map(emp => (
                <div key={emp.employee_id} className="flex border-b border-gray-50 last:border-b-0 hover:bg-slate-50/40 transition-colors">
                  {/* Employee info */}
                  <div className={clsx(EMP_W, 'flex-shrink-0 px-4 py-2.5 border-r border-gray-100 flex items-center gap-2.5')}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-dense-tight font-black text-white flex-shrink-0"
                      style={{ background: BRAND_GRADIENT }}>
                      {emp.employee_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{emp.employee_name}</p>
                      <p className="text-dense-tight text-gray-400">{emp.employee_code}</p>
                    </div>
                  </div>
                  {/* Shift cells */}
                  {dates.map(d => {
                    const key = isoDate(d)
                    const isToday = key === today
                    const dayEvents = emp.days[key] || []
                    return (
                      <div key={key} className={clsx(COL_W, 'flex-1 p-1.5 border-r border-gray-50 last:border-r-0 min-h-[56px]', isToday && 'bg-blue-50/30')}>
                        {dayEvents.length === 0
                          ? <div className="text-dense-tight text-gray-300 text-center pt-2">—</div>
                          : dayEvents.map((e, i) => <ShiftEventCard key={i} event={e} compact />)
                        }
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Load more */}
          {employees.length < total && (
            <div className="flex items-center justify-center py-3 border-t border-gray-50">
              {loading
                ? <Loader2 size={16} className="animate-spin text-primary-400" />
                : (
                  <button onClick={loadMore} className="text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                    Load more ({total - employees.length} remaining)
                  </button>
                )
              }
            </div>
          )}
        </div>
      )}

      {showAssign && (
        <AssignShiftModal
          onClose={() => setShowAssign(false)}
          onSuccess={() => { setPage(0); load(0) }}
        />
      )}
    </div>
  )
}


// ── Tab: Shift Group (placeholder) ────────────────────────────────────────────

function ShiftGroupTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Users size={24} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium">Shift Group management coming soon</p>
    </div>
  )
}


// ── Tab: Swap Requests ─────────────────────────────────────────────────────────

function SwapStatusBadge({ status }) {
  const styles = {
    pending: { bg: '#fef3c7', color: '#b45309', label: 'Pending' },
    approved: { bg: '#d1fae5', color: '#047857', label: 'Approved' },
    rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Rejected' },
  }
  const s = styles[status] || styles.pending
  return (
    <span className="px-2 py-0.5 rounded-full text-dense-tight font-bold flex-shrink-0" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function SwapRow({ swap, isAdmin, onDecide, deciding }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-50 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {swap.requester_name} <span className="text-gray-400 font-normal">→</span> {swap.requested_employee_name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {swap.swap_date}
          {swap.requester_shift && ` · ${swap.requester_shift}`}
          {swap.requested_shift && ` ↔ ${swap.requested_shift}`}
        </p>
        {swap.reason && <p className="text-xs text-gray-400 mt-0.5 truncate">"{swap.reason}"</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <SwapStatusBadge status={swap.status} />
        {isAdmin && swap.status === 'pending' && (
          <>
            <button disabled={deciding} onClick={() => onDecide(swap.id, 'approved')}
              className="px-2.5 py-1 text-dense-tight font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
              Approve
            </button>
            <button disabled={deciding} onClick={() => onDecide(swap.id, 'rejected')}
              className="px-2.5 py-1 text-dense-tight font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function RequestSwapModal({ onClose, onSuccess }) {
  const [empSearch, setEmpSearch] = useState('')
  const [empResults, setEmpResults] = useState([])
  const [form, setForm] = useState({ requested_employee_id: '', swap_date: isoDate(new Date()), reason: '' })
  const [saving, setSaving] = useState(false)
  const debRef = useRef(null)

  const handleEmpSearch = val => {
    setEmpSearch(val)
    setForm(f => ({ ...f, requested_employee_id: '' }))
    clearTimeout(debRef.current)
    if (!val.trim()) { setEmpResults([]); return }
    debRef.current = setTimeout(async () => {
      try { const r = await searchShiftEmployees(val); setEmpResults(r.data) } catch {}
    }, 300)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.requested_employee_id || !form.swap_date) { toast.error('Colleague and date are required'); return }
    setSaving(true)
    try {
      await requestShiftSwap({
        requested_employee_id: parseInt(form.requested_employee_id),
        swap_date: form.swap_date,
        reason: form.reason || null,
      })
      toast.success('Swap request sent!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to request swap')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center"><ArrowLeftRight size={16} className="text-white" /></div>
            <div>
              <h2 className="text-sm font-bold text-white">Request Shift Swap</h2>
              <p className="text-sky-200 text-xs">Ask a colleague to swap shifts</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Swap with *</label>
            <input type="text" placeholder="Search by name or ID…"
              className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
              value={empSearch} onChange={e => handleEmpSearch(e.target.value)} />
            {empResults.length > 0 && (
              <div className="mt-1 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden max-h-36 overflow-y-auto">
                {empResults.map(e => (
                  <button key={e.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, requested_employee_id: e.id })); setEmpSearch(e.name); setEmpResults([]) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 transition-colors">
                    {e.name} <span className="text-gray-400">({e.employee_id})</span>
                  </button>
                ))}
              </div>
            )}
            {form.requested_employee_id && <p className="text-xs text-emerald-600 font-medium mt-1">Colleague selected ✓</p>}
          </div>
          <div>
            <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Swap Date *</label>
            <input required type="date" className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all"
              value={form.swap_date} onChange={e => setForm(f => ({ ...f, swap_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reason</label>
            <textarea rows={2} className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white resize-none transition-all"
              placeholder="Optional reason…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.requested_employee_id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-60"
              style={{ background: BRAND_GRADIENT }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SwapsTab({ isAdmin, userId }) {
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [showRequest, setShowRequest] = useState(false)
  const [decidingId, setDecidingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = isAdmin
        ? await getShiftSwaps(statusFilter === 'all' ? {} : { status: statusFilter })
        : await getEmployeeSwapRequests(userId)
      setSwaps(r.data)
    } catch { setSwaps([]) }
    finally { setLoading(false) }
  }, [isAdmin, statusFilter, userId])

  useEffect(() => { load() }, [load])

  const handleDecide = async (id, status) => {
    setDecidingId(id)
    try {
      await approveShiftSwap(id, { status })
      toast.success(status === 'approved' ? 'Swap approved' : 'Swap rejected')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update swap')
    } finally { setDecidingId(null) }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-4">
        {isAdmin ? (
          <ViewToggle
            value={statusFilter}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ]}
            onChange={setStatusFilter}
          />
        ) : <div />}
        {!isAdmin && (
          <button onClick={() => setShowRequest(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl"
            style={{ background: BRAND_GRADIENT }}>
            <Plus size={15} /> Request Swap
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-primary-400" /></div>
        ) : swaps.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} message="No swap requests" />
        ) : (
          swaps.map(s => <SwapRow key={s.id} swap={s} isAdmin={isAdmin} onDecide={handleDecide} deciding={decidingId === s.id} />)
        )}
      </div>
      {showRequest && <RequestSwapModal onClose={() => setShowRequest(false)} onSuccess={load} />}
    </div>
  )
}


// ── Main Page ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'user',    label: 'User-specific Operations' },
  { id: 'manage',  label: 'Manage Shifts' },
  { id: 'mapping', label: 'Employee Shift Mapping' },
  { id: 'group',   label: 'Shift Group' },
  { id: 'swaps',   label: 'Swap Requests' },
]

export default function ShiftRosterPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('user')
  const [stats, setStats]         = useState(null)
  const isAdmin = isAdminRole(user)

  useEffect(() => {
    getShiftStats().then(r => setStats(r.data)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-all border-b-2',
                activeTab === t.id
                  ? 'border-primary-600 text-primary-700 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Container className="pt-5">
        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={Clock}          label="Active Shifts"        value={stats.total_shifts}           color={primary[600]} />
            <StatCard icon={Users}          label="Employees with Shift" value={stats.total_mapped_employees} color="#10b981" />
            <StatCard icon={ArrowLeftRight} label="Pending Swaps"        value={stats.pending_swaps}          color="#f59e0b" />
          </div>
        )}

        {activeTab === 'user'    && <UserTab    isAdmin={isAdmin} />}
        {activeTab === 'manage'  && <ManageShiftsTab isAdmin={isAdmin} />}
        {activeTab === 'mapping' && <MappingTab isAdmin={isAdmin} />}
        {activeTab === 'group'   && <ShiftGroupTab />}
        {activeTab === 'swaps'   && <SwapsTab isAdmin={isAdmin} userId={user?.id} />}
      </Container>
    </div>
  )
}
