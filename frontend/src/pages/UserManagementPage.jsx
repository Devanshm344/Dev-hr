import React, { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Users, UserCheck, UserX, Lock, UserPlus, Plus, Upload } from 'lucide-react'
import { getUsers, updateUserRole, updateUserAccess, updateUserArchive, adminDisableMfa, bulkResetPassword, getUserKpis, getUserFilters, getUserCharts, getRecentlyAddedUsers, createEmployee } from '../services/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'
import KpiCard from '../components/dashboard/KpiCard'
import Pagination from '../components/ui/Pagination'
import AddEmployeeModal from '../components/AddEmployeeModal'
import UserFilters, { EMPTY_FILTERS } from '../components/userManagement/UserFilters'
import UserTable from '../components/userManagement/UserTable'
import BulkActionBar, { AssignRoleModal, ResetPasswordResultsModal, ImportResultsModal } from '../components/userManagement/BulkActionBar'
import UserChartsPanel from '../components/userManagement/UserChartsPanel'
import RecentlyAddedUsers from '../components/userManagement/RecentlyAddedUsers'
import UserDrawer from '../components/userManagement/UserDrawer'
import UserExportMenu from '../components/userManagement/UserExportMenu'
import { roleDisplayLabel } from '../rbac/constants'

const KPI_CARDS = [
  { key: 'totalUsers',     title: 'Total Users',    subtitle: 'All employees',        icon: Users,     color: 'primary'   },
  { key: 'activeUsers',    title: 'Active',         subtitle: 'Status: Active',       icon: UserCheck, color: 'success'   },
  { key: 'inactiveUsers',  title: 'Inactive',       subtitle: 'Inactive / On Leave',  icon: UserX,     color: 'warning'   },
  { key: 'lockedAccounts', title: 'Locked',         subtitle: 'Login access disabled', icon: Lock,      color: 'secondary' },
  { key: 'adminUsers',     title: 'Admins',         subtitle: 'Human Resources + Admin', icon: ShieldCheck, color: 'primary' },
  { key: 'newThisMonth',   title: 'New This Month', subtitle: 'Joined this month',    icon: UserPlus,  color: 'success'   },
]

const PAGE_SIZE = 10

