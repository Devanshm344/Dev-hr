import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDepartmentDistribution } from '../../services/api'
import { Users, ChevronRight, RefreshCw } from 'lucide-react'

function SkeletonRow({ delay }) {
  return (
    <div className="flex items-center gap-3 animate-pulse" style={{ animationDelay: `${delay}ms` }}>
      <div className="h-3 w-16 shrink-0 rounded bg-gray-100" />
      <div className="h-2 flex-1 rounded-full bg-gray-100" />
      <div className="h-3 w-14 shrink-0 rounded bg-gray-100" />
    </div>
  )
}

export default function DepartmentDistributionCard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(false)
    getDepartmentDistribution()
      .then(res => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const departments = useMemo(
    () => [...(data?.departments || [])].sort((a, b) => b.employeeCount - a.employeeCount),
    [data]
  )
  const total = data?.totalEmployees || 0

  return (
    <div className="card p-5 animate-fade-up" style={{ animationDelay: '260ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 text-widget-label">Department Distribution</h2>
        <Link
          to="/departments"
          className="flex items-center gap-0.5 text-dense font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          View All
          <ChevronRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} delay={i * 80} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <Users size={20} className="text-red-300" />
          </div>
          <p className="text-sm text-gray-400 mb-3">Couldn't load department data.</p>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-dense font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-full border border-primary-100 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      ) : total === 0 || departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <Users size={20} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No department data available.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
          {departments.map((dept, i) => (
            <div key={dept.id} className="flex items-center gap-3 min-w-0">
              <span className="text-body font-medium text-gray-700 w-20 shrink-0 truncate">
                {dept.name}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-primary-600 progress-animated"
                  style={{ width: `${dept.percentage}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
              <span className="text-dense font-semibold text-gray-500 tabular-nums w-20 text-right shrink-0">
                {dept.employeeCount} ({dept.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
