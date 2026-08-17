import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

/**
 * Searchable dropdown for selecting a Reporting Manager.
 *
 * Props:
 *   employees  – array of { id, employee_id, full_name, designation }
 *   value      – currently selected employee id (number | null)
 *   onChange   – (id: number|null, fullName: string) => void
 *   disabled   – optional boolean
 */
export default function ManagerSearchDropdown({ employees = [], value, onChange, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selected = value ? employees.find(e => e.id === value) : null

  const filtered = employees.filter(e => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.employee_id || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q)
    )
  })

  const handleSelect = (emp) => {
    onChange(emp ? emp.id : null, emp ? emp.full_name : '')
    setQuery('')
    setOpen(false)
  }

  const displayValue = open ? query : (selected ? `${selected.full_name}${selected.employee_id ? ` (${selected.employee_id})` : ''}` : '')

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="input pr-8"
          placeholder={open ? 'Search by name, ID or designation...' : (selected ? '' : 'Search by name, ID or designation...')}
          value={displayValue}
          disabled={disabled}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
        />
        {selected && !open ? (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(null) }}
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        )}
      </div>

      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          <div
            className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer border-b border-gray-100 italic"
            onMouseDown={() => handleSelect(null)}
          >
            — No Manager (top-level)
          </div>
          {filtered.slice(0, 100).map(e => (
            <div
              key={e.id}
              className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-primary-50 transition-colors ${selected?.id === e.id ? 'bg-primary-50' : ''}`}
              onMouseDown={() => handleSelect(e)}
            >
              <span className="font-medium text-gray-900">{e.full_name}</span>
              {e.employee_id && <span className="text-gray-400 ml-1.5 font-mono text-xs">({e.employee_id})</span>}
              {e.designation && (
                <span className="text-gray-400 ml-1.5 text-xs">· {e.designation}</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">No employees found</div>
          )}
        </div>
      )}
    </div>
  )
}
