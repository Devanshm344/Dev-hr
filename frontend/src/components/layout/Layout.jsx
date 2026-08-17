import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { isAdmin as isAdminRole, getUserRole, Role } from '../../rbac/constants'
import { logoutApi, getMe } from '../../services/api'
import { formatTimeInTz, formatDateInTz } from '../../utils/timezone'
import {
  LayoutDashboard, Users, Clock, Calendar, DollarSign,
  TrendingUp, FileText, Bell, LogOut,
  Menu, X, UsersRound, LayoutGrid, Package, ShieldCheck, BookOpen,
  ChevronDown, Timer,
  Plane, Receipt, UserMinus, Shield, Laptop, MoreHorizontal,
} from 'lucide-react'
import clsx from 'clsx'
import TechLogo from '../../assets/techdemocracy-logo.svg'
import GlobalEmployeeSearch from '../GlobalEmployeeSearch'
import { NotificationBell } from '../../engagement/components/NotificationBell'

// Fixed sidebar order for every dashboard: Dashboard, Attendance, Leave,
// Associate Engagement, Shift, Hierarchy, Documents, Performance,
// Announcements (admin only), then More.
// The two Hierarchy entries below render the same underlying component
// (components/OrgChart/OrgChart.jsx) — admin's is interactive, everyone
// else's is read-only — so exactly one of the two is visible per role, both
// sharing the "Hierarchy" label (routes/component names still say org-chart).
const navItems = [
  { to: '/',             label: 'Dashboard',           icon: LayoutDashboard },
  { to: '/attendance',   label: 'Attendance',          icon: Clock },
  { to: '/leave',        label: 'Leave',                icon: Calendar },
  // Also reachable via the "Associate Engagement" card on HR Operation for
  // Admin/Super Admin (same to="/engagement" destination — see HRModulePage.jsx).
  { to: '/engagement',   label: 'Associate Engagement',  icon: Timer },
  { to: '/shift-roster', label: 'Shift',                 icon: Clock },
  { to: '/departments',  label: 'Hierarchy',             icon: UsersRound, adminOnly: true },
  { to: '/team',         label: 'Hierarchy',             icon: UsersRound, adminHidden: true },
  { to: '/documents',    label: 'Documents',            icon: FileText },
  { to: '/performance',  label: 'Performance',          icon: TrendingUp },
  { to: '/announcements', label: 'Announcements', icon: Bell,     adminOnly: true },
  // <disabled_for_future_use> – Hidden from Admin sidebar; route and RBAC intact via adminOnly
  // { to: '/employees', label: 'Employees', icon: Users, adminOnly: true },
  { to: '/employees',   label: 'Employees',   icon: Users,        adminOnly: true, sidebarHidden: true },
  // <disabled_for_future_use> – Hidden from Admin sidebar; route and RBAC intact via adminOnly
  // { to: '/payroll', label: 'Payroll', icon: DollarSign, adminOnly: true },
  { to: '/payroll',     label: 'Payroll',     icon: DollarSign,   adminOnly: true, sidebarHidden: true },
  // <admin_access_section> – Hidden from sidebar; accessible via HR Operation → Admin Access
  { to: '/assets',      label: 'Assets',      icon: Package,      adminOnly: true, sidebarHidden: true },
  // <disabled_for_future_use> – Hidden from both sidebars; route and RBAC intact via adminOnly
  // { to: '/policy', label: 'Policy & Handbook', icon: BookOpen, adminOnly: true },
  { to: '/policy',      label: 'Policy & Handbook', icon: BookOpen, adminOnly: true, sidebarHidden: true },
  // <admin_access_section> – Hidden from sidebar; accessible via HR Operation → Admin Access
  { to: '/user-management', label: 'User Management', icon: ShieldCheck, adminOnly: true, sidebarHidden: true },
]

// Employee Self-Service "More" dropdown items
const moreItems = [
  { to: '/my-policy',         label: 'Policy',           icon: BookOpen },
  { to: '/asset-requisition', label: 'Ticket', icon: Laptop },
  { to: '/travel',            label: 'Travel',           icon: Plane },
  { to: '/reimbursement',     label: 'Reimbursement',    icon: Receipt },
  { to: '/insurance',         label: 'Insurance',        icon: Shield },
  { to: '/offboarding',       label: 'Separation Document', icon: UserMinus },
]

