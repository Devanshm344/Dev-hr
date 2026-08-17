import React, { useEffect, useState } from 'react'
import {
  getAssetStats, getAssetCategories, getRecentAssetAssignments,
  getAssets, getAsset, createAsset, assignAsset, returnAsset,
  maintenanceAsset, retireAsset, deleteAsset, getEmployees, getEmployeeAssets,
} from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import {
  Laptop, Smartphone, CreditCard, Monitor, Car, Package,
  Wrench, CheckCircle, XCircle, AlertCircle, Plus, Search,
  ChevronRight, Clock, ArrowLeft, RefreshCw, Loader2, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'

// ── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICON = {
  laptop: Laptop,
  mobile_phone: Smartphone,
  access_card: CreditCard,
  monitor: Monitor,
  vehicle: Car,
  furniture: Package,
  other: Package,
}

const CATEGORY_COLOR = {
  laptop: 'text-primary-600 bg-primary-50',
  mobile_phone: 'text-emerald-600 bg-emerald-50',
  access_card: 'text-secondary-600 bg-secondary-50',
  monitor: 'text-amber-600 bg-amber-50',
  vehicle: 'text-rose-600 bg-rose-50',
  furniture: 'text-slate-600 bg-slate-100',
  other: 'text-gray-600 bg-gray-100',
}

const CATEGORY_BAR = {
  laptop: 'bg-primary-600',
  mobile_phone: 'bg-emerald-500',
  access_card: 'bg-secondary-400',
  monitor: 'bg-amber-500',
  vehicle: 'bg-rose-500',
  furniture: 'bg-slate-400',
  other: 'bg-gray-400',
}

const STATUS_BADGE = {
  assigned: 'bg-green-100 text-green-700',
  available: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired: 'bg-gray-100 text-gray-500',
}

const EVENT_CONFIG = {
  purchased: { label: 'Purchased & added to inventory', color: 'bg-green-500', icon: CheckCircle },
  assigned: { label: 'Assigned', color: 'bg-primary-600', icon: CheckCircle },
  returned: { label: 'Asset returned', color: 'bg-rose-400', icon: ArrowLeft },
  maintenance_sent: { label: 'Sent for maintenance', color: 'bg-amber-400', icon: Wrench },
  maintenance_returned: { label: 'Returned from maintenance', color: 'bg-teal-500', icon: CheckCircle },
  retired: { label: 'Retired / disposed', color: 'bg-gray-400', icon: XCircle },
}

function Avatar({ initials, size = 'sm' }) {
  const colors = ['bg-primary-600', 'bg-emerald-500', 'bg-secondary-400', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500']
  const idx = initials ? initials.charCodeAt(0) % colors.length : 0
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <span className={clsx('rounded-full flex items-center justify-center font-semibold text-white shrink-0', colors[idx], sz)}>
      {initials || '—'}
    </span>
  )
}

