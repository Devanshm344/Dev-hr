import React, { useState, useEffect, useCallback } from 'react'
import { BookOpen, Search, Download, AlertCircle, Loader2, FileText, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPolicies, downloadPolicy } from '../services/api'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'

const CATEGORY_LABELS = {
  policy:    'Policy',
  handbook:  'Handbook',
  sop:       'SOP',
  hr_manual: 'HR Manual',
  other:     'Other',
}

const CATEGORY_COLORS = {
  policy:    'bg-primary-50 text-primary-600 border-primary-200',
  handbook:  'bg-secondary-50 text-secondary-600 border-secondary-200',
  sop:       'bg-blue-50 text-blue-600 border-blue-200',
  hr_manual: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  other:     'bg-gray-50 text-gray-600 border-gray-200',
}

export default function EmployeePolicyPage() {
  const [policies, setPolicies]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('')
  const [downloading, setDownloading] = useState(null)

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getPolicies({ search: search || undefined, category: category || undefined })
      setPolicies(res.data)
    } catch {
      setError('Failed to load policies')
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    const timer = setTimeout(() => fetchPolicies(), 300)
    return () => clearTimeout(timer)
  }, [fetchPolicies])

  const handleDownload = async (policy) => {
    if (!policy.file_path) return toast.error('No document attached')
    setDownloading(policy.id)
    try {
      const res = await downloadPolicy(policy.id)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = policy.file_name || `policy-${policy.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download document')
    } finally {
      setDownloading(null)
    }
  }

  const categories = Object.keys(CATEGORY_LABELS)

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: BRAND_GRADIENT }}>
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
          <p className="text-xs text-gray-500">Company policies, handbooks, and guidelines</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search policies..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          />
        </div>
        <select value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle size={18} /> <span className="text-sm">{error}</span>
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No policies found</p>
          <p className="text-gray-400 text-sm mt-1">
            {search || category ? 'Try adjusting your search or filter' : 'No policies have been published yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy) => (
            <div key={policy.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{policy.title}</p>
                  {policy.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{policy.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-dense px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[policy.category] || CATEGORY_COLORS.other}`}>
                  {CATEGORY_LABELS[policy.category] || policy.category}
                </span>
                {policy.file_path && (
                  <button
                    onClick={() => handleDownload(policy)}
                    disabled={downloading === policy.id}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-all disabled:opacity-60"
                  >
                    {downloading === policy.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Download size={12} />}
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}
