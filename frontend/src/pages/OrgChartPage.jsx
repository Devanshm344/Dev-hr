import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Network, Users, ZoomIn, ZoomOut, ChevronDown, ChevronRight, Search, X, Pencil } from 'lucide-react';
import { getOrgChart } from '../services/api';
import Container from '../components/ui/Container';
import { primary, secondary, rgba } from '../theme/colors';


// ── Helpers ───────────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(' ');

function countDescendants(node) {
  let total = node.children.length;
  for (const c of node.children) total += countDescendants(c);
  return total;
}

function buildTree(flat) {
  const map = {};
  flat.forEach(n => (map[n.id] = { ...n, children: [] }));
  const trueRoots = [];
  const orphans = [];
  flat.forEach(n => {
    if (!n.manager_id) trueRoots.push(map[n.id]);
    else if (map[n.manager_id]) map[n.manager_id].children.push(map[n.id]);
    else orphans.push(map[n.id]);
  });
  trueRoots.sort((a, b) => countDescendants(b) - countDescendants(a));
  const ceo = trueRoots[0];
  // only attach orphans (manager_id set but manager is inactive/missing) under CEO
  if (ceo) orphans.forEach(o => ceo.children.push(o));
  return ceo ? [ceo] : [];
}

function deptName(dept) {
  if (!dept) return null;
  if (typeof dept === 'string') return dept;
  return dept.name || dept.label || null;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ORG_CSS = `
.org-ul {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  padding: 24px 0 0 0;
  position: relative;
  list-style: none;
  margin: 0;
}
.org-ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-1px);
  border-left: 2px solid #d1d5db;
  height: 24px;
}
.dark .org-ul::before { border-color: #374151; }

.org-li {
  padding: 24px 12px 0;
  position: relative;
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.org-li::before {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  left: 0;
  height: 24px;
  border-top: 2px solid #d1d5db;
}
.org-li::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  right: 0;
  height: 24px;
  border-top: 2px solid #d1d5db;
  border-left: 2px solid #d1d5db;
}
.dark .org-li::before, .dark .org-li::after { border-color: #374151; }

.org-li:only-child::before,
.org-li:only-child::after { display: none; }
.org-li:only-child { padding-top: 0; }

.org-li:first-child::before { border-top: none; }

.org-li:last-child::after { border: none; }
.org-li:last-child::before {
  border-right: 2px solid #d1d5db;
  border-radius: 0 4px 0 0;
}
.dark .org-li:last-child::before { border-right-color: #374151; }
.org-li:first-child:not(:only-child)::after { border-radius: 4px 0 0 0; }

@keyframes org-dropdown-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
.org-dropdown {
  animation: org-dropdown-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes org-result-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
.org-result-item {
  animation: org-result-in 0.15s ease forwards;
  animation-fill-mode: both;
}
@keyframes org-card-select {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0px  ${rgba(primary[400], 0.8)}; }
  30%  { transform: scale(1.07); box-shadow: 0 0 0 14px ${rgba(primary[400], 0.25)}; }
  55%  { transform: scale(0.97); }
  80%  { transform: scale(1.02); }
  100% { transform: scale(1);    box-shadow: 0 0 0 4px  ${rgba(primary[400], 0.18)}; }
}
.org-card-pulse {
  animation: org-card-select 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
`;

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CFG = {
  super_admin: {
    gradient: 'from-primary-600 to-primary-800',
    badge: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
    border: 'border-primary-300 dark:border-primary-700',
    label: 'Super Admin',
  },
  hr_admin: {
    gradient: 'from-secondary-500 to-secondary-600',
    badge: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-600/30 dark:text-secondary-100',
    border: 'border-secondary-200 dark:border-secondary-600',
    label: 'HR Admin',
  },
  manager: {
    gradient: 'from-amber-500 to-orange-600',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-700',
    label: 'Manager',
  },
  employee: {
    gradient: 'from-slate-500 to-gray-600',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
    label: 'Employee',
  },
};

// ── OrgAvatarImg ─────────────────────────────────────────────────────────────
function OrgAvatarImg({ src, alt }) {
  const [imgError, setImgError] = useState(false);
  if (!src || imgError) return null;
  return (
    <img
      src={src}
      alt={alt}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
      onError={() => setImgError(true)}
    />
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 36 }) {
  return (
    <div className="flex flex-col items-center justify-center p-16 gap-4">
      <svg viewBox="0 0 50 50" className="animate-spin" style={{ width: size, height: size }}>
        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4"
          className="text-gray-100 dark:text-gray-800" strokeDasharray="125.66" />
        <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" strokeLinecap="round"
          style={{ stroke: 'url(#sg)', strokeDasharray: '75 50.66' }} />
        <defs>
          <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primary[600]} />
            <stop offset="100%" stopColor={secondary[400]} />
          </linearGradient>
        </defs>
      </svg>
      <p className="text-sm text-gray-400 dark:text-gray-500 font-medium animate-pulse">Loading…</p>
    </div>
  );
}

