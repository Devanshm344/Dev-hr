import React, { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, X, AlertCircle, Loader2, Users, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMyInsurance, addInsuranceDependent, updateInsuranceDependent } from '../services/api'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'

const RELATIONS = ['spouse', 'child', 'parent', 'sibling']

const RELATION_LABELS = {
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  sibling: 'Sibling',
}

const EMPTY_DEP_FORM = { name: '', relation: '', date_of_birth: '' }

export default function InsurancePage() {
  const [insurance, setInsurance]     = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [showDepModal, setShowDepModal] = useState(false)
  const [editingDep, setEditingDep]   = useState(null)
  const [depForm, setDepForm]         = useState(EMPTY_DEP_FORM)
  const [submitting, setSubmitting]   = useState(false)

  const fetchInsurance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMyInsurance()
      setInsurance(res.data)
    } catch {
      setError('Failed to load insurance information')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInsurance() }, [fetchInsurance])

  const openAddDependent = () => {
    setEditingDep(null)
    setDepForm(EMPTY_DEP_FORM)
    setShowDepModal(true)
  }

  const openEditDependent = (dep) => {
    setEditingDep(dep)
    setDepForm({ name: dep.name, relation: dep.relation, date_of_birth: dep.date_of_birth || '' })
    setShowDepModal(true)
  }

  const handleDepSubmit = async (e) => {
    e.preventDefault()
    if (!depForm.name.trim()) return toast.error('Name is required')
    if (!depForm.relation)    return toast.error('Relation is required')
    if (!insurance)           return toast.error('No insurance record found')
    setSubmitting(true)
    try {
      if (editingDep) {
        await updateInsuranceDependent(insurance.id, editingDep.id, depForm)
        toast.success('Dependent updated')
      } else {
        await addInsuranceDependent(insurance.id, depForm)
        toast.success('Dependent added')
      }
      setShowDepModal(false)
      fetchInsurance()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save dependent')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
        <AlertCircle size={18} /> <span className="text-sm">{error}</span>
      </div>
    )
  }

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: BRAND_GRADIENT }}>
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance</h1>
          <p className="text-xs text-gray-500">Your health insurance details and dependents</p>
        </div>
      </div>

      {!insurance ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Shield size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No insurance details found</p>
          <p className="text-gray-400 text-sm mt-1">Contact HR to set up your insurance coverage</p>
        </div>
      ) : (
        <>
          {/* Insurance Details Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Policy Details</h2>
              {insurance.is_active && (
                <span className="text-dense px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium ml-auto">
                  Active
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Provider', value: insurance.provider },
                { label: 'Plan Name', value: insurance.plan_name },
                { label: 'Policy Number', value: insurance.policy_number },
                { label: 'Coverage Amount', value: insurance.coverage_amount ? `₹${Number(insurance.coverage_amount).toLocaleString()}` : null },
                { label: 'Start Date', value: insurance.start_date },
                { label: 'End Date', value: insurance.end_date },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">{value}</p>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Dependents */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary-500" />
                <h2 className="font-semibold text-gray-900">Dependents</h2>
                <span className="text-xs text-gray-400">({insurance.dependents?.length || 0})</span>
              </div>
              <button
                onClick={openAddDependent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 transition-all"
              >
                <Plus size={13} /> Add Dependent
              </button>
            </div>

            {insurance.dependents?.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No dependents added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {insurance.dependents.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{dep.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        <span className="capitalize">{RELATION_LABELS[dep.relation] || dep.relation}</span>
                        {dep.date_of_birth && (
                          <span className="flex items-center gap-1"><Calendar size={11} /> {dep.date_of_birth}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openEditDependent(dep)}
                      className="text-xs text-primary-500 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-all"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dependent Modal */}
      {showDepModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editingDep ? 'Edit Dependent' : 'Add Dependent'}</h2>
              <button onClick={() => setShowDepModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDepSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                <input value={depForm.name}
                  onChange={e => setDepForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Dependent's full name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Relation *</label>
                <select value={depForm.relation}
                  onChange={e => setDepForm(f => ({ ...f, relation: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  required>
                  <option value="">Select relation</option>
                  {RELATIONS.map(r => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
                <input type="date" value={depForm.date_of_birth}
                  onChange={e => setDepForm(f => ({ ...f, date_of_birth: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDepModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: BRAND_GRADIENT }}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                  {editingDep ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  )
}
