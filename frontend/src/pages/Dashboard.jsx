import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getEmployeeStats, getTodayStatus, checkIn, checkOut,
  getAnnouncements, getMyLeaveBalance
} from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin } from '../rbac/constants'
import AskAI from '../components/AskAI'
import Container from '../components/ui/Container'
import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import DepartmentDistributionCard from '../components/dashboard/DepartmentDistributionCard'
import KpiCard from '../components/dashboard/KpiCard'
import {
  Users, Clock, Calendar, TrendingUp, CheckCircle,
  Loader2, RefreshCw, Megaphone, AlertCircle, Info,
  DollarSign, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { formatTimeInTz, formatDateInTz } from '../utils/timezone'
import { fmtDays } from '../utils/leave'
import employeesKpiIcon from '../assets/dashboard-employees-icon.png'
import presentTodayKpiIcon from '../assets/dashboard-present-today-icon.png'
import onLeaveKpiIcon from '../assets/dashboard-on-leave-icon.png'
import newJoinersKpiIcon from '../assets/dashboard-new-joiners-icon.png'
import applyLeaveQuickActionIcon from '../assets/quick-action-apply-leave-icon.png'
import myPayslipQuickActionIcon from '../assets/quick-action-my-payslip-icon.png'
import attendanceQuickActionIcon from '../assets/quick-action-attendance-icon.png'
import viewTeamQuickActionIcon from '../assets/quick-action-view-team-icon.png'

/* ── Attendance clock (widget) ── */
function AttendanceClock({ tz }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  // This employee's own office time, not the device's system clock.
  const hm = formatTimeInTz(now.toISOString(), tz)
  const ss = now.getSeconds().toString().padStart(2, '0')
  return (
    <div className="text-center">
      <div className="text-3xl font-black text-gray-800 tabular-nums leading-none">
        {hm}<span className="text-base text-gray-400 ml-1">:{ss}</span>
      </div>
      <p className="text-dense text-gray-400 mt-1">
        {formatDateInTz(now, tz, { withYear: false, monthStyle: 'short' })}
      </p>
    </div>
  )
}



/* ── Circular progress ring ── */
const CircleRing = ({ worked = 0, total = 8 }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t) }, [])
  const pct    = Math.min((worked / total) * 100, 100)
  const r      = 42
  const circ   = 2 * Math.PI * r
  const offset = circ - (mounted ? pct / 100 : 0) * circ
  return (
    <div className="relative w-28 h-28 mx-auto my-4">
      <svg className="w-28 h-28" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ringGrad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0052CC" />
            <stop offset="100%" stopColor="#00B4FF" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-gray-800 tabular-nums leading-none">{worked.toFixed(1)}<span className="text-xs font-semibold text-gray-400">h</span></span>
        <span className="text-dense-tight text-gray-400 mt-0.5 font-medium">of {total}h</span>
      </div>
    </div>
  )
}

/* ── Announcement styles ── */
const ANN_STYLES = {
  urgent: { icon: AlertCircle, gradient: 'linear-gradient(135deg, #ef4444, #e11d48)', card: 'border-red-100 bg-red-50/60' },
  high:   { icon: AlertCircle, gradient: 'linear-gradient(135deg, #f97316, #dc2626)', card: 'border-orange-100 bg-orange-50/60' },
  normal: { icon: Megaphone,   gradient: 'linear-gradient(135deg, #0052CC, #00B4FF)', card: 'border-primary-100 bg-primary-50/30' },
  low:    { icon: Info,        gradient: 'linear-gradient(135deg, #9ca3af, #6b7280)', card: 'border-gray-100 bg-gray-50/50' },
}

const LEAVE_GRADIENTS = [
  'from-primary-600 to-secondary-400',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-sky-500 to-blue-600',
]

/* ── Quick action shortcuts ── */
const QUICK_ACTIONS = [
  { label: 'Apply Leave',  to: '/leave',       icon: applyLeaveQuickActionIcon, from: '#0052CC', to2: '#00B4FF' },
  { label: 'My Payslip',   to: '/payroll',     icon: myPayslipQuickActionIcon, from: '#10b981', to2: '#059669' },
  { label: 'Attendance',   to: '/attendance',  icon: attendanceQuickActionIcon, from: '#0090d4', to2: '#0052CC' },
  { label: 'View Team',    to: '/team',        icon: viewTeamQuickActionIcon, from: '#f59e0b', to2: '#f97316' },
]

