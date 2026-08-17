import React, { useState, useEffect, useCallback } from 'react'
import { Receipt, Plus, X, AlertCircle, Loader2, Calendar, Tag, Check, Paperclip, IndianRupee, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createReimbursement, getMyReimbursements, getAllReimbursements, getReimbursementCategories,
  approveReimbursement, markReimbursementPaid, uploadReimbursementDoc,
} from '../services/api'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'

const STATUS_STYLES = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  paid:     'bg-blue-50 text-blue-700 border-blue-200',
}

const EMPTY_FORM = {
  category: '',
  description: '',
  amount: '',
  expense_date: '',
}

export default function ReimbursementPage() {
  const { user } = useAuthStore()
  const isAdmin = isAdminRole(user)
  const [view, setView]             = useState('mine') // 'mine' | 'all' (admin only)
  const [requests, setRequests]     = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [receiptFile, setReceiptFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [decidingId, setDecidingId] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [reqRes, catRes] = await Promise.all([
        view === 'all' ? getAllReimbursements() : getMyReimbursements(),
        getReimbursementCategories(),
      ])
      setRequests(reqRes.data)
      setCategories(catRes.data)
    } catch {
      setError('Failed to load reimbursement data')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category)           return toast.error('Category is required')
    if (!form.description.trim()) return toast.error('Description is required')
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Valid amount is required')
    if (!form.expense_date)       return toast.error('Expense date is required')
    setSubmitting(true)
    try {
      const res = await createReimbursement({ ...form, amount: parseFloat(form.amount) })
      if (receiptFile) {
        const fd = new FormData()
        fd.append('file', receiptFile)
        await uploadReimbursementDoc(res.data.id, fd)
      }
      toast.success('Reimbursement request submitted')
      setShowModal(false)
      setForm(EMPTY_FORM)
      setReceiptFile(null)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecision = async (id, status) => {
    let rejection_reason
    if (status === 'rejected') {
      rejection_reason = window.prompt('Reason for rejecting this request (optional):') || undefined
    }
    setDecidingId(id)
    try {
      await approveReimbursement(id, { status, rejection_reason })
      toast.success(status === 'approved' ? 'Request approved' : 'Request rejected')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update request')
    } finally {
      setDecidingId(null)
    }
  }

  const handleMarkPaid = async (id) => {
    setDecidingId(id)
    try {
      await markReimbursementPaid(id)
      toast.success('Marked as paid')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark as paid')
    } finally {
      setDecidingId(null)
    }
  }

  const totalPending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
  const totalApproved = requests.filter(r => ['approved', 'paid'].includes(r.status)).reduce((s, r) => s + r.amount, 0)

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: BRAND_GRADIENT }}>
            <Receipt size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reimbursement</h1>
            <p className="text-xs text-gray-500">Submit and track expense reimbursements</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
          style={{ background: BRAND_GRADIENT }}
        >
          <Plus size={16} /> New Request
        </button>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {[['mine', 'My Requests'], ['all', 'All Requests']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === v ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
              }`}
              style={view === v ? { background: BRAND_GRADIENT } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-medium">Pending Amount</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">₹{totalPending.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{requests.filter(r => r.status === 'pending').length} request(s)</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-medium">Approved Amount</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">₹{totalApproved.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{requests.filter(r => ['approved','paid'].includes(r.status)).length} request(s)</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle size={18} /> <span className="text-sm">{error}</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No reimbursement requests yet</p>
          <p className="text-gray-400 text-sm mt-1">Submit your expense claims here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">₹{req.amount.toLocaleString()}</span>
                    <span className={`text-dense px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[req.status] || STATUS_STYLES.pending}`}>
                      {req.status}
                    </span>
                    {view === 'all' && req.employee_name && (
                      <span className="text-dense text-gray-400">· {req.employee_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{req.description}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Tag size={12} /> {req.category}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {req.expense_date}</span>
                    {req.documents?.length > 0 && (
                      <span className="flex items-center gap-1"><Paperclip size={12} /> {req.documents.length} receipt{req.documents.length > 1 ? 's' : ''}</span>
                    )}
                    {req.payment_date && (
                      <span className="flex items-center gap-1"><IndianRupee size={12} /> Paid {req.payment_date}</span>
                    )}
                  </div>
                  {req.rejection_reason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {req.rejection_reason}</p>
                  )}
                </div>
                {view === 'all' && req.status === 'pending' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDecision(req.id, 'approved')}
                      disabled={decidingId === req.id}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-all disabled:opacity-60"
                    >
                      {decidingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, 'rejected')}
                      disabled={decidingId === req.id}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all disabled:opacity-60"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}
                {view === 'all' && req.status === 'approved' && (
                  <button
                    onClick={() => handleMarkPaid(req.id)}
                    disabled={decidingId === req.id}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-60 shrink-0"
                  >
                    {decidingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <IndianRupee size={12} />} Mark as Paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">New Reimbursement Request</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
                <select value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  required>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the expense"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹) *</label>
                  <input type="number" min="1" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Expense Date *</label>
                  <input type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Receipt (optional)</label>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition-all">
                  <Upload size={14} />
                  {receiptFile ? receiptFile.name : 'Attach a receipt file'}
                  <input type="file" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: BRAND_GRADIENT }}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  )
}
