import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getModuleStats, getAlumniSsoUrl } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import { RefreshCw, Zap } from 'lucide-react'
import clsx from 'clsx'
import Container from '../components/ui/Container'
import employeeInfoIcon from '../assets/employee-info-icon.png'
import shiftRosterIcon from '../assets/shift-roster-icon.png'
import overtimeCompoffIcon from '../assets/overtime-compoff-icon.png'
import insuranceIcon from '../assets/insurance-icon.png'
import expenseManagementIcon from '../assets/expense-management-icon.png'
import alumniIcon from '../assets/alumni-icon.png'
import leaveTrackerIcon from '../assets/leave-tracker-icon.png'
import orgChartIcon from '../assets/org-chart-icon.png'
import exitManagementIcon from '../assets/exit-management-icon.png'
import atsIcon from '../assets/ats-icon.png'
import trainingDevelopmentIcon from '../assets/training-development-icon.png'
import performanceReviewsIcon from '../assets/performance-reviews-icon.png'
import payrollProcessingIcon from '../assets/payroll-processing-icon.png'
import taxStatutoryIcon from '../assets/tax-statutory-icon.png'
import policyHandbookIcon from '../assets/policy-handbook-icon.png'
import workforceAnalyticsIcon from '../assets/workforce-analytics-icon.png'
import timeSheetIcon from '../assets/time-sheet-icon.png'
import announcementsHubIcon from '../assets/announcements-hub-icon.png'
import userManagementIcon from '../assets/user-management-icon.png'
import assetManagementIcon from '../assets/asset-management-icon.png'
import orgChartEditorIcon from '../assets/org-chart-editor-icon.png'

/* ─── animated count-up ─── */
function useCountUp(target, duration = 800) {
  const [count, setCount] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target == null || target === 0) { setCount(0); prev.current = 0; return }
    const start = prev.current
    const diff = target - start
    if (diff === 0) return
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(start + diff * e))
      if (p < 1) requestAnimationFrame(tick)
      else prev.current = target
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

/* ─── live "X seconds ago" ─── */
function useElapsed(ts) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    if (!ts) return
    const base = Date.now()
    const iv = setInterval(() => setSec(Math.floor((Date.now() - base) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [ts])
  if (sec < 60) return `${sec}s ago`
  return `${Math.floor(sec / 60)}m ago`
}

/* ─── badge colours ─── */
const badgeStyle = {
  Core:       'bg-primary-100 text-primary-700 border border-primary-200',
  Live:       'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Beta:       'bg-amber-100 text-amber-700 border border-amber-200',
  Soon:       'bg-gray-100 text-gray-500 border border-gray-200',
  Talent:     'bg-pink-100 text-pink-700 border border-pink-200',
  Analytics:  'bg-sky-100 text-sky-700 border border-sky-200',
  Compliance: 'bg-orange-100 text-orange-700 border border-orange-200',
  Admin:      'bg-red-100 text-red-700 border border-red-200',
}

/* ─── single module card ─── */
function ModuleCard({ emoji, icon, title, description, badge, stat, statLabel, live, comingSoon, to, externalHref, delay = 0 }) {
  const navigate = useNavigate()
  const displayed = useCountUp(typeof stat === 'number' ? stat : null)
  const [ssoLoading, setSsoLoading] = useState(false)

  const handleClick = async () => {
    if (comingSoon || ssoLoading) return
    if (typeof externalHref === 'function') {
      setSsoLoading(true)
      try {
        const url = await externalHref()
        window.location.href = url
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Could not open the Alumni Network.')
        setSsoLoading(false)
      }
      return
    }
    if (externalHref) { window.location.href = externalHref; return }
    if (to) navigate(to)
  }

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'relative rounded-2xl p-5 border transition-all duration-300 group animate-fade-up select-none',
        ssoLoading && 'opacity-70 pointer-events-none',
        comingSoon
          ? 'opacity-50 cursor-default bg-gray-50 border-gray-100'
          : 'bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-lg hover:border-primary-100 hover:-translate-y-1',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* live pulse ring */}
      {live && !comingSoon && (
        <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
      )}

      {/* icon */}
      <div className="text-2xl mb-3 w-12 h-12 flex items-center justify-center rounded-xl bg-primary-50 border border-primary-100/80 overflow-hidden">
        {icon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : emoji}
      </div>

      {/* badge */}
      <span className={clsx('text-dense-tight font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', badgeStyle[badge] || badgeStyle.Core)}>
        {badge}
      </span>

      {/* title + description */}
      <h3 className={clsx('font-bold mt-2 text-sm leading-tight', comingSoon ? 'text-gray-400' : 'text-black group-hover:text-primary-600 transition-colors')}>
        {title}
      </h3>
      <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">{description}</p>

      {/* live stat */}
      {!comingSoon && stat != null && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-1">
          <span className="text-lg font-bold text-gray-900 tabular-nums">{typeof stat === 'number' ? displayed : stat}</span>
          <span className="text-xs text-gray-400 mb-0.5">{statLabel}</span>
        </div>
      )}

      {comingSoon && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 font-medium">Coming soon</span>
        </div>
      )}
    </div>
  )
}