// ── OrgCard ───────────────────────────────────────────────────────────────────
function OrgCard({ node, searchTerm, selectedId, registerRef }) {
  const cfg = ROLE_CFG[node.role] || ROLE_CFG.employee;
  const isSelected = node.id === selectedId;
  const isMatch = !isSelected && searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  return (
    <div
      ref={el => registerRef(node.id, el)}
      className={cn(
        'flex flex-col items-center bg-white dark:bg-gray-800 border-2 rounded-2xl shadow-md',
        'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-default group w-48 p-4',
        cfg.border,
        isMatch && 'ring-2 ring-primary-400 dark:ring-primary-500 shadow-lg',
        isSelected && 'ring-4 ring-primary-400 dark:ring-primary-500 shadow-xl org-card-pulse',
      )}
    >
      <div className={cn(
        'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
        'text-white font-bold text-base mb-3 shadow-lg relative overflow-hidden',
        'group-hover:scale-110 transition-transform duration-200',
        cfg.gradient,
      )}>
        {node.avatar_initials}
        <OrgAvatarImg src={node.profile_picture} alt={node.name} />
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-white text-center leading-tight">{node.name}</p>
      <p className="text-dense text-gray-400 dark:text-gray-500 text-center mt-0.5 leading-tight line-clamp-2">{node.job_title || '—'}</p>
      {node.email && (
        <p className="text-dense-tight text-gray-400 dark:text-gray-600 text-center mt-0.5 truncate w-full">{node.email}</p>
      )}
      {node.department && (
        <span className="text-dense-tight px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold mt-1.5">
          {deptName(node.department)}
        </span>
      )}
      <span className={cn('text-dense-tight px-2 py-0.5 rounded-full mt-1 font-semibold', cfg.badge)}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── CollapseBtn ───────────────────────────────────────────────────────────────
function CollapseBtn({ collapsed, setCollapsed, count }) {
  return (
    <button
      onClick={() => setCollapsed(c => !c)}
      className="mt-1 flex items-center gap-1 text-dense-tight text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors px-2 py-0.5 rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/20"
    >
      {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {collapsed ? `${count} reports` : 'collapse'}
    </button>
  );
}

// ── OrgTreeChild ──────────────────────────────────────────────────────────────
function OrgTreeChild({ node, searchTerm, selectedId, expandIds, registerRef }) {
  const [collapsed, setCollapsed] = useState(true);
  const hasKids = node.children?.length > 0;

  useEffect(() => {
    if (expandIds.has(node.id)) setCollapsed(false);
  }, [expandIds, node.id]);

  return (
    <li className="org-li">
      <div className="flex flex-col items-center">
        <OrgCard node={node} searchTerm={searchTerm} selectedId={selectedId} registerRef={registerRef} />
        {hasKids && <CollapseBtn collapsed={collapsed} setCollapsed={setCollapsed} count={node.children.length} />}
      </div>
      {hasKids && !collapsed && (
        <ul className="org-ul">
          {node.children.map(child => (
            <OrgTreeChild
              key={child.id}
              node={child}
              searchTerm={searchTerm}
              selectedId={selectedId}
              expandIds={expandIds}
              registerRef={registerRef}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── RootNode ──────────────────────────────────────────────────────────────────
function RootNode({ node, searchTerm, selectedId, expandIds, registerRef }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasKids = node.children?.length > 0;
  return (
    <div className="flex flex-col items-center">
      <OrgCard node={node} searchTerm={searchTerm} selectedId={selectedId} registerRef={registerRef} />
      {hasKids && <CollapseBtn collapsed={collapsed} setCollapsed={setCollapsed} count={node.children.length} />}
      {hasKids && !collapsed && (
        <ul className="org-ul">
          {node.children.map(child => (
            <OrgTreeChild
              key={child.id}
              node={child}
              searchTerm={searchTerm}
              selectedId={selectedId}
              expandIds={expandIds}
              registerRef={registerRef}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── SearchDropdown ────────────────────────────────────────────────────────────
function SearchDropdown({ results, flatById, onSelect }) {
  if (!results.length) return null;
  return (
    <div className="org-dropdown absolute top-full left-0 mt-2 w-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
      <p className="text-dense-tight font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-4 pt-3 pb-1">
        {results.length} result{results.length !== 1 ? 's' : ''}
      </p>
      {results.map((emp, i) => {
        const cfg = ROLE_CFG[emp.role] || ROLE_CFG.employee;
        const manager = emp.manager_id ? flatById[emp.manager_id] : null;
        const mcfg = manager ? (ROLE_CFG[manager.role] || ROLE_CFG.employee) : null;
        return (
          <div
            key={emp.id}
            className="org-result-item px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-b-0 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 cursor-pointer transition-colors"
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => onSelect(emp)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl bg-gradient-to-br flex-shrink-0 shadow-sm relative overflow-hidden',
                'flex items-center justify-center text-white font-bold text-sm',
                cfg.gradient,
              )}>
                {emp.avatar_initials}
                <OrgAvatarImg src={emp.profile_picture} alt={emp.name} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{emp.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{emp.job_title || '—'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {emp.employee_id && (
                  <span className="text-dense-tight font-mono text-gray-300 dark:text-gray-600">{emp.employee_id}</span>
                )}
                <span className={cn('text-dense-tight px-2 py-0.5 rounded-full font-semibold', cfg.badge)}>
                  {cfg.label}
                </span>
              </div>
            </div>
            {manager ? (
              <div className="mt-2 flex items-center gap-2 pl-1">
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-3 flex-shrink-0" />
                <div className={cn(
                  'w-6 h-6 rounded-lg bg-gradient-to-br flex-shrink-0 relative overflow-hidden',
                  'flex items-center justify-center text-white font-bold text-dense-tight shadow-sm',
                  mcfg.gradient,
                )}>
                  {manager.avatar_initials}
                  <OrgAvatarImg src={manager.profile_picture} alt={manager.name} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  <span className="text-gray-400">Reports to </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{manager.name}</span>
                  {manager.job_title && (
                    <span className="text-gray-300 dark:text-gray-600"> · {manager.job_title}</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-1 pl-14 text-dense-tight text-gray-300 dark:text-gray-600 italic">No reporting manager</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── OrgChartPage ──────────────────────────────────────────────────────────────
export default function OrgChartPage() {
  const [nodes, setNodes] = useState([]);
  const [flat, setFlat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const hasFitted = useRef(false);
  const cardRefs = useRef({});

  useEffect(() => {
    getOrgChart()
      .then(res => {
        const data = res.data;
        setFlat(data);
        setNodes(buildTree(data));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const flatById = useMemo(() => {
    const m = {};
    flat.forEach(e => { m[e.id] = e; });
    return m;
  }, [flat]);

  const expandIds = useMemo(() => {
    if (!selectedId) return new Set();
    const s = new Set();
    let cur = flatById[selectedId];
    while (cur?.manager_id) {
      s.add(cur.manager_id);
      cur = flatById[cur.manager_id];
    }
    return s;
  }, [selectedId, flatById]);

  const registerCardRef = useCallback((id, el) => {
    if (el) cardRefs.current[id] = el;
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      const el = cardRefs.current[selectedId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedId]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const t = searchTerm.toLowerCase();
    return flat.filter(e =>
      e.name.toLowerCase().includes(t) ||
      String(e.employee_id || '').toLowerCase().includes(t)
    ).slice(0, 8);
  }, [searchTerm, flat]);

  useEffect(() => {
    if (!nodes.length || hasFitted.current) return;
    hasFitted.current = true;
    requestAnimationFrame(() => {
      if (!wrapperRef.current) return;
      const avail = wrapperRef.current.clientWidth;
      const content = wrapperRef.current.scrollWidth;
      if (content > avail) {
        setZoom(Math.max(40, Math.floor((avail / content) * 95)));
      }
    });
  }, [nodes]);

  const deptCount = new Set(flat.map(n => deptName(n.department)).filter(Boolean)).size;
  const managerCount = flat.filter(n => ['manager', 'hr_admin', 'super_admin'].includes(n.role)).length;
  const mainRoot = nodes[0] ?? null;

  return (
    <Container>
      <style>{ORG_CSS}</style>

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-600 to-secondary-500 dark:from-primary-800 dark:to-secondary-600 rounded-2xl relative overflow-hidden shadow-xl px-8 pt-8 pb-6">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">HR Module</p>
            <h1 className="text-2xl font-bold text-white">Organization Chart</h1>
            <p className="text-white/70 text-sm mt-1">{flat.length} employees across {deptCount} departments</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Employees',   value: flat.length,   Icon: Users },
              { label: 'Departments', value: deptCount,     Icon: Network },
              { label: 'Managers',    value: managerCount,  Icon: ChevronDown },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[80px]">
                <Icon className="w-4 h-4 text-white/60 mb-1.5" />
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-dense-tight text-white/70 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 px-8 py-3 shadow-sm flex items-center justify-between flex-wrap gap-3">
        {/* Search */}
        <div ref={searchRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); setSelectedId(null); }}
            onFocus={() => searchTerm && setShowDropdown(true)}
            placeholder="Search by name or ID..."
            className="pl-9 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 w-64"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedId(null); setShowDropdown(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {showDropdown && (
            <SearchDropdown
              results={searchResults}
              flatById={flatById}
              onSelect={emp => {
                setSearchTerm(emp.name);
                setShowDropdown(false);
                setSelectedId(null);
                requestAnimationFrame(() => setSelectedId(emp.id));
              }}
            />
          )}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Legend</span>
          {Object.entries(ROLE_CFG).map(([, cfg]) => (
            <div key={cfg.label} className="flex items-center gap-1.5">
              <div className={cn('w-3.5 h-3.5 rounded-md bg-gradient-to-br shadow-sm', cfg.gradient)} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{cfg.label}</span>
            </div>
          ))}
        </div>
        {/* Zoom */}
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <ZoomOut className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono w-10 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(150, z + 10))}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <ZoomIn className="w-4 h-4 text-gray-500" />
          </button>
          <button
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => setZoom(100)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main hierarchy chart */}
      <div ref={wrapperRef} className="overflow-x-auto pb-6">
        <div style={{ zoom: `${zoom}%`, minWidth: 'max-content' }}>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : !mainRoot ? (
            <div className="text-center py-16 min-w-full">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No hierarchy data.</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Assign managers to employees to build the org chart.</p>
            </div>
          ) : (
            <RootNode
              node={mainRoot}
              searchTerm={searchTerm}
              selectedId={selectedId}
              expandIds={expandIds}
              registerRef={registerCardRef}
            />
          )}
        </div>
      </div>
    </Container>
  );
}
