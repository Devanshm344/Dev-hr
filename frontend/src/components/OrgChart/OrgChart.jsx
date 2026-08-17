import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { searchOrgChart, getOrgChain } from '../../services/api'
import { primary, secondary, rgba } from '../../theme/colors'
import { fontSizePx } from '../../theme/fonts'

// Brand tokens for this component — it renders everything via inline styles
// (not Tailwind classes), so these are the single named source the whole
// file draws from instead of scattering raw hex/rgb literals per line.
const BRAND        = primary[600]   // #0052CC
const BRAND_ACCENT = secondary[400] // #00B4FF
const BRAND_SOFT   = primary[400]   // lighter blue tint, used for subtle accents

// Same pattern for type: fontSizePx is the single source of truth (src/theme/fonts.js)
// for the app's 10/12/14/15/16px scale. CEO_TITLE_SIZE is the one deliberate
// exception — a large decorative heading, not part of the 3-tier UI text system.
const FONT = fontSizePx
const CEO_TITLE_SIZE = 32

function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// ─── HierarchyConnector ───────────────────────────────────────────────────────

const HierarchyConnector = memo(function HierarchyConnector({ delay }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: 40 }}>
      <div
        style={{
          width: 2,
          background: `linear-gradient(to bottom, ${rgba(BRAND, 0.4)}, ${rgba(BRAND, 0.08)})`,
          borderLeft: `2px dashed ${rgba(BRAND, 0.3)}`,
          height: 0,
          animation: 'drawLine 0.3s ease forwards',
          animationDelay: `${delay}ms`,
        }}
      />
    </div>
  )
})

// ─── EmployeeCard ─────────────────────────────────────────────────────────────
// Single reusable card for both the hierarchy chain and the reportees grid.
// Pass isReportee=true for the compact grid variant.