function StatCard({ value, label, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col gap-1">
      <span className={clsx('text-3xl font-bold tabular-nums', color)}>{value ?? '–'}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

function CategoryBar({ label, count, maxCount, colorClass }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-32 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className={clsx('h-2.5 rounded-full', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-700 w-8 text-right">{count}</span>
    </div>
  )
}

// ── Add Asset modal ───────────────────────────────────────────────────────────

function AddAssetModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', category: 'laptop', serial_number: '',
    purchase_date: '', purchase_cost: '', vendor: '', warranty_expiry: '', notes: '',
  })
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEmployees({ limit: 300 }).then(r => setEmployees(r.data.employees || []))
  }, [])

  const filteredEmployees = empSearch.trim()
    ? employees.filter(e =>
        `${e.name} ${e.title || ''} ${e.department || ''}`.toLowerCase().includes(empSearch.toLowerCase())
      )
    : employees

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!employeeId) return toast.error('Please select an employee to assign this asset')
    setSaving(true)
    try {
      const payload = { ...form }
      payload.purchase_cost = parseFloat(payload.purchase_cost)
      const created = await createAsset(payload)
      await assignAsset(created.data.id, {
        employee_id: parseInt(employeeId),
        event_date: form.purchase_date || new Date().toISOString().split('T')[0],
        notes: 'Assigned at the time of asset creation',
      })
      toast.success('Asset added and assigned successfully')
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add asset')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Add New Asset</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Asset Name *</label>
            <input className="input" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Dell XPS 15" />
          </div>
          <div>
            <label className="label">Category *</label>
            <select className="input" required value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="laptop">Laptop</option>
              <option value="mobile_phone">Mobile Phone</option>
              <option value="access_card">Access Card</option>
              <option value="monitor">Monitor</option>
              <option value="vehicle">Vehicle</option>
              <option value="furniture">Furniture</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Serial Number *</label>
              <input className="input" required value={form.serial_number}
                onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                placeholder="SN-XXXX" />
            </div>
            <div>
              <label className="label">Purchase Cost (₹) *</label>
              <input className="input" type="number" required min="0" value={form.purchase_cost}
                onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))}
                placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Purchase Date *</label>
              <input className="input" type="date" required value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Vendor *</label>
              <input className="input" required value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                placeholder="Dell India" />
            </div>
          </div>
          <div>
            <label className="label">Warranty Expiry Date *</label>
            <input className="input" type="date" required value={form.warranty_expiry}
              onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))} />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <label className="label">Assign to Employee *</label>
            <input
              className="input mb-2"
              placeholder="Search by name, title or department…"
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
            />
            <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">— Select an employee —</option>
              {filteredEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.title ? ` · ${emp.title}` : ''}{emp.department ? ` (${emp.department})` : ''}
                </option>
              ))}
            </select>
            {employeeId && (
              <p className="text-xs text-primary-600 mt-1">
                Asset will be marked <strong>Assigned</strong> after creation.
              </p>
            )}
          </div>

          <div>
            <label className="label">Notes *</label>
            <textarea className="input resize-none" required rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Add & Assign Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({ asset, onClose, onDone }) {
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEmployees({ limit: 200 }).then(r => setEmployees(r.data.employees))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!employeeId) return toast.error('Select an employee')
    setSaving(true)
    try {
      await assignAsset(asset.id, { employee_id: parseInt(employeeId), event_date: eventDate, notes })
      toast.success(`${asset.name} assigned successfully`)
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign asset')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Assign {asset.asset_code}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Assign to Employee *</label>
            <select className="input" value={employeeId}
              onChange={e => setEmployeeId(e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.title})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assignment Date</label>
            <input className="input" type="date" value={eventDate}
              onChange={e => setEventDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Asset Lifecycle panel ─────────────────────────────────────────────────────

function LifecyclePanel({ assetId, onClose, onDeleted, isAdmin }) {
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [returning, setReturning] = useState(false)
  const [sendingMaint, setSendingMaint] = useState(false)
  const [returningFromMaint, setReturningFromMaint] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAsset(assetId)
      setAsset(res.data)
    } catch { toast.error('Failed to load asset') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [assetId])

  const handleReturn = async () => {
    setReturning(true)
    try {
      await returnAsset(assetId, { event_date: new Date().toISOString().split('T')[0], notes: 'Asset returned' })
      toast.success('Asset marked as returned')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to return asset')
    } finally { setReturning(false) }
  }

  const handleMaintenance = async () => {
    setSendingMaint(true)
    try {
      await maintenanceAsset(assetId, { event_date: new Date().toISOString().split('T')[0], notes: 'Sent for maintenance' })
      toast.success('Asset marked as under maintenance')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally { setSendingMaint(false) }
  }

  const handleRetire = async () => {
    if (!confirm('Retire this asset permanently?')) return
    try {
      await retireAsset(assetId)
      toast.success('Asset retired')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const handleReturnFromMaintenance = async () => {
    setReturningFromMaint(true)
    try {
      await maintenanceAsset(assetId, {
        event_date: new Date().toISOString().split('T')[0],
        notes: 'Returned from maintenance',
        return_from_maintenance: true,
      })
      toast.success('Asset returned from maintenance')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally { setReturningFromMaint(false) }
  }

  const handleDelete = async () => {
    if (!confirm('Permanently delete this asset and all its history? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteAsset(assetId)
      toast.success('Asset deleted')
      onDeleted?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete asset')
    } finally { setDeleting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
    </div>
  )
  if (!asset) return null

  const CatIcon = CATEGORY_ICON[asset.category] || Package
  const lifecycle = asset.lifecycle || []

  return (
    <div className="space-y-5">
      {/* top bar */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', CATEGORY_COLOR[asset.category] || 'bg-gray-100 text-gray-500')}>
          <CatIcon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 text-sm">{asset.name}</h2>
          <p className="text-xs text-gray-400">{asset.asset_code} · {asset.serial_number || 'No SN'}</p>
        </div>
        <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium capitalize', STATUS_BADGE[asset.status] || 'bg-gray-100 text-gray-500')}>
          {asset.status}
        </span>
      </div>

      {/* info row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 mb-0.5">Purchase cost</p>
          <p className="font-semibold text-gray-800">
            {asset.purchase_cost ? `₹${asset.purchase_cost.toLocaleString('en-IN')}` : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 mb-0.5">Vendor</p>
          <p className="font-semibold text-gray-800">{asset.vendor || '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 mb-0.5">Warranty until</p>
          <p className="font-semibold text-gray-800">{asset.warranty_expiry || '—'}</p>
        </div>
      </div>

      {/* current holder */}
      {asset.current_employee && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
          <Avatar initials={asset.current_employee_initials} />
          <div>
            <p className="text-sm font-medium text-gray-800">{asset.current_employee}</p>
            <p className="text-xs text-gray-500">Current holder</p>
          </div>
        </div>
      )}

      {/* action buttons */}
      <div className="flex flex-wrap gap-2">
        {asset.status !== 'retired' && (
          <>
            {asset.status === 'available' && (
              <button onClick={() => setShowAssign(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700">
                <Plus className="w-3.5 h-3.5" /> Assign
              </button>
            )}
            {asset.status === 'assigned' && (
              <button onClick={handleReturn} disabled={returning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-60">
                {returning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                Mark Returned
              </button>
            )}
            {asset.status === 'maintenance' ? (
              <button onClick={handleReturnFromMaintenance} disabled={returningFromMaint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-60">
                {returningFromMaint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Return from Maintenance
              </button>
            ) : (
              <button onClick={handleMaintenance} disabled={sendingMaint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-60">
                {sendingMaint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                Send to Maintenance
              </button>
            )}
            <button onClick={handleRetire}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-300">
              <XCircle className="w-3.5 h-3.5" /> Retire
            </button>
          </>
        )}
        {isAdmin && (
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 disabled:opacity-60 ml-auto">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Delete Asset
          </button>
        )}
      </div>

      {/* lifecycle timeline */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lifecycle History</h3>
        <div className="space-y-0">
          {lifecycle.map((ev, i) => {
            const cfg = EVENT_CONFIG[ev.event_type] || { label: ev.event_type, color: 'bg-gray-400' }
            const isLast = i === lifecycle.length - 1
            return (
              <div key={ev.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={clsx('w-3 h-3 rounded-full mt-1 shrink-0', cfg.color)} />
                  {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                </div>
                <div className={clsx('pb-4', isLast && 'pb-0')}>
                  <p className="text-sm font-medium text-gray-800">{cfg.label}</p>
                  <p className="text-xs text-gray-400">
                    {ev.event_date}
                    {ev.employee ? ` · ${ev.employee}` : ''}
                    {ev.notes ? ` · ${ev.notes}` : ''}
                  </p>
                </div>
              </div>
            )
          })}
          {lifecycle.length === 0 && (
            <p className="text-sm text-gray-400 italic">No lifecycle events recorded.</p>
          )}
        </div>
      </div>

      {showAssign && (
        <AssignModal asset={asset} onClose={() => setShowAssign(false)} onDone={load} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { user } = useAuthStore()
  const isAdmin = isAdminRole(user)

  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [recent, setRecent] = useState([])
  const [assets, setAssets] = useState([])
  const [totalAssets, setTotalAssets] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [view, setView] = useState('overview') // 'overview' | 'list' | 'lifecycle'
  const [empSearch, setEmpSearch] = useState('')
  const [empResults, setEmpResults] = useState(null) // null = untouched, [] = no results
  const [empLoading, setEmpLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [sRes, cRes, rRes, aRes] = await Promise.all([
        getAssetStats(),
        getAssetCategories(),
        getRecentAssetAssignments(8),
        getAssets({ limit: 50, search, category: catFilter, status: statusFilter }),
      ])
      setStats(sRes.data)
      setCategories(cRes.data)
      setRecent(rRes.data)
      setAssets(aRes.data.assets)
      setTotalAssets(aRes.data.total)
    } catch { toast.error('Failed to load asset data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, catFilter, statusFilter])

  useEffect(() => {
    if (empSearch.trim().length < 2) { setEmpResults(null); return }
    const timer = setTimeout(async () => {
      setEmpLoading(true)
      try {
        const res = await getEmployeeAssets(empSearch.trim())
        setEmpResults(res.data)
      } catch { toast.error('Employee search failed') }
      finally { setEmpLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [empSearch])

  const maxCatCount = categories.length > 0 ? Math.max(...categories.map(c => c.count)) : 1

  const openLifecycle = (id) => {
    setSelectedAssetId(id)
    setView('lifecycle')
  }

  const RECENT_EVENT_LABEL = {
    assigned: 'Assigned',
    returned: 'Returned',
    purchased: 'Added to inventory',
    maintenance_sent: 'Sent for repair',
    maintenance_returned: 'Back from maintenance',
    retired: 'Retired',
  }

  const KEY_FEATURES = [
    { icon: Package, title: 'Asset registry with categories', desc: 'Track laptops, phones, access cards, furniture, vehicles — each with serial number, purchase date, vendor, cost, and warranty expiry.' },
    { icon: CheckCircle, title: 'Onboarding auto-assignment', desc: 'Link to the onboarding module — when a new employee joins, trigger asset requests (laptop, ID card, SIM) as a checklist automatically.' },
    { icon: CreditCard, title: 'Digital acknowledgement', desc: 'Employee signs a digital receipt on asset handover. Stored as a PDF against the employee and asset record.' },
    { icon: ArrowLeft, title: 'Exit return checklist', desc: 'Auto-generate a return list on employee offboarding. Block full & final settlement until all assets are marked returned or written off.' },
    { icon: Wrench, title: 'Maintenance tracking', desc: 'Log repairs, AMC schedules, and warranty claims. Get alerts before warranty expiry.' },
    { icon: Monitor, title: 'Depreciation & cost reports', desc: 'Auto-calculate asset depreciation (SLM / WDV methods), total asset value per department, and cost-per-employee reports.' },
  ]

  return (
    <Container>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track, assign, and manage all company assets across their full lifecycle</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh">
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          )}
        </div>
      </div>

      {view === 'lifecycle' && selectedAssetId ? (
        /* ── Lifecycle detail view ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <LifecyclePanel
            assetId={selectedAssetId}
            onClose={() => setView('overview')}
            onDeleted={() => { setView('overview'); load() }}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        <>
          {/* ── Overview stats ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Asset Inventory Overview</h2>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard value={stats?.total} label="Total assets tracked" color="text-gray-900" />
                <StatCard value={stats?.assigned} label="Assigned to employees" color="text-primary-600" />
                <StatCard value={stats?.available} label="Available / in stock" color="text-emerald-600" />
                <StatCard value={stats?.maintenance} label="Under maintenance" color="text-amber-600" />
                <StatCard value={stats?.retired} label="Retired / disposed" color="text-gray-500" />
              </div>
            )}
          </section>

          {/* ── Category breakdown + Recent assignments ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Category bar chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Asset Categories — by count</h2>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-5 bg-gray-100 animate-pulse rounded" />)}
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No assets yet.</p>
              ) : (
                <div className="space-y-3">
                  {categories.map(c => (
                    <CategoryBar
                      key={c.category}
                      label={c.label}
                      count={c.count}
                      maxCount={maxCatCount}
                      colorClass={CATEGORY_BAR[c.category] || 'bg-gray-400'}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recent assignments */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Recent Asset Assignments</h2>
                <button onClick={() => setView('list')}
                  className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-xl" />)}
                </div>
              ) : recent.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No recent activity.</p>
              ) : (
                <div className="space-y-1">
                  {recent.map(r => {
                    const CatIcon = CATEGORY_ICON[r.asset_category] || Package
                    return (
                      <button key={r.id} onClick={() => openLifecycle(r.asset_id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', CATEGORY_COLOR[r.asset_category] || 'bg-gray-100 text-gray-500')}>
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {r.asset_name} · <span className="text-gray-400 font-normal">{r.asset_code}</span>
                          </p>
                          <p className="text-xs text-gray-400">
                            {RECENT_EVENT_LABEL[r.event_type] || r.event_type} {r.event_date}
                          </p>
                        </div>
                        {r.employee ? (
                          <Avatar initials={r.employee_initials} size="sm" />
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0', STATUS_BADGE[r.asset_status] || 'bg-gray-100 text-gray-500')}>
                          {r.asset_status}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Employee Asset Lookup ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Employee Asset Lookup</h2>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-300"
                  placeholder="Search by employee name…"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                />
                {empLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
              </div>
            </div>

            {empResults === null ? (
              <div className="p-5 text-center text-sm text-gray-400">
                Type at least 2 characters to find an employee's assets
              </div>
            ) : empResults.length === 0 ? (
              <div className="p-5 text-center text-sm text-gray-400">
                No employees found matching "{empSearch}"
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {empResults.map(emp => (
                  <div key={emp.employee_id} className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar initials={emp.employee_initials} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{emp.employee_name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {emp.title}{emp.department ? ` · ${emp.department}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {emp.asset_count} asset{emp.asset_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {emp.assets.length === 0 ? (
                      <p className="text-xs text-gray-300 pl-11 italic">No assets currently assigned</p>
                    ) : (
                      <div className="pl-11 flex flex-wrap gap-2">
                        {emp.assets.map(a => {
                          const CatIcon = CATEGORY_ICON[a.category] || Package
                          return (
                            <button
                              key={a.id}
                              onClick={() => openLifecycle(a.id)}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-100 hover:bg-gray-50 text-left transition-colors"
                            >
                              <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', CATEGORY_COLOR[a.category] || 'bg-gray-100 text-gray-500')}>
                                <CatIcon className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-700">{a.name}</p>
                                <p className="text-xs text-gray-400">{a.asset_code}</p>
                              </div>
                              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-500')}>
                                {a.status}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Full asset list ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-gray-400" />
                <input className="flex-1 text-sm outline-none placeholder:text-gray-300"
                  placeholder="Search assets by name or code…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select className="input py-1.5 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                  <option value="">All categories</option>
                  <option value="laptop">Laptops</option>
                  <option value="mobile_phone">Mobile Phones</option>
                  <option value="access_card">Access Cards</option>
                  <option value="monitor">Monitors</option>
                  <option value="vehicle">Vehicles</option>
                  <option value="furniture">Furniture</option>
                  <option value="other">Other</option>
                </select>
                <select className="input py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="available">Available</option>
                  <option value="assigned">Assigned</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />)}
              </div>
            ) : assets.length === 0 ? (
              <div className="p-10 text-center">
                <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No assets found. {isAdmin && 'Add your first asset above.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {assets.map(a => {
                  const CatIcon = CATEGORY_ICON[a.category] || Package
                  return (
                    <button key={a.id} onClick={() => openLifecycle(a.id)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 text-left transition-colors">
                      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', CATEGORY_COLOR[a.category] || 'bg-gray-100 text-gray-500')}>
                        <CatIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {a.name} <span className="text-gray-400 font-normal text-xs">{a.asset_code}</span>
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {a.serial_number || 'No SN'}
                          {a.vendor ? ` · ${a.vendor}` : ''}
                          {a.purchase_cost ? ` · ₹${a.purchase_cost.toLocaleString('en-IN')}` : ''}
                        </p>
                      </div>
                      {a.current_employee ? (
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                          <Avatar initials={a.current_employee_initials} size="sm" />
                          <span className="text-xs text-gray-600">{a.current_employee}</span>
                        </div>
                      ) : (
                        <span className="hidden sm:block text-xs text-gray-300">Unassigned</span>
                      )}
                      <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium capitalize shrink-0', STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-500')}>
                        {a.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}

            {totalAssets > 0 && (
              <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
                Showing {assets.length} of {totalAssets} assets
              </div>
            )}
          </div>

          {/* ── Key Features ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Key Features</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {KEY_FEATURES.map(f => {
                const Icon = f.icon
                return (
                  <div key={f.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-0.5">{f.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </Container>
  )
}
