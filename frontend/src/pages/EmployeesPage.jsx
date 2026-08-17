import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getEmployees, getDepartments } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole, roleDisplayLabel } from '../rbac/constants'
import { Search, Plus, Eye, Loader2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import Container from '../components/ui/Container'
import AddEmployeeModal from '../components/AddEmployeeModal'
import Pagination from '../components/ui/Pagination'

const PAGE_SIZE = 15

function AvatarImg({ emp }) {
  const [imgError, setImgError] = useState(false)
  if (!emp.profile_picture || imgError) return null
  return (
    <img
      src={emp.profile_picture}
      alt={emp.name}
      className="absolute inset-0 w-full h-full object-cover"
      onError={() => setImgError(true)}
    />
  )
}

const statusBadge = (status) => {
  const map = { active: 'badge-green', inactive: 'badge-gray', on_leave: 'badge-yellow', terminated: 'badge-red' }
  return <span className={map[status] || 'badge-gray'}>{status?.replace('_', ' ')}</span>
}

const roleBadge = (role) => {
  const map = { Admin: 'badge-red', Employee: 'badge-green' }
  return <span className={map[role] || 'badge-gray'}>{roleDisplayLabel(role)}</span>
}

export default function EmployeesPage() {
  const { user } = useAuthStore()
  const [employees, setEmployees] = useState([])
  const [total, setTotal] = useState(0)
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)

  const navigate = useNavigate()
  const isAdmin = isAdminRole(user)

  useEffect(() => {
    setPage(1)
    getDepartments().then(r => setDepartments(r.data))
  }, [search, deptFilter, statusFilter])

  useEffect(() => {
    loadEmployees()
  }, [search, deptFilter, statusFilter, page])

  const loadEmployees = async () => {
    setLoading(true)
    try {
      const params = { search, limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }
      if (deptFilter) params.department_id = deptFilter
      if (statusFilter) params.status = statusFilter
      const res = await getEmployees(params)
      setEmployees(res.data.employees)
      setTotal(res.data.total)
    } catch { toast.error('Failed to load employees') }
    finally { setLoading(false) }
  }

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500">{total} total employees</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Add Employee
          </button>
        )}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, ID..." className="input pl-9" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="input w-44">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-36">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-30" />
            <p>No employees found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th><th>ID</th><th>Department</th><th>Designation</th>
                  <th>Role</th><th>Status</th><th>Joined</th><th className="!text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="cursor-pointer hover:bg-primary-50/40 transition-colors">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm shrink-0">
                          <span>{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</span>
                          <AvatarImg emp={emp} />
                        </div>
                        <div>
                          <p className="font-medium text-primary-700 text-sm hover:underline">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{emp.employee_id}</span></td>
                    <td className="text-sm">{emp.department || '—'}</td>
                    <td className="text-sm">{emp.title || '—'}</td>
                    <td>{roleBadge(emp.role)}</td>
                    <td>{statusBadge(emp.status)}</td>
                    <td className="text-sm text-gray-500">{emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <Link to={`/employees/${emp.id}`} className="inline-flex text-primary-600 hover:text-primary-700 p-1 rounded hover:bg-primary-50">
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="employees" />
      )}

      {showAdd && (
        <AddEmployeeModal onClose={() => setShowAdd(false)} onCreated={loadEmployees} />
      )}
    </Container>
  )
}