/* ─── category section ─── */
function Category({ label, accent, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className={clsx('w-1 h-4 rounded-full', accent)} />
        <h2 className="text-xs font-bold tracking-widest uppercase text-gray-900">{label}</h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {children}
      </div>
    </section>
  )
}

/* ─── main page ─── */
export default function ModulesPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastTs, setLastTs] = useState(null)
  const elapsed = useElapsed(lastTs)

  const isAdmin = isAdminRole(user)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await getModuleStats()
      setStats(res.data)
      setLastTs(Date.now())
    } catch {}
    setLoading(false)
    if (manual) setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* auto-refresh every 30 s */
  useEffect(() => {
    const iv = setInterval(() => load(), 30_000)
    return () => clearInterval(iv)
  }, [load])

  const s = stats

  return (
    <Container>
      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Operation</h1>
          <p className="text-sm text-gray-500">All modules · live data refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-3">
          {lastTs && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Updated {elapsed}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} className={clsx(refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── live mini-bar ── */}
      {s && (
        <div className="flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
          {[
            { label: 'Employees', value: s.employees.active, color: 'text-blue-600', dot: 'bg-blue-500' },
            { label: 'Present Today', value: s.attendance.present_today, color: 'text-green-600', dot: 'bg-green-500', live: true },
            { label: 'Checked-in Now', value: s.attendance.checked_in_now, color: 'text-emerald-600', dot: 'bg-emerald-500', live: true },
            { label: 'Pending Leaves', value: s.leave.pending, color: 'text-yellow-600', dot: 'bg-yellow-500' },
            { label: 'Payslips This Month', value: s.payroll.generated_this_month, color: 'text-secondary-600', dot: 'bg-secondary-400' },
          ].map(({ label, value, color, dot, live }) => (
            <div key={label} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
              <span className={clsx('w-2 h-2 rounded-full shrink-0', dot, live && 'animate-pulse')} />
              <span className={clsx('text-lg font-bold tabular-nums', color)}>{value ?? '–'}</span>
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── modules canvas ── */}
      <div className="bg-gradient-to-br from-primary-50/60 via-white to-secondary-50/40 rounded-3xl p-6 space-y-8 border border-primary-100/60 shadow-sm">

        {/* CORE HR OPERATIONS */}
        <Category label="Core HR Operations" accent="bg-primary-600">
          <ModuleCard icon={employeeInfoIcon} title="Employee Info" description="Checklists, document collection, IT provisioning"
            badge="Core" live stat={s?.employees.total} statLabel="total employees" to="/employees" delay={0} />
          <ModuleCard icon={shiftRosterIcon} title="Shift & Roster" description="Shift scheduling, swap requests, night shift differentials"
            badge="Core" live stat={s?.attendance.present_today} statLabel="present today" to="/shift-roster" delay={40} />
          <ModuleCard icon={overtimeCompoffIcon} title="Overtime & Comp-Off" description="OT approvals, comp-off balance, holiday work tracking"
            badge="Core" stat={s?.attendance.avg_hours_week} statLabel="avg hrs/day this week" to="/attendance" delay={80} />
          <ModuleCard icon={insuranceIcon} title="Insurance" description="Health insurance, provident fund, gratuity, flexible benefits"
            badge="Core" stat={s?.employees.active} statLabel="employees enrolled" to="/payroll" delay={120} />
          <ModuleCard icon={expenseManagementIcon} title="Expense Management" description="Reimbursement requests, policy limits, category-wise approval"
            badge="Core" comingSoon delay={160} />
          {isAdmin && (
            <ModuleCard icon={alumniIcon} title="Alumni" description="Ex-employee records, rehire eligibility, alumni network, exit management"
              badge="Core" live externalHref={async () => (await getAlumniSsoUrl()).data.ssoUrl} delay={200} />
          )}
          <ModuleCard icon={leaveTrackerIcon} title="Leave Tracker" description="Manage leave balances, leave requests, approvals, holidays, and more"
            badge="Core" live stat={s?.leave.pending} statLabel="pending requests" to="/hr-operations/leave-tracker" delay={240} />
          <ModuleCard icon={orgChartIcon} title="Org Chart" description="View organizational hierarchy and reporting structure"
            badge="Core" to="/org-chart" delay={280} />
          <ModuleCard icon={leaveTrackerIcon} title="Leave Management Console" description="Allows HR to review, edit, override, or update employee leave records"
            badge="Core" delay={320} />
          <ModuleCard icon={exitManagementIcon} title="Exit Management" description="Employee applies for resignation or offboarding → Reporting Manager reviews the request → HR receives the request → HR can approve, revoke, or manage the exit process"
            badge="Core" delay={360} />
        </Category>

        {/* TALENT & GROWTH */}
        <Category label="Talent & Growth" accent="bg-pink-500">
          <ModuleCard icon={atsIcon} title="Recruitment & ATS" description="Job postings, candidate pipeline, interview scheduling, offer letters"
            badge="Soon" comingSoon delay={0} />
          <ModuleCard icon={trainingDevelopmentIcon} title="Training & Development" description="LMS integration, skill mapping, course assignments, certifications"
            badge="Talent" stat={s?.documents.total} statLabel="learning resources" to="/documents" delay={40} />
          <ModuleCard icon={performanceReviewsIcon} title="Performance Reviews" description="KPI tracking, 360° feedback, quarterly and annual review cycles"
            badge="Talent" live stat={s?.performance.total_reviews} statLabel="reviews completed" to="/performance" delay={80} />

        </Category>

        {/* PAYROLL & COMPLIANCE */}
        <Category label="Payroll & Compliance" accent="bg-orange-500">
          <ModuleCard icon={payrollProcessingIcon} title="Payroll Processing" description="CTC breakdown, gross/net salary, bulk payslip generation"
            badge="Core" live stat={s?.payroll.generated_this_month} statLabel="payslips this month" to="/payroll" delay={0} />
          <ModuleCard icon={taxStatutoryIcon} title="Tax & Statutory" description="TDS, PF, professional tax, Form 16, statutory filings"
            badge="Compliance" stat={s?.payroll.paid_this_month} statLabel="paid this month" to="/payroll" delay={40} />
          <ModuleCard icon={policyHandbookIcon} title="Policy & Handbook" description="Company policies, HR manual, SOP documentation repository"
            badge="Compliance" stat={s?.documents.total} statLabel="documents" to="/policy" delay={80} />

        </Category>

        {/* ANALYTICS & INSIGHTS */}
        <Category label="Analytics & Insights" accent="bg-cyan-500">
          <ModuleCard icon={workforceAnalyticsIcon} title="Workforce Analytics" description="Headcount trends, attrition rate, department-wise distribution"
            badge="Analytics" live stat={s?.employees.total} statLabel="total headcount" to="/employees" delay={0} />
          <ModuleCard icon={timeSheetIcon} title="Associate Engagement" description="Timesheets, project portfolio, approvals, allocations, and expense tracking"
            badge="Analytics" live stat={s?.attendance.records_this_month} statLabel="records this month" to="/engagement" delay={40} />
          <ModuleCard icon={announcementsHubIcon} title="Announcements Hub" description="Company-wide notices, priority broadcasts, expiry management"
            badge="Core" live stat={s?.announcements.active} statLabel="active notices" to="/announcements" delay={160} />
        </Category>

        {/* ADMIN ACCESS – visible only to Admin role; cards derived from adminOnly nav items */}
        {isAdmin && (
          <Category label="Admin Access" accent="bg-red-500">
            <ModuleCard icon={userManagementIcon} title="User Management"
              description="Manage user accounts, assign roles, and control admin and employee system access"
              badge="Admin" to="/user-management" delay={0} />
            <ModuleCard icon={assetManagementIcon} title="Asset Management"
              description="Assign laptops, ID cards, vehicles; track returns on exit"
              badge="Admin" live to="/assets" delay={40} />
            <ModuleCard icon={orgChartEditorIcon} title="Org Chart Editor"
              description="Create, edit and manage the organization hierarchy, reporting structure and department relationships"
              badge="Admin" live to="/org-chart-editor" delay={80} />
            <ModuleCard icon={leaveTrackerIcon} title="Holiday Editor"
              description="Upload each office's holiday PDF (India, US, Canada) — parsed automatically and applied per region"
              badge="Admin" live to="/holiday-editor" delay={120} />
          </Category>
        )}
      </div>

      {/* ── footer legend ── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pb-2 animate-fade-up">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live data</div>
        {Object.entries(badgeStyle).map(([k, v]) => (
          <span key={k} className={clsx('px-2 py-0.5 rounded-full text-dense-tight font-semibold uppercase tracking-wide', v)}>{k}</span>
        ))}
      </div>
    </Container>
  )
}
