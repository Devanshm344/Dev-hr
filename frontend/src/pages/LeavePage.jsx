import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyLeaves, getMyLeaveBalance, getPendingLeaves, getTeamPendingLeaves, getAllLeaves, approveLeave, bulkApproveLeaves, getMyAttendance, getMyEnablementRequests, requestLeaveEnablement, ltGetHolidays } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import {
  Plus, Loader2, Calendar, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ChevronDown, MoreHorizontal, List,
  TrendingUp, TrendingDown, AlertCircle, Clock, FileText, ArrowUp,
  Heart, Lock, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import paternityLeaveIcon from '../assets/paternity-leave-icon.png'
import earnedLeaveIcon from '../assets/earned-leave-icon.png'
import lossOfPayIcon from '../assets/loss-of-pay-icon.png'
import sickLeaveIcon from '../assets/sick-leave-icon.svg'
import wfhEmpQuotaIcon from '../assets/wfh-emp-quota-icon.svg'
import wfhManagerQuotaIcon from '../assets/wfh-manager-quota-icon.svg'
import leaveBucketIcon from '../assets/leave-bucket-icon.svg'
import compensatoryOffIcon from '../assets/compensatory-off-icon.svg'
import wfcIcon from '../assets/wfc-icon.svg'
import businessTravelIcon from '../assets/business-travel-icon.svg'
import daysBookedIcon from '../assets/days-booked-icon.svg'
import absentDaysIcon from '../assets/absent-days-icon.svg'
import upcomingIcon from '../assets/upcoming-icon.svg'
import Container from '../components/ui/Container'
import Card from '../components/ui/Card'
import ResponsiveTable from '../components/ui/ResponsiveTable'
import DataTableHead from '../components/ui/DataTableHead'
import { TABLE_CELL, TABLE_CELL_MUTED } from '../components/ui/tableStyles'
import { fmtDays } from '../utils/leave'

const STATUS_COLORS = {
  pending:   'bg-amber-50 text-amber-600 border border-amber-200',
  approved:  'bg-emerald-50 text-emerald-600 border border-emerald-200',
  rejected:  'bg-red-50 text-red-500 border border-red-200',
  cancelled: 'bg-gray-100 text-gray-400 border border-gray-200',
}

// Display order for the Leave Balances grid and the Leave Balance table —
// single source of truth for both views, per the ordering the user specified.
const LEAVE_TYPE_DEFS = [
  { label: 'Earned Leaves',     key: 'Earned Leaves',     Icon: earnedLeaveIcon, bg: 'bg-green-50', text: 'text-green-500',   bar: '#22c55e' },
  { label: 'Loss-of-Pay',       key: 'Loss-of-Pay',       Icon: lossOfPayIcon, bg: 'bg-orange-50', text: 'text-orange-500',  bar: '#f97316' },
  { label: 'Sick Leave',        key: 'Sick Leave',        Icon: sickLeaveIcon, bg: 'bg-pink-50',  text: 'text-pink-500',    bar: '#ec4899' },
  { label: 'WFH_Emp Quota',     key: 'WFH_Emp Quota',    Icon: wfhEmpQuotaIcon, bg: 'bg-cyan-50', text: 'text-cyan-500',    bar: '#06b6d4' },
  { label: 'WFH_Manager Quota', key: 'WFH_Manager Quota', Icon: wfhManagerQuotaIcon, bg: 'bg-blue-50', text: 'text-blue-600',     bar: '#2563eb' },
  { label: 'Leave Bucket',      key: 'Leave Bucket',      Icon: leaveBucketIcon, bg: 'bg-purple-50', text: 'text-purple-500',  bar: '#a855f7' },
  { label: 'Compensatory Off',  key: 'Compensatory Off',  Icon: compensatoryOffIcon, bg: 'bg-emerald-50', text: 'text-emerald-500', bar: '#10b981' },
  { label: 'WFC (Work From Client)', key: 'WFC (Work From Client)', Icon: wfcIcon, bg: 'bg-amber-50', text: 'text-amber-500', bar: '#f59e0b' },
  { label: 'Business Travel',   key: 'Business Travel',   Icon: businessTravelIcon, bg: 'bg-sky-50', text: 'text-sky-500',     bar: '#0ea5e9' },
  { label: 'Maternity Leave',   key: 'Maternity Leave',   Icon: Heart,       bg: 'bg-rose-50',    text: 'text-rose-500',    bar: '#f43f5e' },
  { label: 'Paternity Leave',   key: 'Paternity Leave',   Icon: paternityLeaveIcon, bg: 'bg-teal-50', text: 'text-teal-500',    bar: '#14b8a6' },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Parse date string as local (avoids UTC-shift off-by-one)
function parseLocal(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


function fmt(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}
function fmtAbsent(d) {
  const dt   = parseLocal(d)
  const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
  const day  = dt.toLocaleDateString('en-US', { weekday: 'long' })
  return `${date}, ${day}`
}
function fmtPast(d, short = false) {
  const dt   = new Date(d)
  const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
  const day  = dt.toLocaleDateString('en-US', { weekday: short ? 'short' : 'long' })
  return `${date}, ${day}`
}
function SectionPanel({ open, onToggle, icon: Icon, iconBg, iconColor, title, subtitle, badge, badgeColor, children }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
            <Icon size={16} className={iconColor} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge != null && badge > 0 && (
            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums', badgeColor)}>
              {badge}
            </span>
          )}
          <ChevronDown size={16} className={clsx('text-gray-500 transition-transform duration-300', open && 'rotate-180')} />
        </div>
      </button>
      {open && <div className="border-t border-slate-50 animate-fade-up">{children}</div>}
    </div>
  )
}

function EmptyState({ icon: Icon, iconBg, iconColor, message }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-12">
      <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center', iconBg)}>
        <Icon size={24} className={iconColor} />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

// Purely decorative area-chart flourish for KPI tiles — static shape, tinted
// per card's accent color. Not data-bound; the reference design calls for a
// "decorative gradient chart" alongside the real (bound) number.
function MiniSparkline({ color, gradientId }) {
  return (
    <svg viewBox="0 0 100 40" className="w-16 h-9 sm:w-20 sm:h-10 flex-shrink-0" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,28 C10,22 18,32 28,24 C38,16 46,26 56,18 C66,10 74,20 84,14 C90,10 96,12 100,8 L100,40 L0,40 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M0,28 C10,22 18,32 28,24 C38,16 46,26 56,18 C66,10 74,20 84,14 C90,10 96,12 100,8"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LeaveKpiCard({ label, icon: Icon, badge, bar, available, used, total, idx }) {
  const usedPct   = total > 0 ? Math.round((used  / total) * 100) : 0
  const availPct  = total > 0 ? Math.round((available / total) * 100) : 100
  const isNeg     = available < 0

  let TrendIcon, trendColor, trendBg, trendLabel, trendSub
  if (used === 0) {
    TrendIcon  = ArrowUp
    trendColor = '#059669'
    trendBg    = '#ecfdf5'
    trendLabel = 'Full balance'
    trendSub   = 'No usage yet'
  } else if (availPct >= 50) {
    TrendIcon  = TrendingUp
    trendColor = '#059669'
    trendBg    = '#ecfdf5'
    trendLabel = `+${availPct}%`
    trendSub   = 'remaining'
  } else if (availPct >= 20) {
    TrendIcon  = TrendingDown
    trendColor = '#d97706'
    trendBg    = '#fffbeb'
    trendLabel = `-${usedPct}%`
    trendSub   = 'utilized'
  } else {
    TrendIcon  = TrendingDown
    trendColor = '#dc2626'
    trendBg    = '#fef2f2'
    trendLabel = `-${usedPct}%`
    trendSub   = 'utilized'
  }

  return (
    <div
      className="group bg-white rounded-[20px] relative overflow-hidden border border-[#EEF2F7] transition-all duration-300 hover:-translate-y-1"
      style={{
        borderLeft: `4px solid ${bar}`,
        boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
        animationDelay: `${idx * 40}ms`,
      }}
    >
      <div className="p-6">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: bar + '1a' }}
          >
            {badge
              ? <span className="text-xs sm:text-sm lg:text-base font-black" style={{ color: bar }}>{badge}</span>
              : typeof Icon === 'string'
                ? <img src={Icon} alt="" className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 object-contain" />
                : <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" style={{ color: bar }} />
            }
          </div>
          <div
            className="w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 text-gray-400 transition-transform duration-300 group-hover:rotate-45"
            style={{ borderColor: '#EEF2F7' }}
            aria-hidden="true"
          >
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-bold text-gray-800 uppercase leading-snug" style={{ letterSpacing: '1px' }}>
          {label}
        </p>

        {/* Value */}
        <p
          className="text-4xl font-bold tabular-nums leading-none mt-3"
          style={{ color: isNeg ? '#dc2626' : '#0f172a' }}
        >
          {available}
        </p>
        <p className="text-widget-label text-gray-500 mt-1.5">days available</p>

        {/* Trend row */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ color: trendColor, backgroundColor: trendBg }}
          >
            <TrendIcon size={12} /> {trendLabel}
          </span>
          <span className="text-body text-gray-400">{trendSub}</span>
          {used > 0 && (
            <span className="text-body text-gray-400 ml-auto tabular-nums">{used}d used</span>
          )}
        </div>
      </div>
    </div>
  )
}

