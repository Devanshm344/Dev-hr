import React, { useEffect, useState } from 'react'
import { getMyAttendance, getAllAttendance } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import { Clock, Calendar, TrendingUp, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import Container from '../components/ui/Container'
import { formatTimeInTz } from '../utils/timezone'

const STATUS_COLORS = {
  present: 'badge-green',
  absent: 'badge-red',
  half_day: 'badge-yellow',
  work_from_home: 'badge-blue',
}

export default function AttendancePage() {
  const { user } = useAuthStore()
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const isAdmin = isAdminRole(user)

  useEffect(() => { loadAttendance() }, [month, year])

  const loadAttendance = async () => {
    setLoading(true)
    try {
      const res = await getMyAttendance({ month, year })
      setRecords(res.data.records)
      setSummary(res.data.summary)
    } catch {} finally { setLoading(false) }
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <Container>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">Your attendance records</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)} className="input w-28">
            {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} className="input w-24">
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: summary.present || 0, icon: '✅', color: 'text-green-600 bg-green-50' },
          { label: 'Absent', value: summary.absent || 0, icon: '❌', color: 'text-red-600 bg-red-50' },
          { label: 'Total Hours', value: `${summary.total_hours || 0}h`, icon: '⏰', color: 'text-blue-600 bg-blue-50' },
          { label: 'Avg Hours/Day', value: `${summary.avg_hours || 0}h`, icon: '📊', color: 'text-secondary-600 bg-secondary-50' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className={clsx('text-2xl mb-1 w-10 h-10 rounded-lg flex items-center justify-center', c.color)}>{c.icon}</div>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Records table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Daily Records — {months[month-1]} {year}</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-600" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No records for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th className="!text-right">Work Hours</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td>{r.check_in ? formatTimeInTz(r.check_in, r.employee_timezone) : '—'}</td>
                    <td>{r.check_out ? formatTimeInTz(r.check_out, r.employee_timezone) : '—'}</td>
                    <td className="text-right">
                      {r.work_hours ? (
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: `${Math.min((r.work_hours / 9) * 100, 100)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums">{r.work_hours}h</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td><span className={STATUS_COLORS[r.status] || 'badge-gray'}>{r.status?.replace('_', ' ')}</span></td>
                    <td className="text-gray-500 text-xs">{r.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Container>
  )
}
