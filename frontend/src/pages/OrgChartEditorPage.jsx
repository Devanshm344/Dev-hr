import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './OrgChartEditorPage.css'
import {
  getOrgChartEditorChart,
  getOrgChartEditorUnassigned,
  placeOrgChartEmployee,
  moveOrgChartEmployee,
  setOrgChartManager,
  removeOrgChartManager,
  removeFromOrgChart,
  addOrgChartEmployee,
  editOrgChartEmployee,
  getDepartments,
} from '../services/api'

const NODE_WIDTH = 230
const NODE_HEIGHT = 80

const LAYOUT_SIBLING_SPACING = 310
const LAYOUT_LEVEL_HEIGHT = 200
const LAYOUT_LEFT_MARGIN = 40
const LAYOUT_TOP_MARGIN = 60

// L5 = root (depth 0), L1 = most junior managers (depth 4). Depth >= ORG_TOP_LEVEL
// means individual contributors (no level badge) — this is a display convention,
// not tied to any specific company's data.
const ORG_TOP_LEVEL = 5
function levelLabel(depth) {
  return depth < ORG_TOP_LEVEL ? `L${ORG_TOP_LEVEL - depth}` : null
}

const LEVEL_COLORS = [
  { bg: '#FEFCE8', border: '#EAB308', text: '#A16207', dot: '#EAB308' },
  { bg: '#EEF2FF', border: '#6366F1', text: '#4338CA', dot: '#6366F1' },
  { bg: '#ECFEFF', border: '#22D3EE', text: '#0E7490', dot: '#22D3EE' },
  { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE', dot: '#A855F7' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', dot: '#22C55E' },
]
function levelColor(depth) {
  return LEVEL_COLORS[Math.min(depth, LEVEL_COLORS.length - 1)]
}

// Departments come from whatever is in the HRMS employee data — there's no
// fixed department list, so colors are derived deterministically from the
// department name instead of a hardcoded name -> color map.
const DEPT_PALETTE = [
  { bg: '#EEF2FF', border: '#6366F1', text: '#4338CA', dot: '#6366F1' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', dot: '#22C55E' },
  { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE', dot: '#A855F7' },
  { bg: '#FFF7ED', border: '#F97316', text: '#C2410C', dot: '#F97316' },
  { bg: '#F0F9FF', border: '#0EA5E9', text: '#0369A1', dot: '#0EA5E9' },
  { bg: '#F0FDFA', border: '#14B8A6', text: '#0F766E', dot: '#14B8A6' },
  { bg: '#FFF1F2', border: '#FB7185', text: '#BE123C', dot: '#FB7185' },
  { bg: '#ECFEFF', border: '#22D3EE', text: '#0E7490', dot: '#22D3EE' },
  { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309', dot: '#F59E0B' },
  { bg: '#ECFDF5', border: '#10B981', text: '#047857', dot: '#10B981' },
]
const DEFAULT_DEPT_COLOR = { bg: '#F8FAFC', border: '#94A3B8', text: '#475569', dot: '#94A3B8' }

function deptColor(department) {
  if (!department) return DEFAULT_DEPT_COLOR
  let hash = 0
  for (let i = 0; i < department.length; i++) hash = (hash * 31 + department.charCodeAt(i)) | 0
  return DEPT_PALETTE[Math.abs(hash) % DEPT_PALETTE.length]
}

function computeAutoLayout(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenOf = new Map(nodes.map((n) => [n.id, []]))
  const hasPlacedParent = new Set()

  nodes.forEach((n) => {
    if (n.reportingManagerId && byId.has(n.reportingManagerId)) {
      childrenOf.get(n.reportingManagerId).push(n.id)
      hasPlacedParent.add(n.id)
    }
  })
  childrenOf.forEach((arr) => arr.sort((a, b) => byId.get(a).name.localeCompare(byId.get(b).name)))

  const roots = nodes
    .filter((n) => !hasPlacedParent.has(n.id))
    .map((n) => n.id)
    .sort((a, b) => byId.get(a).name.localeCompare(byId.get(b).name))

  const positions = new Map()
  let nextSlot = 0

  function layout(id, depth) {
    const children = childrenOf.get(id) || []
    let slot
    if (children.length === 0) {
      slot = nextSlot
      nextSlot += 1
    } else {
      const childSlots = children.map((c) => layout(c, depth + 1))
      slot = (Math.min(...childSlots) + Math.max(...childSlots)) / 2
    }
    positions.set(id, {
      x: LAYOUT_LEFT_MARGIN + slot * LAYOUT_SIBLING_SPACING,
      y: LAYOUT_TOP_MARGIN + depth * LAYOUT_LEVEL_HEIGHT,
      depth,
    })
    return slot
  }

  roots.forEach((r) => layout(r, 0))
  return positions
}

function computeTreeInfo(nodes, edges) {
  const childrenMap = new Map(nodes.map((n) => [n.id, []]))
  const hasParent = new Set()

  edges.forEach((e) => {
    if (childrenMap.has(e.source) && childrenMap.has(e.target)) {
      childrenMap.get(e.source).push(e.target)
      hasParent.add(e.target)
    }
  })

  const depths = new Map()
  const visited = new Set()
  function assignDepth(id, d) {
    if (visited.has(id)) return
    visited.add(id)
    depths.set(id, d)
    for (const child of childrenMap.get(id) || []) assignDepth(child, d + 1)
  }
  nodes.filter((n) => !hasParent.has(n.id)).forEach((n) => assignDepth(n.id, 0))

  return { childrenMap, depths }
}

function computeVisibleIds(nodes, childrenMap, collapsedNodes) {
  const hasParentInMap = new Set()
  childrenMap.forEach((children) => children.forEach((c) => hasParentInMap.add(c)))

  const visibleIds = new Set()

  function visit(id, parentIsCollapsed) {
    if (parentIsCollapsed) return
    visibleIds.add(id)
    const thisCollapsed = collapsedNodes.has(id)
    for (const child of childrenMap.get(id) || []) visit(child, thisCollapsed)
  }

  nodes.filter((n) => !hasParentInMap.has(n.id)).forEach((n) => visit(n.id, false))
  return visibleIds
}

let toastSeq = 0

export default function OrgChartEditorPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [unassigned, setUnassigned] = useState([])

  const [collapsedNodes, setCollapsedNodes] = useState(new Set())
  const [undoStack, setUndoStack] = useState([])

  const [connectSourceId, setConnectSourceId] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)

  const [toasts, setToasts] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedId, setHighlightedId] = useState(null)

  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [departments, setDepartments] = useState([])

  const canvasRef = useRef(null)
  const dragInfo = useRef(null)
  const nodeRefs = useRef(new Map())
  const cardRefs = useRef(new Map())

  const { childrenMap, depths } = useMemo(() => computeTreeInfo(nodes, edges), [nodes, edges])

  const visibleNodeIds = useMemo(
    () => computeVisibleIds(nodes, childrenMap, collapsedNodes),
    [nodes, childrenMap, collapsedNodes]
  )

  const visibleNodes = useMemo(() => nodes.filter((n) => visibleNodeIds.has(n.id)), [nodes, visibleNodeIds])
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [edges, visibleNodeIds]
  )

  const showToast = useCallback((type, message) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  const loadAll = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    Promise.all([getOrgChartEditorChart(), getOrgChartEditorUnassigned()])
      .then(([chartRes, unassignedRes]) => {
        const chart = chartRes.data
        const unassignedList = unassignedRes.data
        const { childrenMap: cm, depths: dp } = computeTreeInfo(chart.nodes, chart.edges)
        const initialCollapsed = new Set()
        chart.nodes.forEach((n) => {
          const d = dp.get(n.id) ?? 0
          if (d >= 1 && (cm.get(n.id) || []).length > 0) initialCollapsed.add(n.id)
        })

        setNodes(chart.nodes)
        setEdges(chart.edges)
        setUnassigned(unassignedList)
        setCollapsedNodes(initialCollapsed)
        setUndoStack([])
        setLoading(false)
      })
      .catch((err) => {
        setLoadError(err.response?.data?.detail || err.message || 'Failed to reach the backend')
        setLoading(false)
      })
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    getDepartments()
      .then((res) => setDepartments(res.data.map((d) => d.name)))
      .catch(() => setDepartments([]))
  }, [])

  const handleSaveChanges = useCallback(() => {
    // Every action already writes straight to the employee records, so
    // there's nothing left to persist — this just clears the dirty
    // indicator and confirms to the user that nothing is pending.
    setSaving(true)
    setTimeout(() => {
      setIsDirty(false)
      setSaving(false)
      showToast('success', 'Changes saved')
    }, 200)
  }, [showToast])

  const cancelConnect = useCallback(() => {
    setConnectSourceId(null)
    setMousePos(null)
  }, [])

  const refreshChart = useCallback(() => {
    return Promise.all([getOrgChartEditorChart(), getOrgChartEditorUnassigned()]).then(([chartRes, unassignedRes]) => {
      setNodes(chartRes.data.nodes)
      setEdges(chartRes.data.edges)
      setUnassigned(unassignedRes.data)
    })
  }, [])

  // ── Undo ──────────────────────────────────────────────────────────────────
  // Each entry describes how to revert one action; kept lean (rather than a
  // full state snapshot) since actions write straight through to the real
  // employee records instead of an in-memory draft.
  const pushUndo = useCallback((entry) => {
    setUndoStack((prev) => [...prev.slice(-49), entry])
  }, [])

  const revertEntry = useCallback((entry) => {
    if (entry.type === 'place') {
      return removeFromOrgChart(entry.id)
    }
    if (entry.type === 'move') {
      return moveOrgChartEmployee(entry.id, entry.prevX, entry.prevY)
    }
    if (entry.type === 'manager') {
      return entry.prevManagerId
        ? setOrgChartManager(entry.id, entry.prevManagerId)
        : removeOrgChartManager(entry.id)
    }
    if (entry.type === 'remove') {
      return placeOrgChartEmployee(entry.id, entry.prevX, entry.prevY).then(() =>
        entry.prevManagerId ? setOrgChartManager(entry.id, entry.prevManagerId) : Promise.resolve()
      )
    }
    return Promise.resolve()
  }, [])

  const performUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const entry = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      revertEntry(entry)
        .then(() => { setIsDirty(true); return refreshChart() })
        .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not undo'))
      return next
    })
  }, [revertEntry, refreshChart, showToast])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const deleteSelectedEdge = useCallback(
    (edge) => {
      pushUndo({ type: 'manager', id: edge.target, prevManagerId: edge.source })
      removeOrgChartManager(edge.target)
        .then(() => {
          showToast('success', 'Reporting line deleted')
          setIsDirty(true)
          refreshChart()
        })
        .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not delete reporting line'))
    },
    [pushUndo, showToast, refreshChart]
  )

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        cancelConnect()
        setSelectedEdge(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge) {
        e.preventDefault()
        const edge = selectedEdge
        setSelectedEdge(null)
        deleteSelectedEdge(edge)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        performUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelConnect, selectedEdge, deleteSelectedEdge, performUndo])

  // ── Node dragging ─────────────────────────────────────────────────────────
  const handleNodeMouseDown = (e, node) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    dragInfo.current = {
      id: node.id,
      offsetX: e.clientX - rect.left - node.positionX,
      offsetY: e.clientY - rect.top - node.positionY,
      prevX: node.positionX,
      prevY: node.positionY,
      lastX: node.positionX,
      lastY: node.positionY,
    }
  }

  useEffect(() => {
    function onMouseMove(e) {
      if (connectSourceId && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
      if (dragInfo.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        let x = Math.max(0, e.clientX - rect.left - dragInfo.current.offsetX)
        let y = Math.max(0, e.clientY - rect.top - dragInfo.current.offsetY)
        dragInfo.current.lastX = x
        dragInfo.current.lastY = y
        const id = dragInfo.current.id
        setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, positionX: x, positionY: y } : n)))
      }
    }

    function onMouseUp() {
      if (dragInfo.current) {
        const { id, lastX, lastY, prevX, prevY } = dragInfo.current
        dragInfo.current = null
        if (lastX !== prevX || lastY !== prevY) {
          pushUndo({ type: 'move', id, prevX, prevY })
          setIsDirty(true)
          moveOrgChartEmployee(id, lastX, lastY).catch((err) => {
            showToast('error', err.response?.data?.detail || err.message || 'Failed to move employee')
            refreshChart()
          })
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [connectSourceId, showToast, refreshChart, pushUndo])

  // ── Connect mode ──────────────────────────────────────────────────────────
  const startConnect = (e, node) => {
    e.stopPropagation()
    setConnectSourceId(node.id)
  }

  const handleNodeClick = (e, node) => {
    if (!connectSourceId) return
    e.stopPropagation()
    if (node.id === connectSourceId) { cancelConnect(); return }
    const sourceId = connectSourceId
    cancelConnect()
    pushUndo({ type: 'manager', id: node.id, prevManagerId: node.reportingManagerId })
    setOrgChartManager(node.id, sourceId)
      .then(() => {
        showToast('success', 'Reporting line updated')
        setIsDirty(true)
        return refreshChart()
      })
      .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not set manager'))
  }

  const handleRemove = (e, node) => {
    e.stopPropagation()
    pushUndo({ type: 'remove', id: node.id, prevX: node.positionX, prevY: node.positionY, prevManagerId: node.reportingManagerId })
    removeFromOrgChart(node.id)
      .then(() => {
        showToast('success', `${node.name} removed from chart`)
        setIsDirty(true)
        refreshChart()
      })
      .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not remove employee'))
  }

  const handleCanvasClick = () => {
    if (connectSourceId) cancelConnect()
    if (selectedEdge) setSelectedEdge(null)
  }

  const handleEdgeClick = (e, edge) => {
    e.stopPropagation()
    setSelectedEdge({ source: edge.source, target: edge.target })
  }

  // ── Sidebar drag-and-drop to place ───────────────────────────────────────
  const handleCardDragStart = (e, employeeId) => {
    e.dataTransfer.setData('text/plain', employeeId)
  }

  const handleCanvasDragOver = (e) => { e.preventDefault() }

  const handleCanvasDrop = (e) => {
    e.preventDefault()
    const employeeId = e.dataTransfer.getData('text/plain')
    if (!employeeId || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, e.clientX - rect.left - NODE_WIDTH / 2)
    const y = Math.max(0, e.clientY - rect.top - NODE_HEIGHT / 2)
    pushUndo({ type: 'place', id: employeeId })
    placeOrgChartEmployee(employeeId, x, y)
      .then(() => {
        showToast('success', 'Employee placed on chart')
        setIsDirty(true)
        refreshChart()
      })
      .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not place employee'))
  }

  // ── Auto-arrange ──────────────────────────────────────────────────────────
  const handleAutoArrange = () => {
    if (nodes.length === 0) return
    const positions = computeAutoLayout(nodes)
    setNodes((prev) => prev.map((n) => {
      const p = positions.get(n.id)
      return p ? { ...n, positionX: p.x, positionY: p.y } : n
    }))
    setIsDirty(true)
    Promise.all(nodes.map((n) => {
      const p = positions.get(n.id)
      return p ? moveOrgChartEmployee(n.id, p.x, p.y) : Promise.resolve()
    }))
      .then(() => showToast('success', 'Chart organized by level'))
      .catch((err) => {
        showToast('error', err.response?.data?.detail || err.message || 'Could not auto-arrange chart')
        refreshChart()
      })
  }

  // ── Add employee ──────────────────────────────────────────────────────────
  const handleAddEmployee = (data) => {
    return addOrgChartEmployee(data)
      .then(() => {
        showToast('success', `${data.name} added`)
        setModalOpen(false)
        setIsDirty(true)
        return refreshChart()
      })
      .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not add employee'))
  }

  // ── Edit employee ─────────────────────────────────────────────────────────
  const handleEditEmployee = (data) => {
    return editOrgChartEmployee(editingEmployee.id, data)
      .then(() => {
        showToast('success', `${data.name} updated`)
        setEditingEmployee(null)
        setIsDirty(true)
        return refreshChart()
      })
      .catch((err) => showToast('error', err.response?.data?.detail || err.message || 'Could not update employee'))
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const searchQueryTrimmed = searchQuery.trim().toLowerCase()
  const searchResults = searchQueryTrimmed
    ? [...nodes, ...unassigned].filter((e) => e.name.toLowerCase().includes(searchQueryTrimmed)).slice(0, 8)
    : []

  const layoutPositions = useMemo(() => (nodes.length ? computeAutoLayout(nodes) : new Map()), [nodes])

  const handleSelectSearchResult = (emp) => {
    setSearchQuery('')
    setHighlightedId(emp.id)

    if (emp.inChart) {
      const nodesById = new Map(nodes.map((n) => [n.id, n]))
      setCollapsedNodes((prev) => {
        const next = new Set(prev)
        let current = emp.reportingManagerId
        const seen = new Set()
        while (current && !seen.has(current)) {
          seen.add(current)
          next.delete(current)
          current = nodesById.get(current)?.reportingManagerId
        }
        return next
      })
    }

    requestAnimationFrame(() => {
      const el = emp.inChart ? nodeRefs.current.get(emp.id) : cardRefs.current.get(emp.id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    })
    setTimeout(() => setHighlightedId((cur) => (cur === emp.id ? null : cur)), 2200)
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0) handleSelectSearchResult(searchResults[0])
    else if (e.key === 'Escape') setSearchQuery('')
  }

  const nodeById = (id) => nodes.find((n) => n.id === id)

  if (loading) {
    return (
      <div className="oce-root">
        <div className="oce-app">
          <div className="state-screen">
            <div className="spinner" />
            <p>Loading org chart…</p>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="oce-root">
        <div className="oce-app">
          <div className="state-screen">
            <p className="state-error-text">Could not reach the backend.</p>
            <p className="state-error-detail">{loadError}</p>
            <button className="btn btn-primary" onClick={loadAll}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  const connectSource = connectSourceId ? nodeById(connectSourceId) : null

  const allDepthsPresent = [...new Set(Array.from(layoutPositions.values()).map((p) => p.depth))]
    .filter((d) => levelLabel(d) !== null)
    .sort((a, b) => a - b)
  const visibleDepthSet = new Set(visibleNodes.map((n) => layoutPositions.get(n.id)?.depth ?? 0))
  const depthsPresent = allDepthsPresent.filter((d) => visibleDepthSet.has(d))

  const contentWidth = Math.max(960, ...nodes.map((n) => n.positionX + NODE_WIDTH + 80), 0)
  const dividerDepths = []
  if (depthsPresent.length > 1) {
    for (let d = depthsPresent[0]; d < depthsPresent[depthsPresent.length - 1]; d++) dividerDepths.push(d)
  }

  return (
    <div className="oce-root">
      <div className="oce-app">
        <header className="header">
          <div className="header-left">
            <div className="logo">⬡</div>
            <h1>Org Chart Editor</h1>
          </div>
          <div className="header-center">
            <div className="header-search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="Search employees…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            {connectSourceId && (
              <span className="connect-banner">
                Connecting from <strong>{connectSource ? connectSource.name : '...'}</strong> — click a target
                employee, or press Esc to cancel
              </span>
            )}
            {selectedEdge && (
              <span className="connect-banner connect-banner--danger">
                Reporting line selected — press Delete to remove it, or Esc to cancel
              </span>
            )}
          </div>
          <div className="header-right" style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={performUndo}
              disabled={undoStack.length === 0}
              title="Undo last action (Ctrl+Z)"
            >
              ↩ Undo
            </button>
            <button className="btn btn-secondary" onClick={handleAutoArrange} disabled={nodes.length === 0}>
              Auto-arrange
            </button>
            <button className="btn btn-save" onClick={handleSaveChanges} disabled={saving}>
              {isDirty && <span className="dirty-dot" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              + Add employee
            </button>
          </div>
        </header>

        <div className="body">
          <aside className="side-panel">
            <div className="sidebar-counts">
              <span className="count-pill">{nodes.length} placed</span>
              <span className="count-pill">{unassigned.length} unassigned</span>
            </div>
            {searchQueryTrimmed ? (
              <>
                <h2>Results</h2>
                {searchResults.length === 0 && <p className="panel-empty">No matches</p>}
                <div className="card-list">
                  {searchResults.map((emp) => {
                    const colors = emp.inChart
                      ? levelColor(layoutPositions.get(emp.id)?.depth ?? 0)
                      : deptColor(emp.department)
                    return (
                      <div key={emp.id} className="search-result-card" onClick={() => handleSelectSearchResult(emp)}>
                        <div className="avatar avatar--sm" style={{ background: colors.dot }}>{emp.avatar}</div>
                        <div className="search-result-info">
                          <div className="search-result-name">{emp.name}</div>
                          <div className="search-result-meta">{emp.role}</div>
                        </div>
                        <span className={`search-result-status${emp.inChart ? ' search-result-status--placed' : ''}`}>
                          {emp.inChart ? 'On chart' : 'Unassigned'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <h2>Unassigned</h2>
                {unassigned.length === 0 && <p className="panel-empty">No unassigned employees</p>}
                <div className="card-list">
                  {unassigned.map((emp) => {
                    const colors = deptColor(emp.department)
                    return (
                      <div
                        key={emp.id}
                        ref={(el) => { if (el) cardRefs.current.set(emp.id, el); else cardRefs.current.delete(emp.id) }}
                        className={`employee-card${highlightedId === emp.id ? ' is-highlighted' : ''}`}
                        draggable
                        onDragStart={(e) => handleCardDragStart(e, emp.id)}
                        style={{ borderColor: colors.border, background: colors.bg }}
                      >
                        <div className="avatar" style={{ background: colors.dot }}>{emp.avatar}</div>
                        <div className="card-info">
                          <div className="card-name">{emp.name}</div>
                          <div className="card-role">{emp.role}</div>
                          <span className="dept-badge" style={{ color: colors.text }}>{emp.department}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </aside>

          <main
            className="canvas"
            ref={canvasRef}
            onClick={handleCanvasClick}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            {nodes.length === 0 && (
              <div className="empty-canvas-hint">
                <p>Drag an unassigned employee from the left panel onto the canvas to begin.</p>
              </div>
            )}

            {depthsPresent.map((depth, i) => (
              <div
                key={depth}
                className={`level-band${i % 2 === 1 ? ' level-band--alt' : ''}`}
                style={{
                  top: LAYOUT_TOP_MARGIN + depth * LAYOUT_LEVEL_HEIGHT - (LAYOUT_LEVEL_HEIGHT - NODE_HEIGHT) / 2,
                  height: LAYOUT_LEVEL_HEIGHT,
                  width: contentWidth,
                }}
              />
            ))}

            {dividerDepths.map((depth) => (
              <div
                key={`divider-${depth}`}
                className="level-divider"
                style={{
                  top: LAYOUT_TOP_MARGIN + depth * LAYOUT_LEVEL_HEIGHT + NODE_HEIGHT + (LAYOUT_LEVEL_HEIGHT - NODE_HEIGHT) / 2,
                  width: contentWidth,
                }}
              />
            ))}

            <svg className="edge-layer">
              <defs>
                <marker id="oce-arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill="#94A3B8" />
                </marker>
                <marker id="oce-arrowhead-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill="#DC2626" />
                </marker>
              </defs>

              {visibleEdges.map((edge) => {
                const source = nodeById(edge.source)
                const target = nodeById(edge.target)
                if (!source || !target) return null
                const sx = source.positionX + NODE_WIDTH / 2
                const sy = source.positionY + NODE_HEIGHT
                const tx = target.positionX + NODE_WIDTH / 2
                const ty = target.positionY
                const midY = (sy + ty) / 2
                const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
                const isSelected = selectedEdge && selectedEdge.source === edge.source && selectedEdge.target === edge.target
                return (
                  <g key={`${edge.source}-${edge.target}`}>
                    <path d={d} className="edge-hit-area" onClick={(e) => handleEdgeClick(e, edge)} />
                    <path
                      d={d}
                      className={`edge-path${isSelected ? ' edge-path--selected' : ''}`}
                      markerEnd={isSelected ? 'url(#oce-arrowhead-selected)' : 'url(#oce-arrowhead)'}
                    />
                  </g>
                )
              })}

              {connectSourceId && connectSource && mousePos && (
                <path
                  d={`M ${connectSource.positionX + NODE_WIDTH / 2} ${connectSource.positionY + NODE_HEIGHT} C ${
                    connectSource.positionX + NODE_WIDTH / 2
                  } ${(connectSource.positionY + NODE_HEIGHT + mousePos.y) / 2}, ${mousePos.x} ${
                    (connectSource.positionY + NODE_HEIGHT + mousePos.y) / 2
                  }, ${mousePos.x} ${mousePos.y}`}
                  className="edge-preview"
                />
              )}
            </svg>

            {visibleNodes.map((node) => {
              const depth = layoutPositions.get(node.id)?.depth ?? 0
              const colors = levelColor(depth)
              const isConnectSource = connectSourceId === node.id
              return (
                <div
                  key={node.id}
                  ref={(el) => { if (el) nodeRefs.current.set(node.id, el); else nodeRefs.current.delete(node.id) }}
                  className={`org-node${isConnectSource ? ' org-node--source' : ''}${
                    highlightedId === node.id ? ' is-highlighted' : ''
                  }${(childrenMap.get(node.id) || []).length > 0 ? ' org-node--has-children' : ''}`}
                  style={{ left: node.positionX, top: node.positionY, borderColor: colors.border, background: colors.bg }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onClick={(e) => handleNodeClick(e, node)}
                >
                  <div className="org-node-row">
                    <div className="avatar" style={{ background: colors.dot }}>{node.avatar}</div>
                    <div className="org-node-info">
                      <div className="org-node-name">{node.name}</div>
                      <div className="org-node-role">{node.role}</div>
                    </div>
                  </div>
                  <span className="dept-badge" style={{ color: colors.text }}>{node.department}</span>
                  <div className="node-actions">
                    <button
                      className="node-action-btn"
                      title="Edit details"
                      onClick={(e) => { e.stopPropagation(); setEditingEmployee(node) }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      ✎
                    </button>
                    <button
                      className="node-action-btn"
                      title="Connect to manager/report"
                      onClick={(e) => startConnect(e, node)}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      ⇢
                    </button>
                    <button
                      className="node-action-btn node-action-btn--danger"
                      title="Remove from chart"
                      onClick={(e) => handleRemove(e, node)}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      ✕
                    </button>
                  </div>

                  {(childrenMap.get(node.id) || []).length > 0 && (
                    <button
                      className="collapse-toggle"
                      title={collapsedNodes.has(node.id) ? 'Expand team' : 'Collapse team'}
                      style={{ borderColor: colors.border, color: colors.text }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCollapsedNodes((prev) => {
                          const next = new Set(prev)
                          if (next.has(node.id)) next.delete(node.id)
                          else next.add(node.id)
                          return next
                        })
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {collapsedNodes.has(node.id) ? '▼' : '▲'}
                    </button>
                  )}
                </div>
              )
            })}
          </main>
        </div>

        {modalOpen && (
          <AddEmployeeModal
            departments={departments}
            onClose={() => setModalOpen(false)}
            onSubmit={handleAddEmployee}
          />
        )}

        {editingEmployee && (
          <EditEmployeeModal
            employee={editingEmployee}
            departments={departments}
            onClose={() => setEditingEmployee(null)}
            onSubmit={handleEditEmployee}
          />
        )}

        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.type}`}>{t.message}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AddEmployeeModal({ departments, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState(departments[0] || '')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !role.trim() || !department) return
    setSubmitting(true)
    Promise.resolve(onSubmit({ name: name.trim(), role: role.trim(), department })).finally(() => setSubmitting(false))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add employee</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </label>
          <label>
            Title
            <input value={role} onChange={(e) => setRole(e.target.value)} required />
          </label>
          <label>
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)} required>
              {departments.length === 0 && <option value="">No departments found</option>}
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || departments.length === 0}>
              {submitting ? 'Adding…' : 'Add employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditEmployeeModal({ employee, departments, onClose, onSubmit }) {
  const [name, setName] = useState(employee.name)
  const [role, setRole] = useState(employee.role)
  const [department, setDepartment] = useState(employee.department)
  const [submitting, setSubmitting] = useState(false)

  // Include the employee's current department even if it's not in the
  // fetched list, so editing someone with an unusual department doesn't
  // silently swap it out.
  const departmentOptions = departments.includes(employee.department)
    ? departments
    : [employee.department, ...departments]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !role.trim() || !department) return
    setSubmitting(true)
    Promise.resolve(onSubmit({ name: name.trim(), role: role.trim(), department })).finally(() => setSubmitting(false))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit employee</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </label>
          <label>
            Title
            <input value={role} onChange={(e) => setRole(e.target.value)} required />
          </label>
          <label>
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)} required>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
