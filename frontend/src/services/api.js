import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const auth = JSON.parse(localStorage.getItem('hrms-auth') || '{}')
  const token = auth?.state?.token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hrms-auth')
      window.location.href = '/'
    }
    // Pydantic v2 returns detail as an array of {type,loc,msg,input,ctx} objects on 422.
    // Flatten it to a string here so every caller gets a renderable value.
    if (Array.isArray(err.response?.data?.detail)) {
      err.response.data.detail = err.response.data.detail
        .map(d => d.msg || JSON.stringify(d))
        .join('; ')
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (data) => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')
export const logoutApi = () => api.post('/auth/logout')
export const changePassword = (data) => api.post('/auth/change-password', data)
export const forgotPassword = (data) => api.post('/auth/forgot-password', data)
export const resetPassword = (data) => api.post('/auth/reset-password', data)

// MFA (TOTP second factor)
export const verifyMfaLogin = (challenge_token, code) => api.post('/auth/login/verify-mfa', { challenge_token, code })
export const enrollMfa       = ()                     => api.post('/auth/mfa/enroll')
export const verifyMfaEnroll = (code)                 => api.post('/auth/mfa/verify-enroll', { code })
export const disableMfa      = (current_password)     => api.post('/auth/mfa/disable', { current_password })
export const adminDisableMfa = (id)                   => api.put(`/user-management/users/${id}/mfa`)

// Employees
export const getEmployees = (params) => api.get('/employees/', { params })
export const getEmployee = (id) => api.get(`/employees/${id}`)
export const createEmployee = (data) => api.post('/employees/', data)
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data)
export const deleteEmployee = (id) => api.delete(`/employees/${id}`)
export const getEmployeeStats = () => api.get('/employees/stats')
export const getManagersList = () => api.get('/employees/managers')
export const getOrgChart = () => api.get('/orgchart/')
export const searchOrgChart = (q) => api.get('/orgchart/search', { params: { q } })
export const getOrgChain = (id) => api.get(`/orgchart/chain/${id}`)
export const uploadEmployeePhoto = (id, formData) => api.post(`/employees/${id}/photo`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const removeEmployeePhoto = (id) => api.delete(`/employees/${id}/photo`)

// Employee Profile (detailed, sectioned)
export const getEmployeeProfile = (id) => api.get(`/employee-profiles/${id}`)
export const updateEmployeeProfile = (id, data) => api.put(`/employee-profiles/${id}`, data)

// Departments
export const getDepartments = () => api.get('/departments/')
export const getDepartmentDistribution = () => api.get('/departments/distribution')
export const createDepartment = (data) => api.post('/departments/', data)
export const updateDepartment = (id, data) => api.put(`/departments/${id}`, data)
export const deleteDepartment = (id) => api.delete(`/departments/${id}`)

// Attendance
export const checkIn = (data) => api.post('/attendance/checkin', data)
export const checkOut = () => api.post('/attendance/checkout')
export const getTodayStatus = () => api.get('/attendance/today')
export const getMyAttendance = (params) => api.get('/attendance/my', { params })
export const getAllAttendance = (params) => api.get('/attendance/all', { params })
export const getAttendancePresence = (params) => api.get('/attendance/presence', { params })
export const updateAttendance = (id, data) => api.put(`/attendance/${id}`, data)

// Leave
export const getLeaveTypes = () => api.get('/leave/types')
export const createLeaveType = (data) => api.post('/leave/types', data)
export const getMyLeaveBalance = () => api.get('/leave/balance')
export const applyLeave = (data) => api.post('/leave/apply', data)
export const uploadLeaveAttachment = (formData) => api.post('/leave/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const getMyLeaves = (params) => api.get('/leave/my', { params })
export const getPendingLeaves = () => api.get('/leave/pending')
export const getTeamPendingLeaves = () => api.get('/leave/team-pending')
export const getAllLeaves = (params) => api.get('/leave/all', { params })
export const approveLeave = (id, data) => api.put(`/leave/${id}/approve`, data)
export const bulkApproveLeaves = (ids, status) => api.post('/leave/bulk-approve', { ids, status })
export const cancelLeave = (id) => api.delete(`/leave/${id}`)
export const getLeavePreview = (params) => api.get('/leave/preview', { params })
export const getLeaveEligibility = () => api.get('/leave/eligibility')
export const requestLeaveEnablement = (data) => api.post('/leave/enablement-requests', data)
export const getMyEnablementRequests = () => api.get('/leave/enablement-requests/my')

// Payroll
export const generatePayslip = (data) => api.post('/payroll/generate', data)
export const generateBulkPayslips = (params) => api.post('/payroll/generate-bulk', null, { params })
export const getMyPayslips = () => api.get('/payroll/my')
export const getAllPayslips = (params) => api.get('/payroll/all', { params })
export const getPayslip = (id) => api.get(`/payroll/${id}`)
export const markPaid = (id, params) => api.put(`/payroll/${id}/mark-paid`, null, { params })

// Performance
export const createReview = (data) => api.post('/performance/', data)
export const getMyReviews = () => api.get('/performance/my')
export const getTeamReviews = () => api.get('/performance/team')
export const getAllReviews = () => api.get('/performance/all')

// Documents
export const getMyDocuments = () => api.get('/documents/my')
export const getEmployeeDocuments = (id) => api.get(`/documents/employee/${id}`)
export const uploadDocument = (formData) => api.post('/documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const deleteDocument = (id) => api.delete(`/documents/${id}`)

// Announcements
export const getAnnouncements = () => api.get('/announcements/')
export const createAnnouncement = (data) => api.post('/announcements/', data)
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`)

// Modules
export const getModuleStats = () => api.get('/modules/stats')
// SSO handoff into the Alumni Network's HR/Admin portals — role-mapped,
// see HRModulePage.jsx's Alumni tile.
export const getAlumniSsoUrl = () => api.get('/modules/alumni-sso-url')

// Org Chart Editor
export const getOrgChartEditorChart = () => api.get('/orgchart-editor/chart')
export const getOrgChartEditorUnassigned = () => api.get('/orgchart-editor/unassigned')
export const placeOrgChartEmployee = (id, positionX, positionY) =>
  api.patch(`/orgchart-editor/employees/${id}/place`, { positionX, positionY })
export const moveOrgChartEmployee = (id, positionX, positionY) =>
  api.patch(`/orgchart-editor/employees/${id}/move`, { positionX, positionY })
export const setOrgChartManager = (employeeId, managerId) =>
  api.patch(`/orgchart-editor/employees/${employeeId}/manager`, { managerId })
export const removeOrgChartManager = (employeeId) =>
  api.delete(`/orgchart-editor/employees/${employeeId}/manager`)
export const addOrgChartEmployee = (data) => api.post('/orgchart-editor/employees', data)
export const editOrgChartEmployee = (id, data) => api.patch(`/orgchart-editor/employees/${id}/details`, data)
export const removeFromOrgChart = (id) =>
  api.patch(`/orgchart-editor/employees/${id}/remove-from-chart`)

// Assets
export const getAssetStats = () => api.get('/assets/stats')
export const getAssetCategories = () => api.get('/assets/categories')
export const getRecentAssetAssignments = (limit = 10) => api.get('/assets/assignments/recent', { params: { limit } })
export const getAssets = (params) => api.get('/assets/', { params })
export const getAsset = (id) => api.get(`/assets/${id}`)
export const createAsset = (data) => api.post('/assets/', data)
export const updateAsset = (id, data) => api.put(`/assets/${id}`, data)
export const assignAsset = (id, data) => api.post(`/assets/${id}/assign`, data)
export const returnAsset = (id, data) => api.post(`/assets/${id}/return`, data)
export const maintenanceAsset = (id, data) => api.post(`/assets/${id}/maintenance`, data)
export const retireAsset = (id) => api.put(`/assets/${id}/retire`)
export const getEmployeeAssets = (q) => api.get('/assets/employee-search', { params: { q } })
export const deleteAsset = (id) => api.delete(`/assets/${id}`)
export const getWarrantyExpiringAssets = (days = 30) => api.get('/assets/warranty-expiring', { params: { days } })

// Policy & Handbook
export const getPolicyStats = () => api.get('/policy/stats')
export const getPolicies = (params) => api.get('/policy/', { params })
export const getPolicy = (id) => api.get(`/policy/${id}`)
export const uploadPolicy = (formData) => api.post('/policy/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const downloadPolicy = (id) => api.get(`/policy/${id}/download`, { responseType: 'blob' })
export const assignPolicy = (id, data) => api.post(`/policy/${id}/assign`, data)
export const unassignPolicy = (id, employeeId) => api.delete(`/policy/${id}/unassign/${employeeId}`)
export const deletePolicy = (id) => api.delete(`/policy/${id}`)

// AI Assistant
export const askAI = (message, history = []) =>
  api.post('/ai/chat', { message, history })

export const uploadPolicyPDF = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/ai/upload-policy', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// User Management
export const getUsers        = (params)              => api.get('/user-management/users', { params })
export const updateUserRole  = (id, data)            => api.put(`/user-management/users/${id}/role`, data)
export const updateUserAccess = (id, data)           => api.put(`/user-management/users/${id}/access`, data)
export const updateUserArchive = (id, archived)      => api.put(`/user-management/users/${id}/archive`, { archived })
export const getUserKpis     = ()                     => api.get('/user-management/kpis')
export const getUserFilters  = ()                     => api.get('/user-management/filters')
export const getUserCharts   = ()                     => api.get('/user-management/charts')
export const getRecentlyAddedUsers = (limit = 6)      => api.get('/user-management/recently-added', { params: { limit } })
export const getUserDetail   = (id)                   => api.get(`/user-management/users/${id}`)
export const getUserActivity = (id, limit = 20)       => api.get(`/user-management/users/${id}/activity`, { params: { limit } })
export const exportUsersCsv   = (params)              => api.get('/user-management/export/csv', { params, responseType: 'blob' })
export const exportUsersExcel = (params)              => api.get('/user-management/export/excel', { params, responseType: 'blob' })
export const exportUsersPdf   = (params)              => api.get('/user-management/export/pdf', { params, responseType: 'blob' })

// User Management — bulk actions (multi-select toolbar)
export const bulkUpdateUserAccess = (ids, is_active) => api.post('/user-management/users/bulk/access', { ids, is_active })
export const bulkUpdateUserRole   = (ids, role)      => api.post('/user-management/users/bulk/role', { ids, role })
export const bulkAssignManager    = (ids, manager_id) => api.post('/user-management/users/bulk/manager', { ids, manager_id })
export const bulkResetPassword    = (ids, notifyEmail = false) => api.post('/user-management/users/bulk/reset-password', { ids, notify_email: notifyEmail })
export const bulkDeleteUsers      = (ids)            => api.post('/user-management/users/bulk/delete', { ids })

export const listAISources  = ()           => api.get('/ai/sources')
export const deleteAISource = (sourceName) => api.delete(`/ai/sources/${encodeURIComponent(sourceName)}`)
export const getAIHealth    = ()           => api.get('/ai/health')

// Shift & Roster
export const getShiftStats            = ()              => api.get('/shift/stats')
export const searchShiftEmployees     = (q)             => api.get('/shift/employees/search', { params: { q } })
export const getEmployeeCurrentShift  = (id)            => api.get(`/shift/employees/${id}/current-shift`)
export const getEmployeeShiftHistory  = (id)            => api.get(`/shift/employees/${id}/shift-history`)
export const getEmployeeSwapRequests  = (id)            => api.get(`/shift/employees/${id}/swap-requests`)
export const getShifts                = (params)        => api.get('/shift/', { params })
export const createShift              = (data)          => api.post('/shift/', data)
export const updateShift              = (id, data)      => api.put(`/shift/${id}`, data)
export const deleteShift              = (id)            => api.delete(`/shift/${id}`)
export const getShiftMappings         = (params)        => api.get('/shift/mappings', { params })
export const assignShift              = (data)          => api.post('/shift/mappings', data)
export const updateShiftMapping       = (id, data)      => api.put(`/shift/mappings/${id}`, data)
export const removeShiftMapping       = (id)            => api.delete(`/shift/mappings/${id}`)
export const requestShiftSwap         = (data)          => api.post('/shift/swaps', data)
export const getShiftSwaps            = (params)        => api.get('/shift/swaps', { params })
export const approveShiftSwap         = (id, data)      => api.put(`/shift/swaps/${id}/approve`, data)
export const getUserSpecificShifts    = (employeeId, startDate, endDate) =>
  api.get('/shift/user-specific', { params: { employee_id: employeeId, start_date: startDate, end_date: endDate } })
export const getShiftMappingsCalendar = (params)        => api.get('/shift/mappings/calendar', { params })

// Travel
export const createTravelRequest   = (data)   => api.post('/travel/', data)
export const getMyTravelRequests   = ()        => api.get('/travel/my')
export const getAllTravelRequests   = ()        => api.get('/travel/all')
export const getTravelRequest      = (id)      => api.get(`/travel/${id}`)
export const updateTravelRequest   = (id, data) => api.put(`/travel/${id}`, data)
export const cancelTravelRequest   = (id)      => api.delete(`/travel/${id}`)
export const approveTravelRequest  = (id, data) => api.put(`/travel/${id}/approve`, data)

// Reimbursement
export const getReimbursementCategories = ()           => api.get('/reimbursement/categories')
export const createReimbursement        = (data)       => api.post('/reimbursement/', data)
export const getMyReimbursements        = ()           => api.get('/reimbursement/my')
export const getAllReimbursements        = ()           => api.get('/reimbursement/all')
export const getReimbursement           = (id)         => api.get(`/reimbursement/${id}`)
export const updateReimbursement        = (id, data)   => api.put(`/reimbursement/${id}`, data)
export const approveReimbursement       = (id, data)   => api.put(`/reimbursement/${id}/approve`, data)
export const markReimbursementPaid      = (id)         => api.put(`/reimbursement/${id}/mark-paid`)
export const uploadReimbursementDoc     = (id, formData) => api.post(`/reimbursement/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteReimbursementDoc     = (id, docId)  => api.delete(`/reimbursement/${id}/documents/${docId}`)

// Offboarding
export const submitResignation      = (data)            => api.post('/offboarding/', data)
export const getMyOffboarding       = ()                => api.get('/offboarding/my')
export const getAllOffboarding       = ()                => api.get('/offboarding/all')
export const getOffboarding         = (id)              => api.get(`/offboarding/${id}`)
export const updateOffboarding      = (id, data)        => api.put(`/offboarding/${id}`, data)
export const toggleChecklistItem    = (id, itemId)      => api.put(`/offboarding/${id}/checklist/${itemId}`)

// Insurance
export const getMyInsurance         = ()                  => api.get('/insurance/my')
export const getEmployeeInsurance   = (empId)             => api.get(`/insurance/employee/${empId}`)
export const createInsuranceDetail  = (data)              => api.post('/insurance/', data)
export const updateInsuranceDetail  = (id, data)          => api.put(`/insurance/${id}`, data)
export const getInsuranceDependents = (insId)             => api.get(`/insurance/${insId}/dependents`)
export const addInsuranceDependent  = (insId, data)       => api.post(`/insurance/${insId}/dependents`, data)
export const updateInsuranceDependent = (insId, depId, data) => api.put(`/insurance/${insId}/dependents/${depId}`, data)

// Asset Requisition (legacy)
export const getAssetTypes              = ()           => api.get('/asset-requisition/asset-types')
export const createAssetRequisition     = (data)       => api.post('/asset-requisition/', data)
export const getMyAssetRequisitions     = ()           => api.get('/asset-requisition/my')
export const getAllAssetRequisitions     = ()           => api.get('/asset-requisition/all')
export const getAssetRequisition        = (id)         => api.get(`/asset-requisition/${id}`)
export const updateAssetRequisition     = (id, data)   => api.put(`/asset-requisition/${id}`, data)
export const cancelAssetRequisition     = (id)         => api.delete(`/asset-requisition/${id}`)
export const approveAssetRequisition    = (id, data)   => api.put(`/asset-requisition/${id}/approve`, data)

// Asset Ticket System
export const getTicketDepartments       = ()                    => api.get('/asset-requisition/departments')
export const getTicketServiceTypes      = ()                    => api.get('/asset-requisition/service-types')
export const getTicketClassifications   = ()                    => api.get('/asset-requisition/classifications')
export const createAssetTicket          = (data)                => api.post('/asset-requisition/tickets', data)
export const getMyAssetTickets          = ()                    => api.get('/asset-requisition/tickets')
export const getAllAssetTickets         = ()                    => api.get('/asset-requisition/tickets/all')
export const updateTicketStatus         = (id, data)            => api.put(`/asset-requisition/tickets/${id}/status`, data)
export const getAssetTicket             = (id)                  => api.get(`/asset-requisition/tickets/${id}`)
export const updateAssetTicket          = (id, data)            => api.put(`/asset-requisition/tickets/${id}`, data)
export const cancelAssetTicket          = (id)                  => api.put(`/asset-requisition/tickets/${id}/cancel`)
export const getTicketHistory           = (id)                  => api.get(`/asset-requisition/tickets/${id}/history`)
export const uploadTicketAttachment     = (id, formData)        => api.post(`/asset-requisition/tickets/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getTicketAttachments       = (id)                  => api.get(`/asset-requisition/tickets/${id}/attachments`)
export const deleteTicketAttachment     = (ticketId, attId)     => api.delete(`/asset-requisition/tickets/${ticketId}/attachments/${attId}`)

// Leave Tracker (Admin-only HR Operations module)
export const ltSearchEmployees       = (q)                    => api.get('/leave-tracker/employees/search', { params: { q } })
export const ltGetEmployeeSummary    = (empId)                => api.get(`/leave-tracker/employees/${empId}/summary`)
export const ltGetEmployeeBalance    = (empId, year)          => api.get(`/leave-tracker/employees/${empId}/balance`, { params: year ? { year } : {} })
export const ltUpdateEmployeeBalance = (empId, balId, data)   => api.put(`/leave-tracker/employees/${empId}/balance/${balId}`, data)
export const ltGetEmployeeRequests   = (empId, status)        => api.get(`/leave-tracker/employees/${empId}/requests`, { params: status ? { status } : {} })
export const ltGetEmployeePending    = (empId)                => api.get(`/leave-tracker/employees/${empId}/pending`)
export const ltGetEmployeeApproved   = (empId)                => api.get(`/leave-tracker/employees/${empId}/approved`)
export const ltGetEmployeeRejected   = (empId)                => api.get(`/leave-tracker/employees/${empId}/rejected`)
export const ltGetEmployeeCompOff    = (empId)                => api.get(`/leave-tracker/employees/${empId}/compoff`)
export const ltGetAllRequests        = (params)               => api.get('/leave-tracker/requests', { params })
export const ltGetCompRequests       = (params)               => api.get('/leave-tracker/comp-requests', { params })
export const ltApproveRequest        = (leaveId, data)        => api.put(`/leave-tracker/requests/${leaveId}/approve`, data)
export const ltGetHolidays           = (year, region)         => api.get('/leave-tracker/holidays', { params: { ...(year ? { year } : {}), ...(region ? { region } : {}) } })
export const getUpcomingBirthdays    = ()                     => api.get('/employees/birthdays')
export const ltCreateHoliday         = (data)                 => api.post('/leave-tracker/holidays', data)
export const ltDeleteHoliday         = (id)                   => api.delete(`/leave-tracker/holidays/${id}`)
export const ltParseHolidayPdf       = (formData)              => api.post('/leave-tracker/holidays/parse-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const ltBulkApplyHolidays     = (data)                  => api.post('/leave-tracker/holidays/bulk-apply', data)
export const ltGetLeaveTypes         = ()                     => api.get('/leave-tracker/leave-types')
export const ltUpdateLeaveType       = (id, data)             => api.put(`/leave-tracker/leave-types/${id}`, data)
export const ltGetLeaveTypeEligibility = (id)                 => api.get(`/leave-tracker/leave-types/${id}/eligibility`)
export const ltUpdateLeaveTypeEligibility = (id, rules)       => api.put(`/leave-tracker/leave-types/${id}/eligibility`, { rules })
export const ltGetEnablementRequests = (status)               => api.get('/leave-tracker/enablement-requests', { params: status ? { status } : {} })
export const ltDecideEnablement      = (id, data)             => api.put(`/leave-tracker/enablement-requests/${id}/decision`, data)
export const ltRunSchedulerJob       = (jobName, params)      => api.post(`/leave-tracker/scheduler/run/${jobName}`, null, { params })
export const ltGetMetrics            = ()                     => api.get('/leave-tracker/metrics')

export default api