// Minimal quoted-field-aware CSV line parser — the source project this page
// was ported from used a naive line.split(",") that breaks on any comma
// inside a quoted value (e.g. an address). Fixing that here rather than
// porting the known bug.
function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cur += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { cells.push(cur); cur = '' }
    else cur += c
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuthStore()

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const [savingRole, setSavingRole] = useState(null)
  const [savingAccess, setSavingAccess] = useState(null)
  const [disablingMfa, setDisablingMfa] = useState(null)
  const [archivingId, setArchivingId] = useState(null)
  const [resettingId, setResettingId] = useState(null)
  const [invitingId, setInvitingId] = useState(null)
  const [roleModalUser, setRoleModalUser] = useState(null)
  const [singleLinkModal, setSingleLinkModal] = useState(null)
  const [importResults, setImportResults] = useState(null)
  const [filterOptions, setFilterOptions] = useState(null)

  const [kpis, setKpis] = useState(null)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [charts, setCharts] = useState(null)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [recentlyAdded, setRecentlyAdded] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [drawerUserId, setDrawerUserId] = useState(null)
  const [drawerTab, setDrawerTab] = useState(0)
  const openDrawer = (id, tab = 0) => { setDrawerUserId(id); setDrawerTab(tab) }
  const [showAddModal, setShowAddModal] = useState(false)
  const importInputRef = useRef(null)

  const [selectedIds, setSelectedIds] = useState(new Set())

  const debounceRef = useRef(null)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch, filters])
  useEffect(() => { setSelectedIds(new Set()) }, [debouncedSearch, filters, page])

  const handleToggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleToggleSelectAll = () => setSelectedIds(prev => {
    const selectable = users.filter(u => u.id !== currentUser?.id)
    const allSelected = selectable.length > 0 && selectable.every(u => prev.has(u.id))
    return allSelected ? new Set() : new Set(selectable.map(u => u.id))
  })
  const handleBulkDone = () => { setSelectedIds(new Set()); loadUsers(); loadInsights() }

  useEffect(() => {
    getUserFilters().then(r => setFilterOptions(r.data)).catch(() => toast.error('Failed to load filter options'))
    loadInsights()
  }, [])

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters, sortBy, sortDir, page])

  const loadInsights = async () => {
    setKpisLoading(true)
    setChartsLoading(true)
    setRecentLoading(true)
    try {
      const [k, c, r] = await Promise.all([getUserKpis(), getUserCharts(), getRecentlyAddedUsers(6)])
      setKpis(k.data)
      setCharts(c.data)
      setRecentlyAdded(r.data)
    } catch {
      toast.error('Failed to load user insights')
    } finally {
      setKpisLoading(false)
      setChartsLoading(false)
      setRecentLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = { sort_by: sortBy, sort_dir: sortDir, page, page_size: PAGE_SIZE }
      if (debouncedSearch) params.search = debouncedSearch
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
      const res = await getUsers(params)
      setUsers(res.data.items)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key) => {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const handleRoleChange = async (userId, newRole) => {
    setSavingRole(userId)
    try {
      const res = await updateUserRole(userId, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: res.data.role } : u))
      toast.success(`Role updated to "${roleDisplayLabel(newRole)}"`)
      loadInsights()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role')
      loadUsers()
    } finally {
      setSavingRole(null)
    }
  }

  const handleAccessChange = async (userId, nextActive) => {
    setSavingAccess(userId)
    try {
      const res = await updateUserAccess(userId, { is_active: nextActive })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: res.data.is_active } : u))
      toast.success(nextActive ? 'Login access enabled' : 'Login access disabled')
      loadInsights()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update login access')
      loadUsers()
    } finally {
      setSavingAccess(null)
    }
  }

  const handleDisableMfa = async (userId) => {
    setDisablingMfa(userId)
    try {
      await adminDisableMfa(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, mfa_enabled: false } : u))
      toast.success('MFA disabled for this user')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to disable MFA')
    } finally {
      setDisablingMfa(null)
    }
  }

  const handleToggleArchive = async (userId, archived) => {
    setArchivingId(userId)
    try {
      const res = await updateUserArchive(userId, archived)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: res.data.status } : u))
      toast.success(archived ? 'User archived' : 'User unarchived')
      loadInsights()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update archive status')
    } finally {
      setArchivingId(null)
    }
  }

  const handleResetPassword = async (userId) => {
    setResettingId(userId)
    try {
      const res = await bulkResetPassword([userId])
      setSingleLinkModal({ results: res.data.results, title: 'Reset password link' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate reset link')
    } finally {
      setResettingId(null)
    }
  }

  const handleSendInvitation = async (userId) => {
    setInvitingId(userId)
    try {
      const res = await bulkResetPassword([userId], true)
      const [result] = res.data.results
      if (result?.emailed) toast.success(`Invitation emailed to ${result.name}`)
      setSingleLinkModal({ results: res.data.results, title: 'Invitation' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send invitation')
    } finally {
      setInvitingId(null)
    }
  }

  const handleConfirmRoleModal = async (role) => {
    if (!roleModalUser) return
    await handleRoleChange(roleModalUser.id, role)
    setRoleModalUser(null)
  }

  const handleUserCreated = () => {
    loadUsers()
    loadInsights()
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) { toast.error('CSV file looks empty'); return }
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase())
    const deptByName = new Map((filterOptions?.departments || []).map(d => [d.name.toLowerCase(), d.id]))

    const results = []
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cells = parseCsvLine(line)
      const row = Object.fromEntries(headers.map((h, i) => [h, cells[i]]))
      const [firstName, ...rest] = (row.name || '').split(' ')
      const name = row.name || `${firstName || 'New'} ${rest.join(' ') || 'User'}`
      try {
        const res = await createEmployee({
          first_name: firstName || 'New',
          last_name: rest.join(' ') || 'User',
          email: row.email || row.workemail || `user${Date.now()}@techdemocracy.com`,
          department_id: deptByName.get((row.department || '').toLowerCase()) || undefined,
          title: row.title || row.designation || undefined,
          employment_type: row.employmenttype || 'Permanent',
          system_role: ['Admin', 'Super Admin', 'Employee'].includes(row.role) ? row.role : 'Employee',
        })
        results.push({ success: true, name, email: res.data.email, temp_password: res.data.temp_password })
      } catch (err) {
        results.push({ success: false, name, error: err.response?.data?.detail || 'Failed to create' })
      }
    }
    setImportResults(results)
    loadUsers()
    loadInsights()
  }

  const exportParams = {}
  if (filters.department_id) exportParams.department_id = filters.department_id
  if (filters.role) exportParams.role = filters.role
  if (filters.status) exportParams.status = filters.status
  if (filters.work_location) exportParams.work_location = filters.work_location
  if (filters.joined_after) exportParams.joined_after = filters.joined_after
  if (filters.joined_before) exportParams.joined_before = filters.joined_before

  return (
    <Container>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: BRAND_GRADIENT }}>
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">Manage employee directory, access roles, and system reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={16} /> Add User
          </button>
          <input type="file" accept=".csv" ref={importInputRef} className="hidden" onChange={handleImportFile} />
          <UserExportMenu params={exportParams} onImportClick={() => importInputRef.current?.click()} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {KPI_CARDS.map((cfg, idx) => (
          <KpiCard
            key={cfg.key}
            title={cfg.title}
            subtitle={cfg.subtitle}
            icon={cfg.icon}
            color={cfg.color}
            value={kpis?.[cfg.key]?.value}
            trendDelta={kpis?.[cfg.key]?.trend?.delta}
            trendLabel={kpis?.[cfg.key]?.trend?.label}
            sparkline={kpis?.[cfg.key]?.trend?.sparkline}
            loading={kpisLoading}
            delay={idx * 60}
          />
        ))}
      </div>

      <UserChartsPanel charts={charts} loading={chartsLoading} />

      <UserFilters
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onApply={setFilters}
        options={filterOptions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="space-y-4">
          <BulkActionBar
            selectedIds={selectedIds}
            users={users}
            filterOptions={filterOptions}
            onDone={handleBulkDone}
            onClear={() => setSelectedIds(new Set())}
          />

          <UserTable
            users={users}
            loading={loading}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            currentUserId={currentUser?.id}
            savingRole={savingRole}
            onRoleChange={handleRoleChange}
            savingAccess={savingAccess}
            onAccessChange={handleAccessChange}
            onOpenUser={openDrawer}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            disablingMfa={disablingMfa}
            onDisableMfa={handleDisableMfa}
            onAssignRole={setRoleModalUser}
            onResetPassword={handleResetPassword}
            onSendInvitation={handleSendInvitation}
            onViewActivity={(id) => openDrawer(id, 1)}
            onToggleArchive={handleToggleArchive}
            resettingId={resettingId}
            invitingId={invitingId}
            archivingId={archivingId}
          />

          {!loading && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="users" />
          )}
        </div>

        <div className="space-y-4">
          <RecentlyAddedUsers items={recentlyAdded} loading={recentLoading} onOpenUser={openDrawer} />
        </div>
      </div>

      {drawerUserId && (
        <UserDrawer userId={drawerUserId} tab={drawerTab} onTabChange={setDrawerTab} onClose={() => setDrawerUserId(null)} />
      )}

      {showAddModal && (
        <AddEmployeeModal onClose={() => setShowAddModal(false)} onCreated={handleUserCreated} />
      )}

      {roleModalUser && (
        <AssignRoleModal
          count={1}
          onClose={() => setRoleModalUser(null)}
          onConfirm={handleConfirmRoleModal}
          loading={savingRole === roleModalUser.id}
        />
      )}

      {singleLinkModal && (
        <ResetPasswordResultsModal
          results={singleLinkModal.results}
          title={singleLinkModal.title}
          onClose={() => setSingleLinkModal(null)}
        />
      )}

      {importResults && (
        <ImportResultsModal results={importResults} onClose={() => setImportResults(null)} />
      )}
    </Container>
  )
}