/* ── Admin KPI cards config ── */
const KPI_CARDS = [
  { key: 'total',           title: 'Employees',      subtitle: 'Total Employees',    icon: employeesKpiIcon, color: 'primary'   },
  { key: 'active',          title: 'Present Today',  subtitle: 'Active Today',       icon: presentTodayKpiIcon, color: 'success'   },
  { key: 'on_leave',        title: 'On Leave',       subtitle: 'Currently On Leave', icon: onLeaveKpiIcon, color: 'warning'   },
  { key: 'new_this_month',  title: 'New This Month', subtitle: 'New Joiners',        icon: newJoinersKpiIcon, color: 'secondary' },
]

export default function Dashboard() {
  const { user } = useAuthStore()
  const [stats,         setStats]         = useState(null)
  const [statsLoading,  setStatsLoading]  = useState(true)
  const [statsError,    setStatsError]    = useState(null)
  const [todayAtt,      setTodayAtt]      = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [leaveBalance,  setLeaveBalance]  = useState([])
  const [loading,       setLoading]       = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)
  const [balMounted,    setBalMounted]    = useState(false)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const iv = setInterval(async () => {
      try { setTodayAtt((await getTodayStatus()).data) } catch {}
    }, 60_000)
    return () => clearInterval(iv)
  }, [])

  const loadData = async (manual = false) => {
    if (manual) setRefreshing(true)
    setBalMounted(false)
    try {
      const [attRes, annRes, balRes] = await Promise.all([
        getTodayStatus(), getAnnouncements(), getMyLeaveBalance(),
      ])
      setTodayAtt(attRes.data)
      setAnnouncements(annRes.data)
      setLeaveBalance(balRes.data)
      setTimeout(() => setBalMounted(true), 250)
    } catch {}
    if (!isAdmin(user)) {
      setStatsLoading(false)
    } else {
      setStatsLoading(true)
      try {
        setStats((await getEmployeeStats()).data)
        setStatsError(null)
      } catch {
        setStatsError('Unable to load metrics')
      } finally {
        setStatsLoading(false)
      }
    }
    if (manual) setRefreshing(false)
  }

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      await checkIn({ location: 'Office' })
      toast.success('Checked in successfully!')
      setTodayAtt((await getTodayStatus()).data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Check-in failed')
    } finally { setLoading(false) }
  }

  const handleCheckOut = async () => {
    setLoading(true)
    try {
      const res = await checkOut()
      toast.success(`Checked out! ${res.data.work_hours}h today`)
    } catch (e) {
      toast.error(e.response?.data?.detail || `Check-out failed (${e.response?.status ?? e.message})`)
      setLoading(false)
      return
    }
    try { setTodayAtt((await getTodayStatus()).data) } catch {}
    setLoading(false)
  }

  const isCheckedIn  = Boolean(todayAtt?.check_in && !todayAtt?.check_out)
  const isCheckedOut = Boolean(todayAtt?.check_in &&  todayAtt?.check_out)
  const notCheckedIn = !todayAtt || todayAtt.status === 'not_checked_in'

  const workedHours = todayAtt?.work_hours
    ? parseFloat(todayAtt.work_hours)
    : isCheckedIn
      ? Math.round((Date.now() - new Date(todayAtt.check_in)) / 360000) / 10
      : 0

  const greeting = (() => {
    // The employee's own local hour, not the device's — otherwise a US
    // employee's morning login reads back "Good afternoon" whenever the
    // browser's system clock happens to be set to IST (true on this dev box).
    const h = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: user?.timezone || 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23',
      }).format(new Date())
    )
    return h < 5  ? 'Good Night'
         : h < 12 ? 'Good Morning'
         : h < 17 ? 'Good Afternoon'
         : h < 21 ? 'Good Evening'
         :          'Good Night'
  })()

  const fmtTime = iso => formatTimeInTz(iso, user?.timezone)

  return (
    <Container stack={false} className="flex flex-col lg:flex-row gap-5 items-start">
    <div className="flex-1 min-w-0 space-y-5">

      {/* ── Greeting card ── */}
      <div className="card p-5 sm:p-6 flex items-center justify-between flex-wrap gap-4 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting}, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-sm text-gray-400 mt-1">Here's what's happening in your organization today.</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          aria-label="Refresh dashboard data"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50 transition-all shrink-0"
        >
          <RefreshCw size={13} className={clsx(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ── KPI stats (Admin only) ── */}
      {isAdmin(user) && (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3">
          {KPI_CARDS.map((cfg, idx) => (
            <KpiCard
              key={cfg.key}
              title={cfg.title}
              subtitle={cfg.subtitle}
              icon={cfg.icon}
              color={cfg.color}
              value={stats?.[cfg.key]}
              trendDelta={stats?.trends?.[cfg.key]?.delta}
              trendLabel={stats?.trends?.[cfg.key]?.label}
              sparkline={stats?.trends?.[cfg.key]?.sparkline}
              loading={statsLoading}
              error={statsError}
              delay={idx * 60}
            />
          ))}
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '260ms' }}>
        {QUICK_ACTIONS.map(({ label, to, icon: Icon, from, to2 }) => (
          <Link
            key={to}
            to={to}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-all hover:-translate-y-0.5 group"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${from}, ${to2})` }}
            >
              {typeof Icon === 'string' ? (
                <img src={Icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon size={16} className="text-white" />
              )}
            </div>
            <span className="text-sm sm:text-widget-label lg:text-base font-semibold text-gray-700 group-hover:text-primary-600 transition-colors">{label}</span>
            <ChevronRight size={14} className="text-gray-300 ml-auto group-hover:text-primary-400 transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Attendance + Announcements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Attendance card */}
        <div className="card p-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 text-widget-label">Today's Attendance</h2>
            {isCheckedIn && (
              <span className="flex items-center gap-1.5 text-dense text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <span className="live-dot bg-emerald-500" style={{ width: 6, height: 6 }} />
                Live
              </span>
            )}
          </div>

          <AttendanceClock tz={user?.timezone} />
          <CircleRing worked={workedHours} />

          <p className="text-center text-body font-semibold text-gray-600 mb-4">
            {notCheckedIn ? 'Not checked in yet'
              : isCheckedIn ? `In since ${fmtTime(todayAtt.check_in)}`
              : `${todayAtt.work_hours}h worked today`}
          </p>

          {todayAtt?.check_in && (
            <div className="flex justify-between bg-gray-50 rounded-xl px-4 py-3 text-xs mb-4 border border-gray-100">
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Check In</p>
                <p className="font-bold text-gray-700 text-sm">{fmtTime(todayAtt.check_in)}</p>
              </div>
              {todayAtt.check_out && (
                <div className="text-right">
                  <p className="text-gray-400 font-medium mb-0.5">Check Out</p>
                  <p className="font-bold text-gray-700 text-sm">{fmtTime(todayAtt.check_out)}</p>
                </div>
              )}
            </div>
          )}

          {notCheckedIn && (
            <button
              onClick={handleCheckIn}
              disabled={loading}
              className="w-full text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #0052CC, #00B4FF)', boxShadow: '0 8px 24px -4px rgba(0,82,204,0.4)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Check In
            </button>
          )}
          {isCheckedIn && (
            <button
              onClick={handleCheckOut}
              disabled={loading}
              className="w-full text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #dc2626)', boxShadow: '0 8px 24px -4px rgba(239,68,68,0.4)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
              Check Out
            </button>
          )}
        </div>

        {/* Announcements */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 text-widget-label">Announcements</h2>
            {announcements.length > 0 && (
              <span className="text-dense font-bold text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-100">
                {announcements.length}
              </span>
            )}
          </div>
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Megaphone size={20} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No announcements</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-0.5">
              {announcements.map(a => {
                const style = ANN_STYLES[a.priority] || ANN_STYLES.low
                const AnnIcon = style.icon
                return (
                  <div
                    key={a.id}
                    className={clsx('flex gap-3 p-3 rounded-xl border transition-all hover:shadow-sm cursor-default', style.card)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: style.gradient }}
                    >
                      <AnnIcon size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-semibold text-gray-800 leading-snug">{a.title}</p>
                      <p className="text-dense text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{a.content}</p>
                      <p className="text-dense-tight text-gray-400 mt-1.5 font-medium">
                        {a.publisher} · {new Date(a.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Ask AI floating widget ── */}
      <AskAI />

      {/* ── Leave Balance + Department Distribution (Admin only) ── */}
      <div className={clsx('grid grid-cols-1 gap-5', isAdmin(user) && 'lg:grid-cols-2')}>

        {/* Leave Balance */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 text-widget-label">Leave Balance</h2>
            <Calendar size={16} className="text-gray-300" />
          </div>
          {leaveBalance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Calendar size={20} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No leave balances available.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {leaveBalance.map((b, i) => {
                const pct = b.total_days > 0 ? Math.min((b.remaining_days / b.total_days) * 100, 100) : 0
                const grad = LEAVE_GRADIENTS[i % LEAVE_GRADIENTS.length]
                return (
                  <div key={b.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-body text-gray-700 font-semibold">{b.leave_type}</span>
                      <span className="text-dense font-bold text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100 tabular-nums">
                        {fmtDays(b.remaining_days)} / {fmtDays(b.total_days)} days
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`bg-gradient-to-r ${grad} h-2 rounded-full`}
                        style={{
                          width: balMounted ? `${pct}%` : '0%',
                          transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 80}ms`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {isAdmin(user) && <DepartmentDistributionCard />}
      </div>
    </div>

    {/* ── Right sidebar ── */}
    <DashboardSidebar />
    </Container>
  )
}
