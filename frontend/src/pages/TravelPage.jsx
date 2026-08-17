import React, { useState, useEffect, useCallback } from 'react'
import { Plane, Plus, X, AlertCircle, Loader2, Calendar, MapPin, DollarSign, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createTravelRequest, getMyTravelRequests, getAllTravelRequests, cancelTravelRequest, approveTravelRequest,
} from '../services/api'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
}

const TRAVEL_MODES = ['Flight', 'Train', 'Bus', 'Car', 'Other']

const EMPTY_FORM = {
  destination: '',
  purpose: '',
  departure_date: '',
  return_date: '',
  travel_mode: '',
  accommodation_required: false,
  estimated_budget: '',
  notes: '',
}

export default function TravelPage() {
  const { user } = useAuthStore()
  const isAdmin = isAdminRole(user)
  const [view, setView]           = useState('mine') // 'mine' | 'all' (admin only)
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [decidingId, setDecidingId] = useState(null)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = view === 'all' ? await getAllTravelRequests() : await getMyTravelRequests()
      setRequests(res.data)
    } catch {
      setError('Failed to load travel requests')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleDecision = async (id, status) => {
    let rejection_reason
    if (status === 'rejected') {
      rejection_reason = window.prompt('Reason for rejecting this request (optional):') || undefined
    }
    setDecidingId(id)
    try {
      await approveTravelRequest(id, { status, rejection_reason })
      toast.success(status === 'approved' ? 'Request approved' : 'Request rejected')
      fetchRequests()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update request')
    } finally {
      setDecidingId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.destination.trim()) return toast.error('Destination is required')
    if (!form.purpose.trim())     return toast.error('Purpose is required')
    if (!form.departure_date)     return toast.error('Departure date is required')
    if (!form.return_date)        return toast.error('Return date is required')
    if (form.return_date < form.departure_date) return toast.error('Return date must be after departure date')
    setSubmitting(true)
    try {
      await createTravelRequest({
        ...form,
        estimated_budget: parseFloat(form.estimated_budget) || 0,
      })
      toast.success('Travel request submitted')
      setShowModal(false)
      setForm(EMPTY_FORM)
      fetchRequests()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this travel request?')) return
    try {
      await cancelTravelRequest(id)
      toast.success('Request cancelled')
      fetchRequests()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel request')
    }
  }

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: BRAND_GRADIENT }}>
            <Plane size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Travel Requests</h1>
            <p className="text-xs text-gray-500">Submit and track your travel requests</p>
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
          <Plane size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No travel requests yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "New Request" to submit your first travel request</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{req.destination}</span>
                    <span className={`text-dense px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[req.status] || STATUS_STYLES.pending}`}>
                      {req.status}
                    </span>
                    {view === 'all' && req.employee_name && (
                      <span className="text-dense text-gray-400">· {req.employee_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{req.purpose}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {req.departure_date} → {req.return_date}
                    </span>
                    {req.travel_mode && (
                      <span className="flex items-center gap-1">
                        <Plane size={12} /> {req.travel_mode}
                      </span>
                    )}
                    {req.estimated_budget > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} /> ₹{req.estimated_budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {req.rejection_reason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {req.rejection_reason}</p>
                  )}
                </div>
                {view === 'mine' && req.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all shrink-0"
                  >
                    Cancel
                  </button>
                )}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">New Travel Request</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destination *</label>
                <input
                  value={form.destination}
                  onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                  placeholder="e.g., Mumbai, India"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose *</label>
                <textarea
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="Describe the purpose of your travel"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Departure Date *</label>
                  <input type="date" value={form.departure_date}
                    onChange={e => setForm(f => ({ ...f, departure_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Return Date *</label>
                  <input type="date" value={form.return_date}
                    onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
                    min={form.departure_date}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Travel Mode</label>
                  <select value={form.travel_mode}
                    onChange={e => setForm(f => ({ ...f, travel_mode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                    <option value="">Select mode</option>
                    {TRAVEL_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Budget (₹)</label>
                  <input type="number" min="0" value={form.estimated_budget}
                    onChange={e => setForm(f => ({ ...f, estimated_budget: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="accommodation" checked={form.accommodation_required}
                  onChange={e => setForm(f => ({ ...f, accommodation_required: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <label htmlFor="accommodation" className="text-sm text-gray-600">Accommodation required</label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
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
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  )
}
