import React, { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import { roleDisplayLabel } from '../../rbac/constants'

const EMPTY_FILTERS = {
  department_id: '', role: '', status: '', title: '', employment_type: '',
  manager_id: '', work_location: '', joined_after: '', joined_before: '',
}

export { EMPTY_FILTERS }

const FIELD_LABEL_CLS = 'text-table-head text-gray-500 block mb-1.5'

function FilterSelect({ label, value, onChange, placeholder, children }) {
  return (
    <div>
      <label className={FIELD_LABEL_CLS}>{label}</label>
      <select value={value} onChange={onChange} className="input">
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  )
}

function FilterDate({ label, value, onChange }) {
  return (
    <div>
      <label className={FIELD_LABEL_CLS}>{label}</label>
      <input type="date" value={value} onChange={onChange} className="input" />
    </div>
  )
}

/**
 * Search bar + expandable "Filters" panel for the User Management table.
 * Search stays live (parent debounces it); the 9 secondary fields below are
 * staged in local `draft` state and only take effect on Apply, matching this
 * panel's explicit Reset/Apply affordance rather than filtering on every
 * keystroke/select change.
 */
export default function UserFilters({ search, onSearchChange, filters, onApply, options }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(filters)

  useEffect(() => { setDraft(filters) }, [filters])

  const activeCount = Object.values(filters).filter(Boolean).length
  const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }))

  const handleApply = () => { onApply(draft) }
  const handleReset = () => { setDraft(EMPTY_FILTERS); onApply(EMPTY_FILTERS) }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name, employee ID, email, phone, department, designation, role…"
            className="input pl-9"
          />
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className={clsx('btn-secondary text-sm rounded-full', expanded && 'bg-primary-50 border-primary-200 text-primary-700')}
        >
          <SlidersHorizontal size={14} />
          Filters{activeCount > 0 && <span className="ml-0.5 text-primary-600 font-semibold">({activeCount})</span>}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <>
          <div className="border-t border-dashed border-gray-200 mt-4 pt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            <FilterSelect label="Department" value={draft.department_id} onChange={e => setField('department_id', e.target.value)} placeholder="All">
              {(options?.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Designation" value={draft.title} onChange={e => setField('title', e.target.value)} placeholder="All">
              {(options?.designations || []).map(t => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
            <FilterSelect label="Role" value={draft.role} onChange={e => setField('role', e.target.value)} placeholder="All">
              {(options?.roles || []).map(r => <option key={r} value={r}>{roleDisplayLabel(r)}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={draft.status} onChange={e => setField('status', e.target.value)} placeholder="All">
              {(options?.statuses || []).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </FilterSelect>
            <FilterSelect label="Employment Type" value={draft.employment_type} onChange={e => setField('employment_type', e.target.value)} placeholder="All">
              {(options?.employmentTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
            <FilterSelect label="Reporting Manager" value={draft.manager_id} onChange={e => setField('manager_id', e.target.value)} placeholder="All">
              {(options?.managers || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Office Location" value={draft.work_location} onChange={e => setField('work_location', e.target.value)} placeholder="All">
              {(options?.workLocations || []).map(t => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
            <FilterDate label="Joined After" value={draft.joined_after} onChange={e => setField('joined_after', e.target.value)} />
            <FilterDate label="Joined Before" value={draft.joined_before} onChange={e => setField('joined_before', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
            <button onClick={handleReset} className="btn-secondary text-sm">Reset</button>
            <button onClick={handleApply} className="btn-primary text-sm">Apply</button>
          </div>
        </>
      )}
    </div>
  )
}
