import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { getEmployees } from '../services/api'
import { isAdmin as isAdminRole } from '../rbac/constants'
import { useAuthStore } from '../store/authStore'

/**
 * Global "search all employees" bar in the header, available to every role.
 * Uses GET /employees/ (employees.py) which is intentionally not admin-gated
 * — but as of this component's addition that endpoint returns only safe,
 * directory-style fields (name/title/department/photo) to non-admin callers,
 * never salary/bank/personal details. Selecting a result only navigates to
 * the full profile for admins, since /employees/:id is an admin-only route.
 */
export default function GlobalEmployeeSearch() {
  const { user } = useAuthStore()
  const isAdmin = isAdminRole(user)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      getEmployees({ search: q, limit: 8 })
        .then(r => { setResults(r.data.employees || []); setOpen(true) })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleSelect = (emp) => {
    setOpen(false)
    setQuery('')
    if (isAdmin) navigate(`/employees/${emp.id}`)
  }

  return (
    <div className="relative flex-1 max-w-md mx-4 hidden md:block" ref={wrapRef}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search employees by name, ID, email, title..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 focus:bg-white transition-all"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No employees found</p>
          ) : (
            results.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelect(emp)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors',
                  !isAdmin && 'cursor-default'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-xs shrink-0 overflow-hidden">
                  {emp.profile_picture ? (
                    <img src={emp.profile_picture} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <>{emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}</>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.title || '—'}{emp.department ? ` · ${emp.department}` : ''}</p>
                </div>
                <span className="text-dense-tight text-gray-300 shrink-0">{emp.employee_id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
