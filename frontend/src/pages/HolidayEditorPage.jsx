import React, { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Upload, Trash2, Plus, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertTriangle, FileText, X } from 'lucide-react'
import Container from '../components/ui/Container'
import { ltGetHolidays, ltParseHolidayPdf, ltBulkApplyHolidays, ltDeleteHoliday, ltCreateHoliday } from '../services/api'

const REGIONS = [
  { key: 'India',          label: 'India',  sub: 'Hyderabad office' },
  { key: 'United States',  label: 'US',     sub: 'Austin office' },
  { key: 'Canada',         label: 'Canada', sub: 'Toronto office' },
]

const HOLIDAY_TYPE_COLORS = {
  public:     'bg-blue-50   text-blue-700   border border-blue-200',
  optional:   'bg-amber-50  text-amber-700  border border-amber-200',
  restricted: 'bg-orange-50 text-orange-700 border border-orange-200',
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center py-10 gap-2 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
        <FileText size={16} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 max-w-sm">{subtitle}</p>}
    </div>
  )
}

export default function HolidayEditorPage() {
  const [region, setRegion] = useState('India')
  const [year, setYear] = useState(new Date().getFullYear())
  const [current, setCurrent] = useState([])
  const [loadingCurrent, setLoadingCurrent] = useState(true)
  const [preview, setPreview] = useState(null)   // parsed rows pending review, null = no pending upload
  const [warnings, setWarnings] = useState([])
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', date: '', holiday_type: 'public' })
  const [adding, setAdding] = useState(false)
  const fileRef = useRef(null)

  const loadCurrent = useCallback(async () => {
    setLoadingCurrent(true)
    try {
      const res = await ltGetHolidays(year, region)
      setCurrent(res.data.holidays || [])
    } catch { toast.error('Failed to load current holidays') }
    finally { setLoadingCurrent(false) }
  }, [year, region])

  useEffect(() => { loadCurrent() }, [loadCurrent])

  // Switching tabs/year abandons any unapplied preview and the add form — both
  // were scoped to the previous region/year and would silently apply to the
  // wrong one otherwise.
  useEffect(() => { setPreview(null); setWarnings([]); setShowAdd(false) }, [region, year])

  const handleAddHoliday = async (e) => {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.date) return
    setAdding(true)
    try {
      await ltCreateHoliday({ ...addForm, name: addForm.name.trim(), region })
      toast.success('Holiday added')
      setAddForm({ name: '', date: '', holiday_type: 'public' })
      setShowAdd(false)
      loadCurrent()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add holiday')
    } finally { setAdding(false) }
  }

  const handleFilePicked = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }
    setParsing(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('year', year)
      const res = await ltParseHolidayPdf(fd)
      setPreview(res.data.rows.map((r, i) => ({ ...r, _key: i })))
      setWarnings(res.data.warnings || [])
      toast.success(`Read ${res.data.rows.length} holidays — review before applying`)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not read this PDF')
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const updateRow = (key, field, value) => {
    setPreview((rows) => rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
  }
  const removeRow = (key) => {
    setPreview((rows) => rows.filter((r) => r._key !== key))
  }
  const addRow = () => {
    setPreview((rows) => [
      ...(rows || []),
      { _key: Date.now(), name: '', date: `${year}-01-01`, holiday_type: 'public' },
    ])
  }

  const handleApply = async () => {
    if (!preview || preview.length === 0) return
    if (preview.some((r) => !r.name.trim() || !r.date)) {
      toast.error('Every row needs a name and a date')
      return
    }
    setApplying(true)
    try {
      const holidays = preview.map(({ name, date, holiday_type }) => ({ name: name.trim(), date, holiday_type }))
      await ltBulkApplyHolidays({ region, year, holidays })
      toast.success(`Applied — ${region} employees now see this ${year} calendar`)
      setPreview(null)
      setWarnings([])
      loadCurrent()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to apply holidays')
    } finally { setApplying(false) }
  }

  const handleDeleteCurrent = async (id) => {
    try {
      await ltDeleteHoliday(id)
      toast.success('Holiday removed')
      loadCurrent()
    } catch { toast.error('Failed to delete holiday') }
  }

  const activeMeta = REGIONS.find((r) => r.key === region)

  return (
    <Container>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Holiday Editor</h1>
          <p className="text-sm text-gray-500">Upload each office's official holiday PDF — parsed automatically, applied only after you review it</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <button onClick={() => setYear((y) => y - 1)} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={14} /></button>
          <span className="text-sm font-semibold text-gray-800 min-w-[3rem] text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="text-gray-400 hover:text-gray-600"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* ── Region tabs ── */}
      <div className="flex gap-2 border-b border-gray-100">
        {REGIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => setRegion(r.key)}
            className={clsx(
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              region === r.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400 hover:text-gray-600',
            )}
          >
            {r.label}
            <span className="block text-xs font-normal text-gray-400">{r.sub}</span>
          </button>
        ))}
      </div>

      {/* ── Upload zone ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Upload {activeMeta.label} holiday PDF for {year}</h3>
          {preview && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <AlertTriangle size={13} /> Unapplied — review below
            </span>
          )}
        </div>
        <label
          className={clsx(
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors',
            parsing ? 'border-primary-200 bg-primary-50/50' : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/30',
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={parsing}
            onChange={(e) => handleFilePicked(e.target.files?.[0])}
          />
          {parsing ? (
            <>
              <Loader2 size={22} className="text-primary-500 animate-spin" />
              <p className="text-sm text-gray-500">Reading PDF…</p>
            </>
          ) : (
            <>
              <Upload size={22} className="text-gray-300" />
              <p className="text-sm text-gray-500">Drop a PDF here or click to browse</p>
              <p className="text-xs text-gray-400">Parsed as a table — nothing is saved until you click Apply below</p>
            </>
          )}
        </label>

        {warnings.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview (pending review) ── */}
      {preview && (
        <div className="bg-primary-50/60 rounded-2xl border border-primary-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-primary-800">Review before applying — {preview.length} holidays</h3>
            <div className="flex items-center gap-2">
              <button onClick={addRow} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-primary-200 text-primary-700 bg-white rounded-lg hover:bg-primary-50">
                <Plus size={13} /> Add row
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {applying ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Apply to {activeMeta.label} employees
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
            {preview.map((row) => (
              <div key={row._key} className="flex items-center gap-2 px-3 py-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(row._key, 'name', e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Holiday name"
                />
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => updateRow(row._key, 'date', e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <select
                  value={row.holiday_type}
                  onChange={(e) => updateRow(row._key, 'holiday_type', e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="public">Public</option>
                  <option value="optional">Optional</option>
                  <option value="restricted">Restricted</option>
                </select>
                <button onClick={() => removeRow(row._key)} className="p-1.5 text-gray-300 hover:text-red-500" aria-label="Remove row">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-primary-600">Applying replaces {activeMeta.label}'s entire {year} calendar with exactly this list.</p>
        </div>
      )}

      {/* ── Currently applied ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Currently live for {activeMeta.label} employees — {year}</h3>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? 'Cancel' : 'Add Holiday'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAddHoliday} className="px-5 py-4 bg-primary-50/60 border-b border-primary-100 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[10rem]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Holiday title</label>
              <input
                type="text"
                autoFocus
                required
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Founder's Day"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={addForm.date}
                onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={addForm.holiday_type}
                onChange={(e) => setAddForm((f) => ({ ...f, holiday_type: e.target.value }))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="public">Public</option>
                <option value="optional">Optional</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
            </button>
          </form>
        )}

        {loadingCurrent ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="text-primary-500 animate-spin" /></div>
        ) : current.length === 0 ? (
          <EmptyState title={`No holidays set for ${activeMeta.label} in ${year}`} subtitle="Upload a PDF above to populate this office's calendar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Day</th>
                  <th className="px-5 py-2.5 font-medium">Holiday</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {current.map((h) => {
                  const d = new Date(h.date)
                  return (
                    <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap text-gray-800 font-medium">
                        {d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-400">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
                      </td>
                      <td className="px-5 py-3 text-gray-800">{h.name}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full capitalize', HOLIDAY_TYPE_COLORS[h.holiday_type] || HOLIDAY_TYPE_COLORS.public)}>
                          {h.holiday_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => handleDeleteCurrent(h.id)} className="p-1 text-gray-300 hover:text-red-500" aria-label="Delete holiday">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Container>
  )
}
