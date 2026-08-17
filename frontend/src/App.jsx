import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <p className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</p>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { isAdmin } from './rbac/constants'
import Layout from './components/layout/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Dashboard from './pages/Dashboard'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeDetail from './pages/EmployeeDetail'
import AttendancePage from './pages/AttendancePage'
import LeavePage from './pages/LeavePage'
import ApplyLeavePage from './pages/ApplyLeavePage'
import PayrollPage from './pages/PayrollPage'
import PerformancePage from './pages/PerformancePage'
import DocumentsPage from './pages/DocumentsPage'
import DepartmentsPage from './pages/DepartmentsPage'
import DepartmentMembersPage from './pages/DepartmentMembersPage'
import ProfilePage from './pages/ProfilePage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import HRModulePage from './pages/HRModulePage'
import AssetsPage from './pages/AssetsPage'
import UserManagementPage from './pages/UserManagementPage'
import ShiftRosterPage from './pages/ShiftRosterPage'
import PolicyPage from './pages/PolicyPage'
import TravelPage from './pages/TravelPage'
import ReimbursementPage from './pages/ReimbursementPage'
import OffBoardingPage from './pages/OffBoardingPage'
import InsurancePage from './pages/InsurancePage'
import EmployeePolicyPage from './pages/EmployeePolicyPage'
import AssetRequisitionPage from './pages/AssetRequisitionPage'
import LeaveTrackerPage from './pages/LeaveTrackerPage'
import HolidayEditorPage from './pages/HolidayEditorPage'
import OrgChartPage from './pages/OrgChartPage'
import OrgChartEditorPage from './pages/OrgChartEditorPage'
import { EngagementGate } from './engagement/api/context'
import EngagementHome from './engagement/pages/Home'
import EngagementPortfolio from './engagement/pages/Portfolio'
import EngagementProjectDetail from './engagement/pages/ProjectDetail'
import EngagementTimeEntries from './engagement/pages/TimeEntries'
import EngagementTimesheets from './engagement/pages/Timesheets'
import EngagementAuditing from './engagement/pages/Auditing'
import EngagementExpenses from './engagement/pages/Expenses'
import EngagementApprovals from './engagement/pages/Approvals'
import EngagementApprovalDetail from './engagement/pages/ApprovalDetail'
import EngagementAllocations from './engagement/pages/Allocations'
import EngagementReports from './engagement/pages/Reports'
import EngagementNotFound from './engagement/pages/NotFound'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/landing" replace />
}

function AdminRoute({ children }) {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/landing" replace />
  if (!isAdmin(user)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<AdminRoute><EmployeesPage /></AdminRoute>} />
          <Route path="employees/:id" element={<AdminRoute><EmployeeDetail /></AdminRoute>} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="leave/apply" element={<ApplyLeavePage />} />
          <Route path="payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="departments" element={<AdminRoute><DepartmentsPage /></AdminRoute>} />
          <Route path="team" element={<DepartmentMembersPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="modules" element={<AdminRoute><HRModulePage /></AdminRoute>} />
          <Route path="user-management" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
          <Route path="shift-roster" element={<ShiftRosterPage />} />
          <Route path="policy" element={<PolicyPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Employee Self-Service modules */}
          <Route path="travel" element={<TravelPage />} />
          <Route path="reimbursement" element={<ReimbursementPage />} />
          <Route path="offboarding" element={<OffBoardingPage />} />
          <Route path="insurance" element={<InsurancePage />} />
          <Route path="my-policy" element={<EmployeePolicyPage />} />
          <Route path="asset-requisition" element={<AssetRequisitionPage />} />
          <Route path="hr-operations/leave-tracker" element={<AdminRoute><LeaveTrackerPage /></AdminRoute>} />
          <Route path="holiday-editor" element={<AdminRoute><HolidayEditorPage /></AdminRoute>} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="org-chart-editor" element={<AdminRoute><OrgChartEditorPage /></AdminRoute>} />
          {/* Associate Engagement (Timesheet + PSA) — open to every role; the
              engagement backend enforces its own employee/manager/admin
              checks, same as every other authorization decision here is
              meant to be backend-enforced, not gated by AdminRoute. */}
          <Route path="engagement" element={<EngagementGate />}>
            <Route index element={<EngagementHome />} />
            <Route path="portfolio" element={<EngagementPortfolio />} />
            <Route path="portfolio/projects/:id" element={<EngagementProjectDetail />} />
            <Route path="time/entries" element={<EngagementTimeEntries />} />
            <Route path="time/timesheets" element={<EngagementTimesheets />} />
            <Route path="time/auditing" element={<EngagementAuditing />} />
            <Route path="expenses" element={<EngagementExpenses />} />
            <Route path="approvals" element={<EngagementApprovals />} />
            <Route path="approvals/:timesheetId" element={<EngagementApprovalDetail />} />
            <Route path="allocations" element={<EngagementAllocations />} />
            <Route path="reports" element={<EngagementReports />} />
            <Route path="*" element={<EngagementNotFound />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/landing" />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