const EmployeeCard = memo(function EmployeeCard({
  emp,
  label,
  isSelected,
  isReportee,
  animationDelay,
  onClick,
}) {
  const isCEO = emp.isCEO === true
  const [imgError, setImgError] = useState(false)
  const clickable = typeof onClick === 'function' && (isReportee || !isSelected)

  const avatar = (emp.profile_picture && !imgError) ? (
    <>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{getInitials(emp.name)}</span>
      <img
        src={emp.profile_picture}
        alt={emp.name}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    </>
  ) : (
    getInitials(emp.name)
  )

  // ── Compact reportee card (grid layout) ─────────────────────────────────────
  if (isReportee) {
    return (
      <div
        className="card-animate"
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => onClick(emp) : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(emp) } } : undefined}
        style={{
          animationDelay: `${animationDelay}ms`,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: clickable ? 'pointer' : 'default',
          transition: clickable ? 'box-shadow 0.15s, transform 0.15s' : undefined,
        }}
        onMouseEnter={clickable ? (e) => { e.currentTarget.style.boxShadow = `0 4px 18px ${rgba(BRAND, 0.18)}`; e.currentTarget.style.transform = 'translateY(-1px)' } : undefined}
        onMouseLeave={clickable ? (e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)' } : undefined}
      >
        <div
          style={{
            position: 'relative', flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
            background: `linear-gradient(135deg, ${BRAND}, ${BRAND_ACCENT})`,
            color: '#ffffff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: FONT.sm,
            boxShadow: `0 2px 8px ${rgba(BRAND, 0.25)}`, overflow: 'hidden',
          }}
        >
          {avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: FONT.sm, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {emp.name}
            </span>
            <span style={{ flexShrink: 0, fontFamily: 'monospace', fontSize: FONT.xs, background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: 6 }}>
              #{emp.empId}
            </span>
          </div>
          <div style={{ fontSize: FONT.xs, color: BRAND, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {emp.designation || '—'}
          </div>
          <span style={{ fontSize: FONT.xs, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>
            {emp.department || '—'}
          </span>
        </div>
      </div>
    )
  }

  // ── Full-width hierarchy chain card ─────────────────────────────────────────
  const cardBg = isSelected
    ? `linear-gradient(135deg, ${primary[50]} 0%, ${secondary[50]} 100%)`
    : isCEO
    ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
    : '#ffffff'

  const cardBorder = isSelected
    ? `1.5px solid ${rgba(BRAND, 0.45)}`
    : isCEO
    ? '1.5px solid rgba(251,191,36,0.55)'
    : '1px solid #e2e8f0'

  const avatarBg = isSelected
    ? `linear-gradient(135deg, ${BRAND}, ${BRAND_SOFT})`
    : isCEO
    ? 'linear-gradient(135deg, #d97706, #fbbf24)'
    : `linear-gradient(135deg, ${BRAND}, ${BRAND_ACCENT})`

  const nameColor  = isSelected ? primary[800] : isCEO ? '#92400e' : '#1e293b'
  const desgColor  = isSelected ? BRAND        : isCEO ? '#b45309' : '#64748b'
  const deptBg     = isSelected ? rgba(BRAND, 0.1)  : isCEO ? 'rgba(251,191,36,0.15)' : '#f1f5f9'
  const deptColor  = isSelected ? BRAND             : isCEO ? '#92400e'               : '#475569'
  const badgeBg    = isSelected ? rgba(BRAND, 0.12) : isCEO ? 'rgba(251,191,36,0.2)'  : '#f1f5f9'
  const badgeColor = isSelected ? BRAND             : isCEO ? '#b45309'               : '#64748b'
  const headerBg   = isSelected ? rgba(BRAND, 0.08) : isCEO ? 'rgba(251,191,36,0.12)' : '#f8fafc'
  const labelColor = isSelected ? BRAND             : isCEO ? '#b45309'               : BRAND
  const labelBg    = isSelected ? rgba(BRAND, 0.1)  : isCEO ? 'rgba(251,191,36,0.15)' : rgba(BRAND, 0.08)

  const chainBoxShadow = isSelected
    ? `0 4px 20px ${rgba(BRAND, 0.15)}`
    : isCEO
    ? '0 4px 20px rgba(251,191,36,0.12)'
    : '0 2px 12px rgba(0,0,0,0.06)'

  return (
    <div
      className="card-animate"
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onClick(emp) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(emp) } } : undefined}
      style={{
        animationDelay: `${animationDelay}ms`,
        borderRadius: 16,
        overflow: 'hidden',
        background: cardBg,
        border: cardBorder,
        boxShadow: chainBoxShadow,
        cursor: clickable ? 'pointer' : 'default',
        transition: clickable ? 'box-shadow 0.15s, transform 0.15s' : undefined,
      }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.boxShadow = `0 6px 24px ${rgba(BRAND, 0.2)}`; e.currentTarget.style.transform = 'translateY(-1px)' } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.boxShadow = chainBoxShadow; e.currentTarget.style.transform = 'translateY(0)' } : undefined}
    >
      <div
        style={{
          background: headerBg, padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
        }}
      >
        <span
          style={{
            fontSize: FONT.dense, letterSpacing: '0.08em', color: labelColor,
            background: labelBg, padding: '2px 8px', borderRadius: 999,
            fontWeight: 600, textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: FONT.xs, background: badgeBg, color: badgeColor, padding: '2px 8px', borderRadius: 999 }}>
          #{emp.empId}
        </span>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            position: 'relative', flexShrink: 0, width: 48, height: 48, borderRadius: '50%',
            background: avatarBg, color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: FONT.sm, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: FONT.label, color: nameColor, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {emp.name}
          </div>
          <div style={{ fontSize: FONT.sm, color: desgColor, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {emp.designation || '—'}
          </div>
          <span style={{ fontSize: FONT.xs, background: deptBg, color: deptColor, padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>
            {emp.department || '—'}
          </span>
        </div>
      </div>
    </div>
  )
})

// ─── ManagerHierarchy ─────────────────────────────────────────────────────────
// Renders the full chain top-to-bottom: CEO → … → DirectManager → SelectedEmployee

const ManagerHierarchy = memo(function ManagerHierarchy({ managerChain, employee, onEmployeeClick }) {
  const allNodes = useMemo(() => [...managerChain, employee], [managerChain, employee])
  const total = allNodes.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {allNodes.map((node, i) => {
        const levelFromBottom = total - 1 - i
        let label
        if (levelFromBottom === 0) {
          label = 'Selected Employee'
        } else if (node.isCEO) {
          label = 'Top of the Organization'
        } else if (levelFromBottom === 1) {
          label = 'Direct Manager'
        } else {
          label = `L${levelFromBottom} Manager`
        }

        return (
          <div key={`${node.empId}-${i}`}>
            <EmployeeCard
              emp={node}
              label={label}
              isSelected={levelFromBottom === 0}
              animationDelay={i * 150}
              onClick={onEmployeeClick}
            />
            {i < total - 1 && <HierarchyConnector delay={(i + 1) * 150 - 40} />}
          </div>
        )
      })}
    </div>
  )
})

// ─── ReporteesSection ─────────────────────────────────────────────────────────

const ReporteesSection = memo(function ReporteesSection({ employeeName, reportees, onEmployeeClick }) {
  if (reportees.length === 0) return null

  return (
    <div>
      {/* Divider */}
      <div style={{ margin: '28px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${rgba(BRAND, 0.2)}, transparent)` }} />
        <span style={{ fontSize: FONT.xs, color: '#94a3b8', letterSpacing: '0.06em', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 600 }}>
          {reportees.length} direct report{reportees.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${rgba(BRAND, 0.2)}, transparent)` }} />
      </div>

      <div style={{ fontSize: FONT.sm, fontWeight: 600, color: '#475569', marginBottom: 16, textAlign: 'center' }}>
        People reporting to <span style={{ color: BRAND }}>{employeeName}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {reportees.map((r, i) => (
          <EmployeeCard
            key={r.empId}
            emp={r}
            isReportee
            animationDelay={i * 80}
            onClick={onEmployeeClick}
          />
        ))}
      </div>
    </div>
  )
})

// ─── SearchResultAvatar ───────────────────────────────────────────────────────

function SearchResultAvatar({ emp }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div style={{
      position: 'relative',
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${BRAND}, ${BRAND_ACCENT})`,
      color: '#ffffff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: FONT.xs,
      overflow: 'hidden',
    }}>
      {getInitials(emp.name)}
      {emp.profile_picture && !imgError && (
        <img
          src={emp.profile_picture}
          alt={emp.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}

// ─── EmployeeSearchBar ────────────────────────────────────────────────────────

function EmployeeSearchBar({ onSelect }) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState([])
  const [open, setOpen]               = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searching, setSearching]     = useState(false)
  const inputRef                      = useRef(null)
  const containerRef                  = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleChange = async (e) => {
    const val = e.target.value
    setQuery(val)
    setActiveIndex(-1)
    if (val.trim().length < 1) { setResults([]); setOpen(false); return }
    setOpen(true)
    setSearching(true)
    try {
      const res = await searchOrgChart(val.trim())
      setResults(res.data || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelect = useCallback((emp) => {
    setQuery('')
    setResults([])
    setOpen(false)
    setActiveIndex(-1)
    onSelect(emp)
  }, [onSelect])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) handleSelect(results[activeIndex])
      else if (results.length === 1) handleSelect(results[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const showNoResult = query.trim().length > 0 && !searching && results.length === 0 && open

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 560, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 16, padding: '12px 16px',
          background: '#ffffff',
          border: open ? `1.5px solid ${rgba(BRAND, 0.55)}` : '1.5px solid #e2e8f0',
          boxShadow: open ? `0 0 0 3px ${rgba(BRAND, 0.1)}` : '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'all 0.15s',
        }}
      >
        {searching ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: BRAND, animation: 'spin 1s linear infinite' }}>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28 10" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: '#94a3b8' }}>
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && setOpen(true)}
          placeholder="Search by Employee ID or Name…"
          autoComplete="off"
          spellCheck="false"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: FONT.label, color: '#1e293b', caretColor: BRAND,
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="dropdown-fade"
          style={{
            position: 'absolute', zIndex: 100, left: 0, right: 0, marginTop: 8,
            borderRadius: 16, overflow: 'hidden',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
          }}
        >
          {results.map((emp, i) => (
            <button
              key={emp.id}
              onMouseDown={() => handleSelect(emp)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                width: '100%', textAlign: 'left',
                background: activeIndex === i ? rgba(BRAND, 0.06) : 'transparent',
                border: 'none',
                borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
                padding: '11px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'background 0.1s',
              }}
            >
              <SearchResultAvatar emp={emp} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: FONT.sm, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</span>
                  <span style={{ flexShrink: 0, fontSize: FONT.xs, fontFamily: 'monospace', background: '#f1f5f9', color: '#64748b', padding: '1px 7px', borderRadius: 6 }}>
                    {emp.empId}
                  </span>
                </div>
                <div style={{ fontSize: FONT.xs, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                  {emp.designation} <span style={{ color: '#cbd5e1' }}>·</span> {emp.department}
                </div>
              </div>
              {activeIndex === i && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: BRAND }}>
                  <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {showNoResult && (
        <div
          className="dropdown-fade"
          style={{
            position: 'absolute', zIndex: 100, left: 0, right: 0, marginTop: 8,
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
            padding: '28px 16px', textAlign: 'center',
          }}
        >
          <div style={{ color: '#64748b', fontSize: FONT.sm }}>
            No employee found for <span style={{ color: '#1e293b', fontWeight: 500 }}>"{query}"</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: FONT.xs, marginTop: 4 }}>Try a different ID or name.</div>
        </div>
      )}
    </div>
  )
}

// ─── ChainDisplay ─────────────────────────────────────────────────────────────

function ChainDisplay({ data, onReset, onEmployeeClick }) {
  const { employee, managerChain, reportees } = data
  const totalLevels = managerChain.length + 1

  return (
    <div style={{ width: '100%', maxWidth: 860, margin: '0 auto' }}>
      {/* Header row: level count + reset button */}
      <div
        style={{
          maxWidth: 520, margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: FONT.sm, color: '#64748b' }}>
          Reporting chain &middot;{' '}
          <span style={{ color: BRAND, fontWeight: 500 }}>
            {totalLevels} level{totalLevels !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onReset}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 12, fontSize: FONT.sm, fontWeight: 500,
            background: rgba(BRAND, 0.08), border: `1px solid ${rgba(BRAND, 0.25)}`,
            color: BRAND, cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = rgba(BRAND, 0.15) }}
          onMouseLeave={e => { e.currentTarget.style.background = rgba(BRAND, 0.08) }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1L1 6.5M1 6.5L6.5 12M1 6.5H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Search Again
        </button>
      </div>

      {/* Hierarchy chain — centered narrow column */}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <ManagerHierarchy managerChain={managerChain} employee={employee} onEmployeeClick={onEmployeeClick} />
      </div>

      {/* Reportees grid — expands to full container width */}
      <ReporteesSection employeeName={employee.name} reportees={reportees} onEmployeeClick={onEmployeeClick} />
    </div>
  )
}

// ─── OrgChart (main) ──────────────────────────────────────────────────────────

export default function OrgChart({ interactive = false }) {
  const [orgData, setOrgData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && orgData) setOrgData(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [orgData])

  const handleSelect = useCallback(async (searchResult) => {
    setLoading(true)
    setOrgData(null)
    try {
      const res = await getOrgChain(searchResult.id)
      setOrgData(res.data)
    } catch {
      // user can try again
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div style={{ margin: '-24px', minHeight: 'calc(100% + 48px)', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
      {/* Dot-grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `radial-gradient(${rgba(BRAND, 0.07)} 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
      }} />
      {/* Top glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(ellipse 80% 35% at 50% 0%, ${rgba(BRAND, 0.06)} 0%, transparent 70%)`,
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: 'calc(100% + 48px)' }}>
        <header style={{ padding: '48px 16px 28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <rect width="38" height="38" rx="10" fill={rgba(BRAND, 0.1)} stroke={rgba(BRAND, 0.2)} strokeWidth="1"/>
              <circle cx="19" cy="11" r="4.5" fill={BRAND_SOFT}/>
              <circle cx="11" cy="26" r="3.8" fill={BRAND}/>
              <circle cx="27" cy="26" r="3.8" fill={BRAND}/>
              <line x1="19" y1="15.5" x2="11" y2="22.2" stroke={BRAND} strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="19" y1="15.5" x2="27" y2="22.2" stroke={BRAND} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h1 style={{
              margin: 0, fontSize: CEO_TITLE_SIZE, fontWeight: 700, letterSpacing: '-0.03em',
              background: `linear-gradient(135deg, #1e293b 30%, ${BRAND})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              OrgChart Explorer
            </h1>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: FONT.sm }}>
            Search any employee to trace their complete reporting chain
          </p>
        </header>

        <main style={{ flex: 1, padding: '0 16px 64px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: `3px solid ${rgba(BRAND, 0.2)}`,
                borderTopColor: BRAND,
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : !orgData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <EmployeeSearchBar onSelect={handleSelect} />
            </div>
          ) : (
            <ChainDisplay
              data={orgData}
              onReset={() => setOrgData(null)}
              onEmployeeClick={interactive ? handleSelect : undefined}
            />
          )}
        </main>

        <footer style={{ textAlign: 'center', paddingBottom: 24, paddingTop: 8 }}>
          <p style={{ margin: 0, fontSize: FONT.xs, color: '#94a3b8' }}>
            TechDemocracy · Internal use only
          </p>
        </footer>
      </div>
    </div>
  )
}