// Shown instead of a balance card for admin-enable-required leave types
// (Maternity, Paternity, ...) until the employee's enablement request is approved.
function RequestAccessCard({ label, icon: Icon, badge, bar, idx, status, onRequest, requesting }) {
  return (
    <div
      className="group bg-white rounded-[20px] relative overflow-hidden border border-[#EEF2F7] flex flex-col justify-between transition-all duration-300 hover:-translate-y-1"
      style={{ borderLeft: `4px solid ${bar}`, boxShadow: '0 8px 30px rgba(15,23,42,0.06)', animationDelay: `${idx * 40}ms` }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: bar + '1a' }}
          >
            {badge
              ? <span className="text-xs sm:text-sm lg:text-base font-black" style={{ color: bar }}>{badge}</span>
              : typeof Icon === 'string'
                ? <img src={Icon} alt="" className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 object-contain" />
                : <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" style={{ color: bar }} />
            }
          </div>
          <div
            className="w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 text-gray-400"
            style={{ borderColor: '#EEF2F7' }}
            aria-hidden="true"
          >
            <ChevronRight size={14} />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-800 uppercase leading-snug" style={{ letterSpacing: '1px' }}>{label}</p>
        <div className="flex items-center gap-1.5 text-gray-400 mt-4 mb-3">
          <Lock size={13} />
          <span className="text-body">Not enabled yet</span>
        </div>
        {status === 'pending' ? (
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg inline-block">
            Request pending admin review
          </span>
        ) : (
          <button
            type="button"
            onClick={onRequest}
            disabled={requesting}
            className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3.5 py-1.5 hover:bg-blue-100 transition-colors disabled:opacity-60"
          >
            {requesting ? 'Requesting…' : 'Request Access'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function LeavePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [leaves, setLeaves]               = useState([])
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [teamPendingLeaves, setTeamPendingLeaves] = useState([])
  const [isManager, setIsManager]         = useState(false)
  const [processedLeaves, setProcessedLeaves] = useState([])
  const [balance, setBalance]             = useState([])
  const [activeTab, setActiveTab]         = useState('summary')
  const [loading, setLoading]             = useState(true)
  const [currentYear, setCurrentYear]     = useState(new Date().getFullYear())
  const [viewMode, setViewMode]           = useState('list')   // 'list' | 'calendar'
  const [calYear, setCalYear]             = useState(new Date().getFullYear())
  const [calMonth, setCalMonth]           = useState(new Date().getMonth())
  const [upcomingOpen, setUpcomingOpen]   = useState(true)
  const [absentOpen, setAbsentOpen]       = useState(true)
  const [absentRecords, setAbsentRecords] = useState([])
  const [pastOpen, setPastOpen]           = useState(true)
  const [balMounted, setBalMounted]       = useState(false)
  const [enablementRequests, setEnablementRequests] = useState([])
  const [requestingType, setRequestingType] = useState(null)
  const [editingLeave, setEditingLeave]     = useState(null)   // leave row open in the override modal, or null
  const [overrideStatus, setOverrideStatus] = useState('approved')
  const [savingOverride, setSavingOverride] = useState(false)
  const [selectedApprovalIds, setSelectedApprovalIds] = useState(new Set())
  const [bulkActing, setBulkActing]         = useState(false)
  const [holidays, setHolidays]             = useState([])
  const [viewingLeave, setViewingLeave]     = useState(null)   // past-leave row open in the read-only details modal, or null
  const [openMenuId, setOpenMenuId]         = useState(null)   // which past-leave row's "..." menu is open

  const isAdmin = isAdminRole(user)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    setBalMounted(false)
    try {
      const [leavesRes, balRes, attRes, teamPendRes, enablementRes, holidaysRes] = await Promise.all([
        getMyLeaves(), getMyLeaveBalance(),
        getMyAttendance({ year: new Date().getFullYear(), full_year: true }),
        getTeamPendingLeaves(),
        getMyEnablementRequests(),
        ltGetHolidays(new Date().getFullYear()),   // self-scoped to the employee's own office
      ])
      setLeaves(leavesRes.data)
      setBalance(balRes.data)
      setHolidays(holidaysRes.data?.holidays ?? [])
      setEnablementRequests(enablementRes.data ?? [])
      setIsManager(teamPendRes.data?.is_manager ?? false)
      setTeamPendingLeaves(teamPendRes.data?.leaves ?? [])
      const absent = (attRes.data.records || [])
        .filter(r => r.status === 'absent')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      setAbsentRecords(absent)
      if (isAdmin) {
        const pendRes = await getPendingLeaves()
        setPendingLeaves(pendRes.data)
        const [approvedRes, rejectedRes] = await Promise.all([
          getAllLeaves({ status: 'approved', limit: 1000 }),
          getAllLeaves({ status: 'rejected', limit: 1000 }),
        ])
        const processed = [...approvedRes.data.leaves, ...rejectedRes.data.leaves]
          .sort((a, b) => new Date(b.approved_at || b.created_at) - new Date(a.approved_at || a.created_at))
        setProcessedLeaves(processed)
      }
    } catch {} finally {
      setLoading(false)
      setTimeout(() => setBalMounted(true), 150)
    }
  }

  const handleApprove = async (id, status) => {
    try {
      await approveLeave(id, { status })
      toast.success(`Leave ${status}!`)
      loadData()
    } catch { toast.error('Action failed') }
  }

  const toggleApprovalSelect = (id) => {
    setSelectedApprovalIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleApprovalSelectAll = () => {
    setSelectedApprovalIds(prev =>
      prev.size === teamPendingLeaves.length ? new Set() : new Set(teamPendingLeaves.map(l => l.id))
    )
  }
  const handleBulkApprove = async (status) => {
    const ids = Array.from(selectedApprovalIds)
    if (ids.length === 0) return
    setBulkActing(true)
    try {
      const res = await bulkApproveLeaves(ids, status)
      const results = res.data.results
      const ok = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success)
      if (failed.length === 0) toast.success(`${ok} leave${ok === 1 ? '' : 's'} ${status}`)
      else if (ok === 0) toast.error(failed[0]?.error || 'Bulk action failed')
      else toast.success(`${ok} ${status}, ${failed.length} failed`)
      setSelectedApprovalIds(new Set())
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk action failed')
    } finally {
      setBulkActing(false)
    }
  }

  const handleOverrideSave = async () => {
    if (!editingLeave || overrideStatus === editingLeave.status) return
    setSavingOverride(true)
    try {
      await approveLeave(editingLeave.id, { status: overrideStatus })
      toast.success(`Leave status updated to ${overrideStatus}`)
      setEditingLeave(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update leave status')
    } finally {
      setSavingOverride(false)
    }
  }

  const handleRequestEnablement = async (leaveTypeId, label) => {
    setRequestingType(leaveTypeId)
    try {
      await requestLeaveEnablement({ leave_type_id: leaveTypeId })
      toast.success(`${label} access requested — awaiting admin approval.`)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not submit the request')
    } finally {
      setRequestingType(null)
    }
  }

  const prevCalMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextCalMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  // ── Derived values ────────────────────────────────────────────
  const totalBooked = fmtDays(LEAVE_TYPE_DEFS.reduce((sum, { key }) => {
    const b = balance.find(b => b.leave_type?.toLowerCase().trim() === key.toLowerCase().trim())
    return sum + (b?.used_days || 0)
  }, 0))
  const upcomingLeaves = leaves
    .filter(l => l.status === 'approved' && new Date(l.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  const pastLeaves = leaves
    .filter(l => new Date(l.end_date) < new Date())
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  const upcomingHolidays = holidays
    .filter(h => new Date(h.date) >= new Date(toDateStr(new Date())))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const pastHolidays = holidays
    .filter(h => new Date(h.date) < new Date(toDateStr(new Date())))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const leaveTypeColorMap = Object.fromEntries(
    LEAVE_TYPE_DEFS.map(({ key, bar }) => [key.toLowerCase().trim(), bar])
  )
  const HOLIDAY_DOT = '#0ea5e9'
  const upcomingItems = [
    ...upcomingLeaves.map(l => ({ kind: 'leave', sortDate: l.start_date, data: l })),
    ...upcomingHolidays.map(h => ({ kind: 'holiday', sortDate: h.date, data: h })),
  ].sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate))
  const pastItems = [
    ...pastLeaves.map(l => ({ kind: 'leave', sortDate: l.start_date, data: l })),
    ...pastHolidays.map(h => ({ kind: 'holiday', sortDate: h.date, data: h })),
  ].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))

  // Calendar grid — array of 35 or 42 slots (nulls for padding)
  const calDays = useMemo(() => {
    const firstWeekday = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate()
    const cells = Array(firstWeekday).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calYear, calMonth])

  // Map dateStr → array of event objects for the calendar
  const calendarEvents = useMemo(() => {
    const map = {}
    absentRecords.forEach(r => {
      if (!map[r.date]) map[r.date] = []
      map[r.date].push({ label: 'Absent', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' })
    })
    leaves.filter(l => ['approved', 'pending'].includes(l.status)).forEach(l => {
      const start = parseLocal(l.start_date)
      const end   = parseLocal(l.end_date)
      const c     = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
      const cur   = new Date(start)
      while (cur <= end) {
        const ds = toDateStr(cur)
        if (!map[ds]) map[ds] = []
        if (!map[ds].some(e => e.leaveId === l.id)) {
          map[ds].push({ label: l.leave_type, bg: c + '22', color: c, border: c + '55', leaveId: l.id, pending: l.status === 'pending' })
        }
        cur.setDate(cur.getDate() + 1)
      }
    })
    return map
  }, [leaves, absentRecords, leaveTypeColorMap])

  const tabs = [
    { id: 'summary',  label: 'Leave Summary' },
    { id: 'balance',  label: 'Leave Balance' },
    { id: 'requests', label: 'Leave Requests' },
    // Visible only when the logged-in employee is someone's manager (Employee.manager_id hierarchy) — not role-based
    ...(isManager ? [{ id: 'teamApprovals', label: 'Team Approvals', count: teamPendingLeaves.length }] : []),
    // Pending Approvals tab hidden for all Admins per request — content/logic kept intact for quick re-enable
    ...(isAdmin ? [{ id: 'viewApprovals', label: 'View Approvals' }] : [])
  ]
  const handleTabChange = (id) => {
    setActiveTab(id)
    setBalMounted(false)
    setTimeout(() => setBalMounted(true), 200)
  }

  const today = new Date()

  // ── Calendar Legend ───────────────────────────────────────────
  const legendItems = [
    { label: 'Absent',   bg: '#fee2e2', border: '#fca5a5', color: '#dc2626' },
    ...LEAVE_TYPE_DEFS.slice(0, 4).map(({ label, bar }) => ({
      label, bg: bar + '22', border: bar + '55', color: bar
    }))
  ]

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Pill tab navigation ── */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-1 py-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 flex items-center gap-1.5',
                activeTab === t.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={clsx(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
                  activeTab === t.id ? 'bg-white/25 text-white' : 'bg-red-500 text-white animate-scale-in'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Container>

        {/* ── LEAVE SUMMARY TAB ── */}
        {activeTab === 'summary' && (
          <div className="space-y-8 animate-fade-up">

            {/* Hero — light enterprise overview panel */}
            <div
              className="relative overflow-hidden rounded-[20px] p-6 sm:p-7 border border-[#E0EAFB]"
              style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #E0F2FE 100%)', boxShadow: '0 8px 30px rgba(15,23,42,0.05)' }}
            >
              <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-blue-200/20" />
              <div className="absolute right-24 bottom-0 w-32 h-32 rounded-full bg-blue-200/20" />
              <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-sky-200/20" />

              <div className="relative flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-blue-600/70 text-xs font-bold uppercase mb-1" style={{ letterSpacing: '1px' }}>Leave Overview</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentYear(y => y - 1)} className="p-1.5 rounded-lg bg-white border border-[#E0EAFB] text-blue-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-slate-900 font-semibold tabular-nums text-sm px-1">
                      01 Jan {currentYear} – 31 Dec {currentYear}
                    </span>
                    <button onClick={() => setCurrentYear(y => y + 1)} className="p-1.5 rounded-lg bg-white border border-[#E0EAFB] text-blue-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* List / Calendar toggle */}
                  <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-[#E0EAFB]">
                    <button
                      onClick={() => setViewMode('list')}
                      title="List view"
                      className={clsx(
                        'p-2 rounded-lg transition-all duration-200',
                        viewMode === 'list'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-blue-700 hover:bg-blue-50'
                      )}
                    >
                      <List size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode('calendar')}
                      title="Calendar view"
                      className={clsx(
                        'p-2 rounded-lg transition-all duration-200',
                        viewMode === 'calendar'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-blue-700 hover:bg-blue-50'
                      )}
                    >
                      <Calendar size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => navigate('/leave/apply')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200 shadow-lg shadow-blue-600/20"
                  >
                    <Plus size={15} /> Apply Leave
                  </button>
                </div>
              </div>

              {/* Stat tiles */}
              <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {[
                  { label: 'Days Booked', value: totalBooked,           Icon: daysBookedIcon, color: '#0ea5e9', tint: 'bg-sky-50' },
                  { label: 'Absent Days', value: absentRecords.length,  Icon: absentDaysIcon, color: '#f43f5e', tint: 'bg-rose-50' },
                  { label: 'Upcoming',    value: upcomingLeaves.length, Icon: upcomingIcon, color: '#10b981', tint: 'bg-emerald-50' },
                ].map(({ label, value, Icon, color, tint }) => (
                  <div
                    key={label}
                    className="group bg-white rounded-[18px] p-5 flex items-center justify-between gap-3 border border-[#EEF2F7] transition-all duration-300 hover:-translate-y-1"
                    style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.06)' }}
                  >
                    <div>
                      <div className={clsx('w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110', tint)}>
                        {typeof Icon === 'string'
                          ? <img src={Icon} alt="" className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-10 xl:h-10 object-contain" />
                          : <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-10 xl:h-10" style={{ color }} />
                        }
                      </div>
                      <p className="text-4xl font-bold tabular-nums leading-none text-slate-900">{value}</p>
                      <p className="text-sm text-gray-500 font-medium mt-2">{label}</p>
                    </div>
                    <MiniSparkline color={color} gradientId={`spark-${label.replace(/\s+/g, '-')}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── LIST VIEW ── */}
            {viewMode === 'list' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={28} className="animate-spin text-blue-400" />
                  </div>
                ) : (
                  <>
                    {/* Balance KPI cards grid */}
                    <div>
                      <p className="text-sm font-bold text-gray-600 uppercase px-1 mb-4" style={{ letterSpacing: '1px' }}>Leave Balances</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {LEAVE_TYPE_DEFS.map(({ label, key, Icon, badge, bar }, idx) => {
                          const data = balance.find(b => b.leave_type?.toLowerCase().trim() === key.toLowerCase().trim())
                          // Eligibility (gender, manager/non-manager, ...) is entirely config-driven
                          // server-side — no matching balance entry means "not eligible for this
                          // leave type," so hide the card instead of re-deriving eligibility here.
                          if (!data) return null

                          // Eligible but not yet enabled by an admin (no real balance row exists) — offer to request access.
                          if (data.id == null) {
                            const pending = enablementRequests.some(r => r.leave_type_id === data.leave_type_id && r.status === 'pending')
                            return (
                              <RequestAccessCard
                                key={key}
                                label={label}
                                icon={Icon}
                                badge={badge}
                                bar={bar}
                                idx={idx}
                                status={pending ? 'pending' : 'none'}
                                requesting={requestingType === data.leave_type_id}
                                onRequest={() => handleRequestEnablement(data.leave_type_id, label)}
                              />
                            )
                          }

                          const available = fmtDays(data?.remaining_days)
                          const used      = fmtDays(data?.used_days)
                          const total     = fmtDays(data?.total_days)
                          return (
                            <LeaveKpiCard
                              key={key}
                              label={label}
                              icon={Icon}
                              badge={badge}
                              bar={bar}
                              available={available}
                              used={used}
                              total={total}
                              idx={idx}
                            />
                          )
                        })}
                      </div>
                    </div>

                    {/* Absent */}
                    <SectionPanel
                      open={absentOpen} onToggle={() => setAbsentOpen(o => !o)}
                      icon={AlertCircle} iconBg="bg-amber-50" iconColor="text-amber-500"
                      title="Absent Days"
                      subtitle={absentRecords.length > 0 ? `${absentRecords.length} day${absentRecords.length !== 1 ? 's' : ''} without leave applied` : 'No absent days this year'}
                      badge={absentRecords.length} badgeColor="text-amber-600 bg-amber-50 border border-amber-100"
                    >
                      {absentRecords.length === 0 ? (
                        <EmptyState icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-400" message="Great! No absent days this year." />
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {absentRecords.map(r => (
                            <div key={r.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-1 h-8 rounded-full bg-amber-400 flex-shrink-0" />
                                <span className="text-sm text-gray-800 font-medium">{fmtAbsent(r.date)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-full">1 day</span>
                                <button
                                  onClick={() => navigate('/leave/apply', { state: { initialDates: { start: r.date, end: r.date } } })}
                                  className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 hover:bg-blue-100 transition-colors"
                                >Apply Leave</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionPanel>

                    {/* Upcoming */}
                    <SectionPanel
                      open={upcomingOpen} onToggle={() => setUpcomingOpen(o => !o)}
                      icon={Clock} iconBg="bg-emerald-50" iconColor="text-emerald-500"
                      title="Upcoming Leaves & Holidays"
                      subtitle={upcomingItems.length > 0 ? `${upcomingLeaves.length} upcoming leave${upcomingLeaves.length !== 1 ? 's' : ''}, ${upcomingHolidays.length} holiday${upcomingHolidays.length !== 1 ? 's' : ''}` : 'No upcoming leaves or holidays'}
                      badge={upcomingItems.length} badgeColor="text-emerald-700 bg-emerald-50 border border-emerald-100"
                    >
                      {upcomingItems.length === 0 ? (
                        <EmptyState icon={Calendar} iconBg="bg-gray-50" iconColor="text-gray-300" message="No upcoming leaves or holidays scheduled" />
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {upcomingItems.map(item => {
                            if (item.kind === 'holiday') {
                              const h = item.data
                              return (
                                <div key={`h-${h.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: HOLIDAY_DOT }} />
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{fmtPast(h.date, false)}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{h.name}</p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ backgroundColor: HOLIDAY_DOT + '18', color: HOLIDAY_DOT }}>
                                    {h.holiday_type} holiday
                                  </span>
                                </div>
                              )
                            }
                            const l = item.data
                            const dotColor = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
                            const isRange  = l.start_date !== l.end_date
                            return (
                              <div key={`l-${l.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{fmtPast(l.start_date, false)}</p>
                                    {isRange && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><ChevronRight size={9} /> {fmtPast(l.end_date, true)}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: dotColor + '18', color: dotColor }}>{l.leave_type}</span>
                                  <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full capitalize', STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-400')}>{l.status}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </SectionPanel>

                    {/* Past */}
                    <SectionPanel
                      open={pastOpen} onToggle={() => setPastOpen(o => !o)}
                      icon={FileText} iconBg="bg-slate-100" iconColor="text-slate-500"
                      title="Past Leaves & Holidays"
                      subtitle={pastItems.length > 0 ? `${pastLeaves.length} past leave record${pastLeaves.length !== 1 ? 's' : ''}, ${pastHolidays.length} holiday${pastHolidays.length !== 1 ? 's' : ''}` : 'No past leaves or holidays'}
                      badge={pastItems.length} badgeColor="text-slate-500 bg-slate-100"
                    >
                      {pastItems.length === 0 ? (
                        <EmptyState icon={FileText} iconBg="bg-gray-50" iconColor="text-gray-300" message="No past leaves or holidays found" />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Date</th>
                                <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Type</th>
                                <th className="px-5 py-2.5 font-semibold">Reason</th>
                                <th className="px-5 py-2.5 font-semibold text-center whitespace-nowrap">Days</th>
                                <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Status</th>
                                <th className="px-5 py-2.5 font-semibold text-right whitespace-nowrap">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {pastItems.map(item => {
                                if (item.kind === 'holiday') {
                                  const h = item.data
                                  return (
                                    <tr key={`h-${h.id}`} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: HOLIDAY_DOT }} />
                                          <p className="text-sm font-medium text-gray-800">{fmtPast(h.date, true)}</p>
                                        </div>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ backgroundColor: HOLIDAY_DOT + '18', color: HOLIDAY_DOT }}>{h.holiday_type} holiday</span>
                                      </td>
                                      <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs truncate">{h.name}</td>
                                      <td className="px-5 py-3.5 text-center tabular-nums text-gray-700 font-medium whitespace-nowrap">1d</td>
                                      <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">—</td>
                                      <td className="px-5 py-3.5 text-right whitespace-nowrap">—</td>
                                    </tr>
                                  )
                                }
                                const l = item.data
                                const isRange  = l.start_date !== l.end_date
                                const dotColor = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
                                return (
                                  <tr key={`l-${l.id}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      <div className="flex items-center gap-3">
                                        <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                                        <div>
                                          <p className="text-sm font-medium text-gray-800">{fmtPast(l.start_date, isRange)}</p>
                                          {isRange && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><ChevronRight size={9} /> {fmtPast(l.end_date, true)}</p>}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: dotColor + '18', color: dotColor }}>{l.leave_type}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs truncate">{l.reason || '—'}</td>
                                    <td className="px-5 py-3.5 text-center tabular-nums text-gray-700 font-medium whitespace-nowrap">{l.days}d</td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-400')}>{l.status}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right whitespace-nowrap relative">
                                      <button
                                        onClick={() => setOpenMenuId(id => id === l.id ? null : l.id)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                      ><MoreHorizontal size={14} /></button>
                                      {openMenuId === l.id && (
                                        <>
                                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                          <div className="absolute right-5 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40 text-left">
                                            <button
                                              onClick={() => { setViewingLeave(l); setOpenMenuId(null) }}
                                              className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-slate-50"
                                            >View details</button>
                                          </div>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </SectionPanel>
                  </>
                )}
              </>
            )}

            {/* ── CALENDAR VIEW ── */}
            {viewMode === 'calendar' && (
              <div className="bg-white rounded-2xl overflow-hidden animate-fade-up" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>

                {/* Calendar toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <button onClick={prevCalMonth} className="p-2 rounded-xl hover:bg-slate-100 text-gray-600 transition-colors">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()) }}
                      title="Back to today"
                      className="p-2 rounded-xl hover:bg-slate-100 text-gray-600 transition-colors"
                    >
                      <Calendar size={14} />
                    </button>
                    <button onClick={nextCalMonth} className="p-2 rounded-xl hover:bg-slate-100 text-gray-600 transition-colors">
                      <ChevronRight size={15} />
                    </button>
                    <h3 className="text-base font-bold text-gray-800 ml-1">
                      {new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>

                  {/* Legend */}
                  <div className="hidden md:flex items-center gap-3 flex-wrap">
                    {legendItems.map(item => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded flex-shrink-0"
                          style={{ backgroundColor: item.bg, border: `1px solid ${item.border}` }}
                        />
                        <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day header row */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {WEEKDAYS.map((day, i) => (
                    <div
                      key={day}
                      className={clsx(
                        'py-3 text-center text-xs font-bold uppercase tracking-widest',
                        (i === 0 || i === 6) ? 'text-gray-500' : 'text-gray-700'
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div
                  className="grid grid-cols-7"
                  style={{ borderLeft: '1px solid #f1f5f9', borderTop: '1px solid #f1f5f9' }}
                >
                  {calDays.map((day, idx) => {
                    const col       = idx % 7
                    const isWeekend = col === 0 || col === 6
                    const isToday   = day &&
                      calYear === today.getFullYear() &&
                      calMonth === today.getMonth() &&
                      day === today.getDate()
                    const dateStr   = day
                      ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      : null
                    const events = dateStr ? (calendarEvents[dateStr] || []) : []
                    const hasAbsent = events.some(e => e.label === 'Absent')

                    return (
                      <div
                        key={idx}
                        className={clsx(
                          'relative group min-h-[108px] p-2 transition-colors',
                          !day     && 'bg-slate-50/40',
                          day && isWeekend && !hasAbsent && 'bg-amber-50/30',
                          day && !isWeekend && 'bg-white',
                          day && hasAbsent && 'bg-rose-50/40',
                          day && 'hover:bg-blue-50/20'
                        )}
                        style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}
                      >
                        {day && (
                          <>
                            {/* Day number + quick apply button */}
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={clsx(
                                  'w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full select-none',
                                  isToday
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/40'
                                    : isWeekend
                                      ? 'text-gray-500'
                                      : 'text-gray-800'
                                )}
                              >
                                {day}
                              </span>
                              <button
                                onClick={() => navigate('/leave/apply', { state: { initialDates: { start: dateStr, end: dateStr } } })}
                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all duration-150 flex-shrink-0"
                              >
                                <Plus size={11} />
                              </button>
                            </div>

                            {/* Event pills */}
                            <div className="space-y-0.5">
                              {events.slice(0, 3).map((ev, ei) => (
                                <div
                                  key={ei}
                                  className="text-dense-tight font-semibold px-1.5 py-0.5 rounded truncate leading-snug"
                                  style={{
                                    backgroundColor: ev.bg,
                                    color: ev.color,
                                    border: `1px solid ${ev.border}`,
                                    opacity: ev.pending ? 0.7 : 1
                                  }}
                                  title={ev.pending ? `${ev.label} (Pending)` : ev.label}
                                >
                                  {ev.pending ? `${ev.label}*` : ev.label}
                                </div>
                              ))}
                              {events.length > 3 && (
                                <div className="text-dense-tight text-gray-600 font-semibold px-1.5">
                                  +{events.length - 3} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Calendar footer hint */}
                <div className="px-5 py-3 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Hover a date to quickly apply leave &nbsp;·&nbsp; <span className="text-gray-500">* = Pending approval</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0" style={{ backgroundColor: '#2563eb' }} />
                    <span className="text-xs text-gray-600 font-medium">Today</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LEAVE BALANCE TAB ── */}
        {activeTab === 'balance' && (
          <div className="bg-white rounded-2xl overflow-hidden animate-fade-up" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="px-6 py-5 border-b border-slate-50">
              <h2 className="text-sm font-bold text-gray-800">Leave Balance</h2>
              <p className="text-xs text-gray-500 mt-0.5">Current year entitlements and usage</p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-400" /></div>
            ) : (
              <ResponsiveTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60">
                    {['Leave Type', 'Total', 'Used', 'Available', 'Usage'].map(h => (
                      <th key={h} className={clsx('px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider', h === 'Leave Type' || h === 'Usage' ? 'text-left' : 'text-center')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {LEAVE_TYPE_DEFS.map(({ label, key, Icon, badge, bg, text, bar }, i) => {
                    const b = balance.find(x => x.leave_type?.toLowerCase().trim() === key.toLowerCase().trim())
                    if (!b) return null
                    const total = fmtDays(b.total_days); const used = fmtDays(b.used_days); const avail = fmtDays(b.remaining_days)
                    const pct   = total > 0 ? Math.min(Math.max((used / total) * 100, 0), 100) : 0
                    return (
                      <tr
                        key={key}
                        className="transition-colors animate-fade-up hover:bg-slate-50"
                        style={{ animationDelay: `${i * 45}ms` }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className={clsx('w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
                              {badge
                                ? <span className={clsx('text-dense-tight sm:text-xs font-black', text)}>{badge}</span>
                                : typeof Icon === 'string'
                                  ? <img src={Icon} alt="" className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 object-contain" />
                                  : <Icon className={clsx('w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5', text)} />
                              }
                            </div>
                            <span className="font-semibold text-gray-800">{label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700 tabular-nums font-medium">{total}</td>
                        <td className="px-6 py-4 text-center text-gray-700 tabular-nums font-medium">{used}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-black tabular-nums" style={{ color: avail < 0 ? '#ef4444' : bar }}>{avail}</span>
                        </td>
                        <td className="px-6 py-4 w-48">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full" style={{ width: balMounted ? `${pct}%` : '0%', backgroundColor: bar, transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms` }} />
                            </div>
                            <span className="text-xs text-gray-600 font-medium w-9 text-right tabular-nums">{Math.round(pct)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </ResponsiveTable>
            )}
          </div>
        )}

        {/* ── LEAVE REQUESTS TAB ── */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-2xl overflow-hidden animate-fade-up" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-800">Leave Requests</h2>
                <p className="text-xs text-gray-500 mt-0.5">{leaves.length} total request{leaves.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => navigate('/leave/apply')} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30">
                <Plus size={13} /> Apply Leave
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-400" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <DataTableHead columns={['Leave Type', 'Duration', 'Days', 'Reason', 'Status', 'Applied On']} centered={['Days', 'Status']} />
                  <tbody className="divide-y divide-slate-50">
                    {leaves.map((l, i) => {
                      const dotColor = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
                      return (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors animate-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                          <td className={TABLE_CELL}><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} /><span className="font-semibold text-gray-800">{l.leave_type}</span></div></td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>
                            {fmt(l.start_date)}{l.start_date !== l.end_date && <span className="text-gray-500 mx-1.5">→</span>}{l.start_date !== l.end_date && fmt(l.end_date)}
                          </td>
                          <td className={clsx(TABLE_CELL, 'text-center')}><span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">{l.days}d</span></td>
                          <td className={clsx(TABLE_CELL, 'max-w-xs truncate')}>{l.reason}</td>
                          <td className={clsx(TABLE_CELL, 'text-center')}><span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize', STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-400')}>{l.status}</span></td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>{fmt(l.created_at)}</td>
                        </tr>
                      )
                    })}
                    {leaves.length === 0 && <tr><td colSpan="6" className="py-4"><EmptyState icon={FileText} iconBg="bg-gray-50" iconColor="text-gray-300" message="No leave requests found" /></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TEAM APPROVALS TAB (manager_id hierarchy — pending leaves of direct reports) ── */}
        {activeTab === 'teamApprovals' && isManager && (
          <div className="bg-white rounded-2xl overflow-hidden animate-fade-up" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-800">Pending Approvals</h2>
                <p className="text-xs text-gray-500 mt-0.5">{teamPendingLeaves.length > 0 ? `${teamPendingLeaves.length} request${teamPendingLeaves.length !== 1 ? 's' : ''} awaiting review` : 'All caught up'}</p>
              </div>
              {teamPendingLeaves.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />{teamPendingLeaves.length} pending
                </span>
              )}
            </div>

            {/* Bulk action bar — shown once at least one row is selected */}
            {selectedApprovalIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 px-6 py-3 bg-blue-50 border-b border-blue-100">
                <span className="text-xs font-bold text-blue-700">{selectedApprovalIds.size} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBulkApprove('approved')}
                    disabled={bulkActing}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50"
                  >
                    {bulkActing ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Approve Selected
                  </button>
                  <button
                    onClick={() => handleBulkApprove('rejected')}
                    disabled={bulkActing}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50"
                  >
                    {bulkActing ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />} Reject Selected
                  </button>
                  <button
                    onClick={() => setSelectedApprovalIds(new Set())}
                    disabled={bulkActing}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1.5"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-400" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <DataTableHead
                    columns={['Employee', 'Leave Type', 'Duration', 'Days', 'Reason', 'Actions']}
                    centered={['Days']}
                    right={['Actions']}
                    leading={teamPendingLeaves.length > 0 && (
                      <input
                        type="checkbox"
                        checked={selectedApprovalIds.size === teamPendingLeaves.length}
                        onChange={toggleApprovalSelectAll}
                        className="rounded border-gray-300"
                      />
                    )}
                  />
                  <tbody className="divide-y divide-slate-50">
                    {teamPendingLeaves.map((l, i) => {
                      const dotColor = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
                      const initials = l.employee_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'
                      return (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors animate-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                          <td className={TABLE_CELL}>
                            <input
                              type="checkbox"
                              checked={selectedApprovalIds.has(l.id)}
                              onChange={() => toggleApprovalSelect(l.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className={TABLE_CELL}><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ backgroundColor: dotColor + '20', color: dotColor }}>{initials}</div><span className="font-semibold text-gray-800">{l.employee_name}</span></div></td>
                          <td className={TABLE_CELL}><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} /><span className="font-medium text-gray-800">{l.leave_type}</span></div></td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>
                            {fmt(l.start_date)}{l.start_date !== l.end_date && <span className="text-gray-500 mx-1.5">→</span>}{l.start_date !== l.end_date && fmt(l.end_date)}
                          </td>
                          <td className={clsx(TABLE_CELL, 'text-center')}><span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">{l.days}d</span></td>
                          <td className={clsx(TABLE_CELL, 'max-w-xs truncate')}>{l.reason}</td>
                          <td className={TABLE_CELL}>
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleApprove(l.id, 'approved')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"><CheckCircle size={11} /> Approve</button>
                              <button onClick={() => handleApprove(l.id, 'rejected')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-100"><XCircle size={11} /> Reject</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {teamPendingLeaves.length === 0 && <tr><td colSpan="7" className="py-4"><EmptyState icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-400" message="All caught up — no pending approvals." /></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PENDING APPROVALS TAB ── */}
        {activeTab === 'pending' && isAdmin && (
          <div className="bg-white rounded-2xl overflow-hidden animate-fade-up" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-800">Pending Approvals</h2>
                <p className="text-xs text-gray-500 mt-0.5">{pendingLeaves.length > 0 ? `${pendingLeaves.length} request${pendingLeaves.length !== 1 ? 's' : ''} awaiting review` : 'All caught up'}</p>
              </div>
              {pendingLeaves.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />{pendingLeaves.length} pending
                </span>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-400" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <DataTableHead columns={['Employee', 'Leave Type', 'Duration', 'Days', 'Reason', 'Actions']} centered={['Days']} right={['Actions']} />
                  <tbody className="divide-y divide-slate-50">
                    {pendingLeaves.map((l, i) => {
                      const dotColor = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
                      const initials = l.employee_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'
                      return (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors animate-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                          <td className={TABLE_CELL}><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ backgroundColor: dotColor + '20', color: dotColor }}>{initials}</div><span className="font-semibold text-gray-800">{l.employee_name}</span></div></td>
                          <td className={TABLE_CELL}><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} /><span className="font-medium text-gray-800">{l.leave_type}</span></div></td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>
                            {fmt(l.start_date)}{l.start_date !== l.end_date && <span className="text-gray-500 mx-1.5">→</span>}{l.start_date !== l.end_date && fmt(l.end_date)}
                          </td>
                          <td className={clsx(TABLE_CELL, 'text-center')}><span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">{l.days}d</span></td>
                          <td className={clsx(TABLE_CELL, 'max-w-xs truncate')}>{l.reason}</td>
                          <td className={TABLE_CELL}>
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleApprove(l.id, 'approved')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"><CheckCircle size={11} /> Approve</button>
                              <button onClick={() => handleApprove(l.id, 'rejected')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-100"><XCircle size={11} /> Reject</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {pendingLeaves.length === 0 && <tr><td colSpan="6" className="py-4"><EmptyState icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-400" message="All caught up — no pending approvals." /></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── VIEW APPROVALS TAB (Admin, read-only decision history) ── */}
        {activeTab === 'viewApprovals' && isAdmin && (
          <div className="bg-white rounded-2xl overflow-hidden animate-fade-up" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="px-6 py-5 border-b border-slate-50">
              <h2 className="text-sm font-bold text-gray-800">View Approvals</h2>
              <p className="text-xs text-gray-500 mt-0.5">{processedLeaves.length > 0 ? `${processedLeaves.length} processed request${processedLeaves.length !== 1 ? 's' : ''}` : 'No processed requests yet'}</p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-400" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <DataTableHead
                    columns={['Employee', 'Employee ID', 'Leave Type', 'Duration', 'Days', 'Reason', 'Applied On', 'Manager', 'Decision Date', 'Status', 'Action']}
                    centered={['Days', 'Status']}
                    right={['Action']}
                  />
                  <tbody className="divide-y divide-slate-50">
                    {processedLeaves.map((l, i) => {
                      const dotColor = leaveTypeColorMap[l.leave_type?.toLowerCase().trim()] || '#94a3b8'
                      return (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors animate-fade-up" style={{ animationDelay: `${i * 25}ms` }}>
                          <td className={clsx(TABLE_CELL, 'font-semibold text-gray-800 whitespace-nowrap')}>{l.employee_name}</td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap')}>{l.employee_code || '—'}</td>
                          <td className={TABLE_CELL}><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} /><span className="font-medium text-gray-800">{l.leave_type}</span></div></td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>
                            {fmt(l.start_date)}{l.start_date !== l.end_date && <span className="text-gray-500 mx-1.5">→</span>}{l.start_date !== l.end_date && fmt(l.end_date)}
                          </td>
                          <td className={clsx(TABLE_CELL, 'text-center')}><span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">{l.days}d</span></td>
                          <td className={clsx(TABLE_CELL, 'max-w-xs truncate')}>{l.reason}</td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>{fmt(l.created_at)}</td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap')}>{l.approver || '—'}</td>
                          <td className={clsx(TABLE_CELL_MUTED, 'whitespace-nowrap tabular-nums')}>{l.approved_at ? fmt(l.approved_at) : '—'}</td>
                          <td className={clsx(TABLE_CELL, 'text-center')}><span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize', STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-400')}>{l.status}</span></td>
                          <td className={clsx(TABLE_CELL, 'text-right')}>
                            <button
                              onClick={() => { setEditingLeave(l); setOverrideStatus(l.status) }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Override decision"
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {processedLeaves.length === 0 && <tr><td colSpan="11" className="py-4"><EmptyState icon={FileText} iconBg="bg-gray-50" iconColor="text-gray-300" message="No approved or rejected leave requests yet." /></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Container>

      {/* ── VIEW DETAILS MODAL (Past Leaves table → "…" → View details) ── */}
      {viewingLeave && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingLeave(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-bold text-gray-900">Leave Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">{viewingLeave.leave_type} · {fmtPast(viewingLeave.start_date, viewingLeave.start_date !== viewingLeave.end_date)}</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs block">Duration</span>
                <span className="font-medium text-gray-800">
                  {fmt(viewingLeave.start_date)}{viewingLeave.start_date !== viewingLeave.end_date && ` → ${fmt(viewingLeave.end_date)}`}
                </span>
              </div>
              <div><span className="text-gray-500 text-xs block">Days</span><span className="font-medium text-gray-800">{viewingLeave.days}d</span></div>
              <div><span className="text-gray-500 text-xs block">Applied On</span><span className="font-medium text-gray-800">{viewingLeave.created_at ? fmt(viewingLeave.created_at) : '—'}</span></div>
              <div><span className="text-gray-500 text-xs block">Decision Date</span><span className="font-medium text-gray-800">{viewingLeave.approved_at ? fmt(viewingLeave.approved_at) : '—'}</span></div>
              <div><span className="text-gray-500 text-xs block">Manager</span><span className="font-medium text-gray-800">{viewingLeave.approver || '—'}</span></div>
              <div>
                <span className="text-gray-500 text-xs block">Status</span>
                <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-0.5', STATUS_COLORS[viewingLeave.status] || 'bg-gray-100 text-gray-400')}>
                  {viewingLeave.status}
                </span>
              </div>
              <div className="col-span-2"><span className="text-gray-500 text-xs block">Reason</span><span className="font-medium text-gray-800">{viewingLeave.reason || '—'}</span></div>
              {viewingLeave.status === 'rejected' && viewingLeave.rejection_reason && (
                <div className="col-span-2">
                  <span className="text-gray-500 text-xs block">Rejection Reason</span>
                  <span className="font-medium text-red-600">{viewingLeave.rejection_reason}</span>
                </div>
              )}
              {viewingLeave.attachment_url && (
                <div className="col-span-2">
                  <span className="text-gray-500 text-xs block">Attachment</span>
                  <a href={viewingLeave.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:underline text-xs">View attachment</a>
                </div>
              )}
            </div>
            <div className="p-6 pt-0 flex justify-end">
              <button
                onClick={() => setViewingLeave(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN OVERRIDE MODAL (View Approvals → Action → Pencil) ── */}
      {editingLeave && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !savingOverride && setEditingLeave(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-bold text-gray-900">Override Leave Decision</h2>
              <p className="text-xs text-gray-500 mt-0.5">Correct a manager's approve/reject decision.</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500 text-xs block">Employee Name</span><span className="font-medium text-gray-800">{editingLeave.employee_name}</span></div>
              <div><span className="text-gray-500 text-xs block">Employee ID</span><span className="font-medium text-gray-800">{editingLeave.employee_code || '—'}</span></div>
              <div><span className="text-gray-500 text-xs block">Leave Type</span><span className="font-medium text-gray-800">{editingLeave.leave_type}</span></div>
              <div>
                <span className="text-gray-500 text-xs block">Duration</span>
                <span className="font-medium text-gray-800">
                  {fmt(editingLeave.start_date)}{editingLeave.start_date !== editingLeave.end_date && ` → ${fmt(editingLeave.end_date)}`}
                </span>
              </div>
              <div><span className="text-gray-500 text-xs block">Days</span><span className="font-medium text-gray-800">{editingLeave.days}d</span></div>
              <div><span className="text-gray-500 text-xs block">Manager Name</span><span className="font-medium text-gray-800">{editingLeave.approver || '—'}</span></div>
              <div><span className="text-gray-500 text-xs block">Decision Date</span><span className="font-medium text-gray-800">{editingLeave.approved_at ? fmt(editingLeave.approved_at) : '—'}</span></div>
              <div><span className="text-gray-500 text-xs block">Approved By</span><span className="font-medium text-gray-800">{editingLeave.approver_employee_code || '—'}</span></div>
              <div className="col-span-2"><span className="text-gray-500 text-xs block">Reason</span><span className="font-medium text-gray-800">{editingLeave.reason || '—'}</span></div>
              <div>
                <span className="text-gray-500 text-xs block">Current Status</span>
                <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-0.5', STATUS_COLORS[editingLeave.status] || 'bg-gray-100 text-gray-400')}>
                  {editingLeave.status}
                </span>
              </div>
              <div className="col-span-2 pt-1">
                <label className="text-gray-500 text-xs block mb-1">New Status</label>
                <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)} className="input w-full">
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-2">
              <button onClick={() => setEditingLeave(null)} disabled={savingOverride} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={handleOverrideSave}
                disabled={savingOverride || overrideStatus === editingLeave.status}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {savingOverride ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
