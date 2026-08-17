import React, { useEffect, useState } from 'react'
import { getMyPayslips, getAllPayslips, generateBulkPayslips, markPaid } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import { DollarSign, Loader2, TrendingUp, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import TechLogo from '../assets/techdemocracy-logo.svg'
import Container from '../components/ui/Container'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function PayrollPage() {
  const { user } = useAuthStore()
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('my')
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1)
  const [genYear, setGenYear] = useState(new Date().getFullYear())
  const [generating, setGenerating] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState(null)

  const isAdmin = isAdminRole(user)

  useEffect(() => { loadPayslips() }, [tab])

  const loadPayslips = async () => {
    setLoading(true)
    try {
      if (tab === 'my') {
        const res = await getMyPayslips()
        setPayslips(res.data)
      } else {
        const res = await getAllPayslips({ limit: 100 })
        setPayslips(res.data.payslips)
      }
    } catch {} finally { setLoading(false) }
  }

  const handleGenerateBulk = async () => {
    setGenerating(true)
    try {
      const res = await generateBulkPayslips({ month: genMonth, year: genYear })
      toast.success(`Generated ${res.data.generated} payslips, skipped ${res.data.skipped}`)
      loadPayslips()
    } catch (e) {
      toast.error('Failed to generate payslips')
    } finally { setGenerating(false) }
  }

  const handleMarkPaid = async (id) => {
    try {
      await markPaid(id)
      toast.success('Marked as paid')
      loadPayslips()
    } catch {}
  }

  const PayslipModal = ({ p }) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPayslip(null)}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 bg-gradient-to-br from-primary-600 to-primary-800 text-white rounded-t-2xl">
          <div className="flex justify-between">
            <div>
              <img src={TechLogo} alt="Techdemocracy" className="h-5 w-auto" style={{ filter: 'brightness(0) invert(1) opacity(0.85)' }} />
              <h2 className="text-xl font-bold">Pay Slip</h2>
              <p className="text-sky-200 text-sm">{MONTHS[p.month - 1]} {p.year}</p>
            </div>
            <div className="text-right">
              <p className="text-sky-200 text-xs">Net Salary</p>
              <p className="text-3xl font-black">₹{p.net_salary.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Employee:</span> <span className="font-medium">{p.employee_name}</span></div>
            <div><span className="text-gray-500">ID:</span> <span className="font-medium">{p.employee_code}</span></div>
            <div><span className="text-gray-500">Designation:</span> <span className="font-medium">{p.title}</span></div>
            <div><span className="text-gray-500">Department:</span> <span className="font-medium">{p.department}</span></div>
            <div><span className="text-gray-500">Working Days:</span> <span className="font-medium">{p.working_days}</span></div>
            <div><span className="text-gray-500">Present Days:</span> <span className="font-medium">{p.present_days}</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">Earnings</h4>
              <div className="space-y-1.5 text-sm">
                {[['Basic Salary', p.basic_salary], ['HRA', p.hra], ['Special Allowance', p.special_allowance], ['Transport', p.transport_allowance], ['Medical', p.medical_allowance]].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium">₹{v?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-1.5 mt-2">
                  <span>Gross Salary</span>
                  <span className="text-green-600">₹{p.gross_salary?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">Deductions</h4>
              <div className="space-y-1.5 text-sm">
                {[['PF (12%)', p.pf_deduction], ['Professional Tax', p.professional_tax], ['TDS', p.tds], ['Other', p.other_deductions]].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium">₹{v?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-1.5 mt-2">
                  <span>Total Deductions</span>
                  <span className="text-red-600">₹{p.total_deductions?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-primary-50 rounded-xl p-4 flex justify-between items-center">
            <span className="font-bold text-gray-900">Net Take Home</span>
            <span className="text-2xl font-black text-primary-600">₹{p.net_salary?.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 border-t pt-3">
            <span>Status: <span className={p.status === 'paid' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>{p.status}</span></span>
            {p.payment_date && <span>Paid on: {new Date(p.payment_date).toLocaleDateString('en-IN')}</span>}
          </div>
          <button onClick={() => setSelectedPayslip(null)} className="btn-secondary w-full justify-center">Close</button>
        </div>
      </div>
    </div>
  )

  return (
    <Container>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500">Salary slips & payroll management</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 items-center">
            <select value={genMonth} onChange={e => setGenMonth(+e.target.value)} className="input w-24">
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={genYear} onChange={e => setGenYear(+e.target.value)} className="input w-20">
              {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
            </select>
            <button onClick={handleGenerateBulk} disabled={generating} className="btn-primary">
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Generate All
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex border-b border-gray-200 gap-5">
          {['my', 'all'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={clsx('pb-2 text-sm font-medium border-b-2 -mb-px', tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500')}>
              {t === 'my' ? 'My Payslips' : 'All Payslips'}
            </button>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {tab === 'all' && <th>Employee</th>}
                  <th>Period</th>
                  <th className="!text-right">Gross</th>
                  <th className="!text-right">Deductions</th>
                  <th className="!text-right">Net Salary</th>
                  <th>Status</th>
                  <th className="!text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map(p => (
                  <tr key={p.id}>
                    {tab === 'all' && <td className="font-medium">{p.employee_name}<br/><span className="text-xs text-gray-400">{p.employee_code}</span></td>}
                    <td className="font-medium">{MONTHS[p.month - 1]} {p.year}</td>
                    <td className="text-right tabular-nums">₹{p.gross_salary?.toLocaleString('en-IN')}</td>
                    <td className="text-right tabular-nums text-red-500">-₹{p.total_deductions?.toLocaleString('en-IN')}</td>
                    <td className="text-right tabular-nums font-bold text-primary-600">₹{p.net_salary?.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={p.status === 'paid' ? 'badge-green' : p.status === 'generated' ? 'badge-blue' : 'badge-yellow'}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setSelectedPayslip(p)} className="text-primary-600 hover:bg-primary-50 p-1 rounded text-xs font-medium">View</button>
                        {isAdmin && p.status !== 'paid' && (
                          <button onClick={() => handleMarkPaid(p.id)} className="text-green-600 hover:bg-green-50 p-1 rounded text-xs font-medium">Mark Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {payslips.length === 0 && (
                  <tr><td colSpan={tab === 'all' ? 7 : 6} className="text-center py-10 text-gray-400">No payslips found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPayslip && <PayslipModal p={selectedPayslip} />}
    </Container>
  )
}
