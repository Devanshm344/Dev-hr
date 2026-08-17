import React, { useEffect, useState } from 'react'
import { X, Loader2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { createShift, getDepartments } from '../../services/api'
import { primary, BRAND_GRADIENT } from '../../theme/colors'

const SHIFT_TYPES  = ['general', 'morning', 'evening', 'night', 'rotational']
const SHIFT_COLORS = [primary[600], '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#f43f5e']

const DAYS = [
  { key: 'sunday',    label: 'Sunday' },
  { key: 'monday',    label: 'Monday' },
  { key: 'tuesday',   label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday' },
  { key: 'friday',    label: 'Friday' },
  { key: 'saturday',  label: 'Saturday' },
]
const WEEK_COLS = [
  { key: 'all', label: 'All' },
  { key: '1',   label: '1st' },
  { key: '2',   label: '2nd' },
  { key: '3',   label: '3rd' },
  { key: '4',   label: '4th' },
  { key: '5',   label: '5th' },
]
const OCCURRENCE_KEYS = ['1', '2', '3', '4', '5']

function emptyWeekendDays() {
  const days = {}
  DAYS.forEach(d => {
    days[d.key] = { all: false, '1': false, '2': false, '3': false, '4': false, '5': false }
  })
  return days
}

const initialForm = {
  name: '',
  shift_type: 'general',
  color: primary[600],
  start_time: '09:00',
  end_time: '18:00',
  grace_period_minutes: 15,
  is_night_shift: false,
  description: '',
  shift_margin: false,
  core_working_hours: false,
  weekend_basis: 'location',
  provide_shift_allowance: false,
  eligibility_scope: 'all',
  eligibility_department_ids: [],
  half_working_day_half_weekend: false,
  define_statutory_weekends: false,
}

function Section({ title, description, first = false, children }) {
  return (
    <div className={clsx('px-6 py-5', !first && 'border-t border-gray-100')}>
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

const labelCls = 'block text-dense font-bold text-gray-400 uppercase tracking-wider mb-1.5'
const inputCls = 'w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all'
const checkboxCls = 'w-4 h-4 rounded text-primary-600 accent-primary-600 cursor-pointer'
const radioCls = 'w-4 h-4 text-primary-600 accent-primary-600 cursor-pointer'

export default function AddShiftForm({ onClose, onSuccess }) {
  const [form, setForm] = useState(initialForm)
  const [weekendDays, setWeekendDays] = useState(emptyWeekendDays)
  const [departments, setDepartments] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDepartments().then(r => setDepartments(r.data)).catch(() => {})
  }, [])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const toggleDeptEligibility = id => {
    setForm(f => {
      const has = f.eligibility_department_ids.includes(id)
      return {
        ...f,
        eligibility_department_ids: has
          ? f.eligibility_department_ids.filter(x => x !== id)
          : [...f.eligibility_department_ids, id],
      }
    })
  }

  const toggleWeekendCell = (dayKey, colKey) => {
    setWeekendDays(prev => {
      const day = { ...prev[dayKey] }
      if (colKey === 'all') {
        const next = !day.all
        OCCURRENCE_KEYS.forEach(k => { day[k] = next })
        day.all = next
      } else {
        day[colKey] = !day[colKey]
        day.all = OCCURRENCE_KEYS.every(k => day[k])
      }
      return { ...prev, [dayKey]: day }
    })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Shift name is required'); return }
    if (!form.start_time || !form.end_time) { toast.error('From and To time are required'); return }

    setSaving(true)
    try {
      const eligibility_criteria = form.eligibility_scope === 'all'
        ? { scope: 'all' }
        : { scope: 'department', department_ids: form.eligibility_department_ids }

      await createShift({
        name: form.name,
        shift_type: form.shift_type,
        start_time: form.start_time,
        end_time: form.end_time,
        color: form.color,
        description: form.description || null,
        grace_period_minutes: parseInt(form.grace_period_minutes) || 0,
        is_night_shift: form.is_night_shift,
        shift_margin: form.shift_margin,
        core_working_hours: form.core_working_hours,
        weekend_basis: form.weekend_basis,
        provide_shift_allowance: form.provide_shift_allowance,
        eligibility_criteria,
        weekend_days: weekendDays,
        half_working_day_half_weekend: form.half_working_day_half_weekend,
        define_statutory_weekends: form.define_statutory_weekends,
      })
      toast.success('Shift created!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save shift')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between flex-shrink-0 sticky top-0 z-10" style={{ background: BRAND_GRADIENT }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center"><Clock size={16} className="text-white" /></div>
          <div>
            <h2 className="text-sm font-bold text-white">Add Shift</h2>
            <p className="text-sky-200 text-xs">Define shift timing and properties</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={15} /></button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          {/* Section 1 — Basic Shift Information */}
          <Section title="Basic Shift Information" first>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Shift Name *</label>
                <input required type="text" className={inputCls} placeholder="e.g. Morning Shift"
                  value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Type *</label>
                <select required className={inputCls} value={form.shift_type} onChange={e => set('shift_type', e.target.value)}>
                  {SHIFT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>From *</label>
                <input required type="time" className={inputCls} value={form.start_time} onChange={e => set('start_time', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>To *</label>
                <input required type="time" className={inputCls} value={form.end_time} onChange={e => set('end_time', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Grace Period (min)</label>
                <input type="number" min="0" max="60" className={inputCls}
                  value={form.grace_period_minutes} onChange={e => set('grace_period_minutes', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="w-10 h-10 rounded-xl border border-gray-100 cursor-pointer bg-slate-50 p-1"
                    value={form.color} onChange={e => set('color', e.target.value)} />
                  <div className="flex flex-wrap gap-1.5">
                    {SHIFT_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => set('color', c)}
                        className={clsx('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110', form.color === c ? 'border-gray-800 scale-110' : 'border-transparent')}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={2} className={clsx(inputCls, 'resize-none')} placeholder="Optional description…"
                  value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input type="checkbox" id="night" className={checkboxCls} checked={form.is_night_shift}
                  onChange={e => set('is_night_shift', e.target.checked)} />
                <label htmlFor="night" className="text-sm text-gray-700 font-medium">Night shift (crosses midnight)</label>
              </div>
            </div>
          </Section>

          {/* Section 2 — Shift Configuration */}
          <Section title="Shift Configuration">
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className={clsx(checkboxCls, 'mt-0.5')} checked={form.shift_margin}
                  onChange={e => set('shift_margin', e.target.checked)} />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">Shift Margin</span>
                  <span className="block text-xs text-gray-500">Define boundaries within which payable hours will be calculated</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className={clsx(checkboxCls, 'mt-0.5')} checked={form.core_working_hours}
                  onChange={e => set('core_working_hours', e.target.checked)} />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">Core Working Hours</span>
                  <span className="block text-xs text-gray-500">Define the time frames during which employees in this shift are required to be present for work</span>
                </span>
              </label>
            </div>
          </Section>

          {/* Section 3 — Weekend Configuration */}
          <Section title="Weekend are based on">
            <div className="flex items-center gap-6">
              {[{ v: 'location', l: 'Location' }, { v: 'shift', l: 'Shift' }].map(opt => (
                <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="weekend_basis" className={radioCls} checked={form.weekend_basis === opt.v}
                    onChange={() => set('weekend_basis', opt.v)} />
                  <span className="text-sm text-gray-700 font-medium">{opt.l}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Section 4 — Shift Allowance */}
          <Section>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className={checkboxCls} checked={form.provide_shift_allowance}
                onChange={e => set('provide_shift_allowance', e.target.checked)} />
              <span className="text-sm font-semibold text-gray-800">Provide shift allowance</span>
            </label>
          </Section>

          {/* Section 5 — Eligibility Criteria */}
          <Section title="Eligibility criteria" description="Select the shift eligibility criteria. The shift must be assigned to eligible employees for the applicable period to take effect.">
            <div className="flex items-center gap-6 mb-3">
              {[{ v: 'all', l: 'All Employees' }, { v: 'department', l: 'Specific Departments' }].map(opt => (
                <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="eligibility_scope" className={radioCls} checked={form.eligibility_scope === opt.v}
                    onChange={() => set('eligibility_scope', opt.v)} />
                  <span className="text-sm text-gray-700 font-medium">{opt.l}</span>
                </label>
              ))}
            </div>
            {form.eligibility_scope === 'department' && (
              <div className="flex flex-wrap gap-2">
                {departments.length === 0 && <p className="text-xs text-gray-400">No departments found</p>}
                {departments.map(d => (
                  <label key={d.id} className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors',
                    form.eligibility_department_ids.includes(d.id)
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-gray-100 bg-slate-50 text-gray-600 hover:bg-gray-100'
                  )}>
                    <input type="checkbox" className="hidden" checked={form.eligibility_department_ids.includes(d.id)}
                      onChange={() => toggleDeptEligibility(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
            )}
          </Section>

          {/* Section 6 — Weekend Definition */}
          <Section title="Define Weekend Days">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input type="checkbox" className={checkboxCls} checked={form.half_working_day_half_weekend}
                onChange={e => set('half_working_day_half_weekend', e.target.checked)} />
              <span className="text-sm text-gray-700 font-medium">Half working day & half weekend</span>
            </label>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Day</th>
                    {WEEK_COLS.map(c => (
                      <th key={c.key} className="px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(d => (
                    <tr key={d.key} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-4 py-2 font-medium text-gray-700">{d.label}</td>
                      {WEEK_COLS.map(c => (
                        <td key={c.key} className="px-3 py-2 text-center">
                          <input type="checkbox" className={checkboxCls}
                            checked={weekendDays[d.key][c.key]}
                            onChange={() => toggleWeekendCell(d.key, c.key)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Section 7 — Statutory Weekend */}
          <Section>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className={checkboxCls} checked={form.define_statutory_weekends}
                onChange={e => set('define_statutory_weekends', e.target.checked)} />
              <span className="text-sm font-semibold text-gray-800">Define statutory weekends and track hours separately for payroll</span>
            </label>
          </Section>

          {/* Bottom actions — left aligned, part of the form itself */}
          <div className="px-6 py-5 border-t border-gray-100 flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-60"
              style={{ background: BRAND_GRADIENT }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>

          </div>
        </div>
      </form>
    </div>
  )
}