const ROLE_BADGE = {
  'Super Admin': { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200' },
  Admin:         { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' },
  Manager:       { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  Employee:      { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen]       = useState(false)
  const [now, setNow]                 = useState(new Date())
  const { user, logout, updateUser }  = useAuthStore()
  const navigate                      = useNavigate()
  const location                      = useLocation()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sessions persist in localStorage from whenever the user last logged in —
  // a session started before a field like `timezone` existed on the backend
  // would otherwise carry a stale user object forever, with no re-login to
  // trigger a refresh. Sync once per app load so new fields land without
  // forcing everyone to sign out and back in.
  useEffect(() => {
    getMe().then(res => updateUser(res.data)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAdmin      = isAdminRole(user)
  const handleLogout = () => {
    // Best-effort: token is discarded either way, but this is what lets a
    // "logout" event land in the activity trail instead of just vanishing.
    logoutApi().catch(() => {})
    logout()
    navigate('/')
  }
  const visibleItems = navItems.filter(i => !i.sidebarHidden && (!i.adminOnly || isAdmin) && !(i.adminHidden && isAdmin))
  const firstName    = user?.name?.split(' ')[0] || 'there'
  const rbacRole     = getUserRole(user)
  const displayRole  = rbacRole === Role.SuperAdmin ? 'Super Admin'
                      : rbacRole === Role.Admin      ? 'Admin'
                      : user?.is_manager             ? 'Manager'
                      : 'Employee'
  const roleBadge    = ROLE_BADGE[displayRole]

  // Auto-expand "More" if current route is one of the More items
  const moreRoutes = moreItems.map(i => i.to)
  const isMoreActive = moreRoutes.some(r => location.pathname === r || location.pathname.startsWith(r + '/'))

  useEffect(() => {
    if (isMoreActive) setMoreOpen(true)
  }, [isMoreActive])

  // Auto-close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  // The viewing employee's own office time — not the device's system clock,
  // which is whatever timezone the machine/browser happens to be in.
  const timeStr = formatTimeInTz(now.toISOString(), user?.timezone, { seconds: true })
  const dateStr = formatDateInTz(now, user?.timezone, { monthStyle: 'short', weekdayStyle: 'short' })

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── Mobile/tablet backdrop (behind the drawer, closes it on tap) ── */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* ── Sidebar ──
           Phone/tablet (<lg): fixed off-canvas drawer, full width, toggled by mobileDrawerOpen.
           Laptop/desktop (>=lg): back in normal flex flow, width toggled by sidebarOpen (collapse-to-icons). */}
      <aside className={clsx(
        'sidebar-transition flex flex-col shrink-0 bg-white border-r border-gray-100 shadow-[2px_0_12px_rgba(0,0,0,0.04)]',
        'fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200',
        mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:static lg:inset-auto lg:z-auto lg:translate-x-0',
        sidebarOpen ? 'lg:w-64' : 'lg:w-16'
      )}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-[18px] border-b border-gray-100">
          {sidebarOpen ? (
            <div className="animate-fade-in-x flex-1 min-w-0">
              <img src={TechLogo} alt="Techdemocracy" className="h-6 w-auto" />
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {/* Mobile/tablet: close drawer */}
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shrink-0"
          >
            <X size={14} />
          </button>
          {/* Laptop/desktop: collapse to icon rail */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shrink-0"
          >
            {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto px-2.5 space-y-0.5">
          {visibleItems.map(({ to, label, employeeLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) => clsx(
                'relative flex items-center gap-3 px-3 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-widget-label lg:text-base font-medium group',
                isActive
                  ? 'text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              )}
              style={({ isActive }) => isActive
                ? {
                    background: 'linear-gradient(135deg, #0052CC 0%, #00B4FF 100%)',
                    boxShadow: '0 4px 14px rgba(0,82,204,0.35)',
                  }
                : {}}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx(
                      'shrink-0 w-[18px] h-[18px] sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px] transition-all duration-200',
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-primary-500 group-hover:scale-110'
                    )}
                  />
                  {sidebarOpen && (
                    <span className="truncate">{(!isAdmin && employeeLabel) ? employeeLabel : label}</span>
                  )}
                  {sidebarOpen && isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* ── More Dropdown (Employee Self-Service) ── */}
          <div>
            <button
              onClick={() => setMoreOpen(v => !v)}
              title={!sidebarOpen ? 'More' : undefined}
              className={clsx(
                'relative flex items-center gap-3 px-3 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-widget-label lg:text-base font-medium w-full group',
                isMoreActive
                  ? 'text-primary-700 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              )}
            >
              <MoreHorizontal
                className={clsx(
                  'shrink-0 w-[18px] h-[18px] sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px] transition-all duration-200',
                  isMoreActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-primary-500 group-hover:scale-110'
                )}
              />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">More</span>
                  <ChevronDown
                    className={clsx(
                      'shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 text-gray-400',
                      moreOpen && 'rotate-180'
                    )}
                  />
                </>
              )}
            </button>

            {/* More sub-items */}
            {moreOpen && (
              <div className={clsx('mt-0.5 space-y-0.5', sidebarOpen ? 'pl-3' : '')}>
                {moreItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) => clsx(
                      'relative flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-xl transition-all duration-200 text-body sm:text-sm lg:text-widget-label font-medium group',
                      isActive
                        ? 'text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    )}
                    style={({ isActive }) => isActive
                      ? {
                          background: 'linear-gradient(135deg, #0052CC 0%, #00B4FF 100%)',
                          boxShadow: '0 4px 14px rgba(0,82,204,0.35)',
                        }
                      : {}}
                    title={!sidebarOpen ? label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={clsx(
                            'shrink-0 w-4 h-4 sm:w-[18px] sm:h-[18px] lg:w-5 lg:h-5 transition-all duration-200',
                            isActive ? 'text-white' : 'text-gray-400 group-hover:text-primary-500 group-hover:scale-110'
                          )}
                        />
                        {sidebarOpen && <span className="truncate">{label}</span>}
                        {sidebarOpen && isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* User section */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          {sidebarOpen && isAdmin && (
            <NavLink
              to="/modules"
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-body font-semibold w-full mb-1',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              )}
            >
              <LayoutGrid size={15} className="shrink-0 text-gray-400" />
              <span>HR Operation</span>
            </NavLink>
          )}
          <NavLink
            to="/profile"
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-body font-medium w-full',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            )}
          >
            <div
              className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-dense font-bold text-white shadow"
              style={{ background: 'linear-gradient(135deg, #0052CC, #00B4FF)' }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-gray-800 text-xs font-semibold truncate leading-snug">{user?.name}</div>
                <div className="text-gray-400 text-dense-tight truncate capitalize">{displayRole}</div>
              </div>
            )}
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-xl w-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-150 text-body font-medium"
          >
            <LogOut size={15} className="shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="shrink-0 px-4 md:px-6 py-3 flex items-center justify-between gap-3 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile/tablet: open drawer */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-widget-label font-bold text-gray-900 leading-tight truncate">
                Welcome Back,{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #0052CC, #00B4FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {firstName}!
                </span>
              </h1>
              <p className="hidden sm:block text-dense text-gray-400 mt-0.5 truncate">{user?.title || 'Employee'}</p>
            </div>
          </div>

          <GlobalEmployeeSearch />

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

            {/* Notification bell — real data from the Associate Engagement
                module (dev-hr itself has no notifications system of its own). */}
            <NotificationBell />

            {/* Live clock — date/day on top, ticking time below, one tidy block */}
            <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="live-dot bg-emerald-500 shrink-0" style={{ width: 7, height: 7 }} />
              <div className="leading-tight space-y-0.5">
                <div className="text-dense-tight font-bold text-slate-600 tabular-nums whitespace-nowrap">{dateStr}</div>
                <div className="text-body font-mono font-semibold text-slate-700 tabular-nums clock-digit whitespace-nowrap">{timeStr}</div>
              </div>
            </div>

            {/* Employee ID */}
            <span className="hidden sm:inline-block text-dense bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg font-bold border border-primary-100">
              {user?.employee_id}
            </span>

            {/* Role badge */}
            <span className={clsx(
              'text-dense px-2.5 sm:px-3 py-1.5 rounded-lg font-bold border capitalize shrink-0',
              roleBadge.bg, roleBadge.text, roleBadge.border
            )}>
              {displayRole}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
