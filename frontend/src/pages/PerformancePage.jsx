import React, { useEffect, useState } from 'react'
import { getMyReviews, getTeamReviews, getAllReviews, createReview, getEmployees } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import { Plus, X, Star, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'

const StarRating = ({ value, label }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </div>
    <span className="text-xs font-medium text-gray-700">{value}/5</span>
  </div>
)

const RatingInput = ({ label, value, onChange }) => (
  <div>
    <label className="label">{label} (1-5)</label>
    <input type="number" min="1" max="5" step="0.5" required className="input" value={value} onChange={e => onChange(e.target.value)} />
  </div>
)

const STATUS_BADGE = {
  completed: { label: 'Completed', className: 'badge-green' },
  self_review: { label: 'Self-Review (pending manager review)', className: 'badge-blue' },
}

const StatusBadge = ({ status }) => {
  const s = STATUS_BADGE[status]
  return s ? <span className={s.className}>{s.label}</span> : null
}

export default function PerformancePage() {
  const { user } = useAuthStore()
  const [reviews, setReviews] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [teamInfo, setTeamInfo] = useState({ is_manager: false, direct_reports: [] })
  const [view, setView] = useState('my') // 'my' | 'team' — only meaningful for non-admins
  const [form, setForm] = useState({ employee_id: '', review_period: '', review_type: 'quarterly', goals_rating: 3, skills_rating: 3, behavior_rating: 3, strengths: '', improvements: '', goals_next_period: '' })

  const isAdmin = isAdminRole(user)
  const isTeamView = !isAdmin && view === 'team'

  useEffect(() => { loadData() }, [view])

  const loadData = async () => {
    setLoading(true)
    try {
      if (isAdmin) {
        const [reviewsRes, empRes] = await Promise.all([getAllReviews(), getEmployees({ limit: 100 })])
        setReviews(reviewsRes.data)
        setEmployees(empRes.data.employees)
      } else if (view === 'team') {
        const res = await getTeamReviews()
        setTeamInfo(res.data)
        setReviews(res.data.reviews)
      } else {
        const [myRes, teamRes] = await Promise.all([getMyReviews(), getTeamReviews()])
        setReviews(myRes.data)
        setTeamInfo(teamRes.data)
      }
    } catch {} finally { setLoading(false) }
  }

  const openAdd = () => {
    setForm(f => ({ ...f, employee_id: isTeamView || isAdmin ? '' : String(user.id) }))
    setShowAdd(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, employee_id: parseInt(form.employee_id), goals_rating: parseFloat(form.goals_rating), skills_rating: parseFloat(form.skills_rating), behavior_rating: parseFloat(form.behavior_rating) }
      await createReview(payload)
      toast.success(isAdmin || isTeamView ? 'Review submitted!' : 'Self-review submitted!')
      setShowAdd(false)
      loadData()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') } finally { setSaving(false) }
  }

  const overall = (r) => ((r.goals_rating + r.skills_rating + r.behavior_rating) / 3).toFixed(1)
  const overallColor = (v) => v >= 4 ? 'text-green-600' : v >= 3 ? 'text-blue-600' : 'text-orange-600'

  const addLabel = isAdmin ? 'Add Review' : isTeamView ? 'Review Direct Report' : 'Submit Self-Review'
  const employeeOptions = isAdmin ? employees.map(e => ({ id: e.id, name: e.name })) : teamInfo.direct_reports

  return (
    <Container>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500">Review cycles and performance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {!isAdmin && teamInfo.is_manager && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              {[{ value: 'my', label: 'My Reviews' }, { value: 'team', label: 'Team Reviews' }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setView(opt.value)}
                  className={clsx('px-3 py-1.5 transition-colors', view === opt.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {(isAdmin || !isTeamView || teamInfo.direct_reports.length > 0) && (
            <button onClick={openAdd} className="btn-primary"><Plus size={16} /> {addLabel}</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary-600" /></div>
      ) : reviews.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No performance reviews yet</div>
      ) : (
        <div className="grid gap-4">
          {reviews.map(r => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(isAdmin || isTeamView) && <span className="font-semibold text-gray-900">{r.employee_name}</span>}
                    <span className="badge-blue">{r.review_period}</span>
                    <span className="badge-gray capitalize">{r.review_type}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Reviewed by {r.reviewer_name} · {new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Overall Rating</p>
                  <p className={clsx('text-2xl font-black', overallColor(parseFloat(overall(r))))}>
                    {overall(r)}<span className="text-sm font-normal text-gray-400">/5</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <StarRating value={r.goals_rating} label="Goals" />
                <StarRating value={r.skills_rating} label="Skills" />
                <StarRating value={r.behavior_rating} label="Behavior" />
              </div>
              {(r.strengths || r.improvements) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                  {r.strengths && <div><p className="text-xs font-semibold text-gray-500 mb-1">Strengths</p><p className="text-gray-700">{r.strengths}</p></div>}
                  {r.improvements && <div><p className="text-xs font-semibold text-gray-500 mb-1">Areas to Improve</p><p className="text-gray-700">{r.improvements}</p></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{isAdmin || isTeamView ? 'New Performance Review' : 'Submit Self-Review'}</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {(isAdmin || isTeamView) && (
                <div>
                  <label className="label">Employee *</label>
                  <select required className="input" value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})}>
                    <option value="">Select Employee</option>
                    {employeeOptions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Review Period *</label>
                  <input required className="input" placeholder="e.g. Q1 2025" value={form.review_period} onChange={e => setForm({...form, review_period: e.target.value})} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.review_type} onChange={e => setForm({...form, review_type: e.target.value})}>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="probation">Probation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RatingInput label="Goals Rating" value={form.goals_rating} onChange={v => setForm({...form, goals_rating: v})} />
                <RatingInput label="Skills Rating" value={form.skills_rating} onChange={v => setForm({...form, skills_rating: v})} />
                <RatingInput label="Behavior" value={form.behavior_rating} onChange={v => setForm({...form, behavior_rating: v})} />
              </div>
              <div><label className="label">Strengths</label><textarea className="input" rows={2} value={form.strengths} onChange={e => setForm({...form, strengths: e.target.value})} /></div>
              <div><label className="label">Areas to Improve</label><textarea className="input" rows={2} value={form.improvements} onChange={e => setForm({...form, improvements: e.target.value})} /></div>
              <div><label className="label">Goals for Next Period</label><textarea className="input" rows={2} value={form.goals_next_period} onChange={e => setForm({...form, goals_next_period: e.target.value})} /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null} {isAdmin || isTeamView ? 'Submit Review' : 'Submit Self-Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  )
}
