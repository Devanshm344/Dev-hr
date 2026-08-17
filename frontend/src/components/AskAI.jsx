import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  MessageSquare, X, Send, Loader2, Bot, User, Sparkles,
  ChevronDown, Upload, Trash2, FileText, RefreshCw, ShieldCheck,
  Cpu, AlertCircle,
} from 'lucide-react'
import { askAI, uploadPolicyPDF, listAISources, deleteAISource, getAIHealth } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'

/* ── Suggestions shown on empty state ─────────────────────────────────────── */
const SUGGESTIONS = [
  'How many casual leaves am I entitled to?',
  'What is the notice period for resignation?',
  'How do I apply for earned leave?',
  'What is the overtime compensation policy?',
  'When is my salary credited every month?',
  'What are the maternity leave benefits?',
]

/* ── Typing indicator ──────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <Avatar isBot />
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-gray-100 shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-primary-400"
              style={{ animation: 'aiDot 1.2s infinite', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Avatar ────────────────────────────────────────────────────────────────── */
function Avatar({ isBot }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: isBot
          ? 'linear-gradient(135deg,#0052CC,#00B4FF)'
          : 'linear-gradient(135deg,#10b981,#059669)',
      }}
    >
      {isBot ? <Bot size={14} className="text-white" /> : <User size={14} className="text-white" />}
    </div>
  )
}

/* ── Single message bubble ─────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar isBot={!isUser} />
      <div
        className={`max-w-[82%] px-4 py-3 text-body leading-relaxed shadow-sm ${
          isUser
            ? 'text-white rounded-2xl rounded-br-sm'
            : 'text-gray-700 rounded-2xl rounded-bl-sm bg-white border border-gray-100'
        }`}
        style={isUser ? { background: 'linear-gradient(135deg,#0052CC,#00B4FF)' } : {}}
      >
        {isUser ? msg.content : (
          <ReactMarkdown
            components={{
              p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em:     ({ children }) => <em className="italic">{children}</em>,
              ul:     ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
              ol:     ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
              li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
              h1:     ({ children }) => <p className="font-bold mb-1">{children}</p>,
              h2:     ({ children }) => <p className="font-bold mb-1">{children}</p>,
              h3:     ({ children }) => <p className="font-semibold mb-0.5">{children}</p>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}

        {/* Source badges */}
        {!isUser && msg.sources?.length > 0 && (
          <div className="mt-3 pt-2 border-t border-primary-100">
            <p className="text-dense-tight text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
              Fetched from
            </p>
            <div className="flex flex-wrap gap-1.5">
              {msg.sources.map(s => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 text-dense text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-lg font-semibold"
                >
                  📄 {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Admin: Sources panel ──────────────────────────────────────────────────── */
function SourcesPanel({ onClose }) {
  const [sources, setSources]     = useState([])
  const [totalChunks, setTotal]   = useState(0)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [loadingList, setLoading] = useState(true)
  const fileRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listAISources()
      setSources(res.data.sources || [])
      setTotal(res.data.total_chunks || 0)
    } catch {
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are accepted.')
      return
    }
    setUploading(true)
    try {
      const res = await uploadPolicyPDF(file)
      alert(`✓ ${res.data.message}\n${res.data.chunks_indexed} chunks indexed.`)
      refresh()
    } catch (err) {
      alert(`Upload failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (source) => {
    if (!window.confirm(`Delete all indexed data for "${source}"? This cannot be undone.`)) return
    setDeleting(source)
    try {
      await deleteAISource(source)
      refresh()
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ background: 'linear-gradient(135deg,#0052CC 0%,#00B4FF 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(255,255,255,0.2)' }}>
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-widget-label leading-none">Policy Manager</p>
            <p className="text-sky-200 text-dense mt-0.5">Admin · Manage indexed documents</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all text-sky-200 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Upload card */}
        <div className="bg-white rounded-2xl border border-dashed border-primary-200 p-5 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeaff)' }}>
            <Upload size={22} className="text-primary-500" />
          </div>
          <p className="text-body font-bold text-gray-700">Upload Policy PDF</p>
          <p className="text-dense text-gray-400 mt-1 mb-4">
            Text is extracted, chunked, and embedded into the vector store automatically.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full py-2.5 rounded-xl text-body font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0052CC,#00B4FF)' }}
          >
            {uploading
              ? <><Loader2 size={15} className="animate-spin" /> Indexing…</>
              : <><Upload size={15} /> Choose PDF</>
            }
          </button>
        </div>

        {/* Sources list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-dense font-bold text-gray-400 uppercase tracking-wider">
              Indexed Sources
            </p>
            <span className="text-dense text-primary-500 font-semibold">
              {totalChunks} chunks total
            </span>
          </div>

          {loadingList ? (
            <div className="text-center py-8">
              <Loader2 size={20} className="animate-spin text-primary-400 mx-auto" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-body">
              No sources indexed yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map(src => (
                <div
                  key={src}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeaff)' }}>
                    <FileText size={15} className="text-primary-400" />
                  </div>
                  <p className="flex-1 text-body font-semibold text-gray-700 truncate">
                    {src}
                  </p>
                  <button
                    onClick={() => handleDelete(src)}
                    disabled={deleting === src}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all disabled:opacity-40"
                  >
                    {deleting === src
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <button
          onClick={refresh}
          className="w-full py-2.5 rounded-xl text-dense font-semibold text-gray-500 border border-gray-200 hover:border-primary-200 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-1.5"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
    </div>
  )
}

/* ── Main AskAI component ──────────────────────────────────────────────────── */
export default function AskAI() {
  const { user }                      = useAuthStore()
  const isAdmin = isAdminRole(user)

  const [open, setOpen]               = useState(false)
  const [view, setView]               = useState('chat')   // 'chat' | 'sources'
  const [input, setInput]             = useState('')
  const [messages, setMessages]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [hasNew, setHasNew]           = useState(false)
  const [ollamaStatus, setOllama]     = useState(null)  // null | {ok, model_ready, model}

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setHasNew(false)
      if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 80)
      // Check Ollama status when panel opens
      if (ollamaStatus === null) {
        getAIHealth().then(r => setOllama(r.data?.ollama || null)).catch(() => {})
      }
    }
  }, [open, view])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return

    const userMsg     = { role: 'user', content: q }
    const newHistory  = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)

    try {
      const apiHistory = newHistory.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await askAI(q, apiHistory)
      const aiMsg = {
        role:    'assistant',
        content: res.data.answer,
        sources: res.data.sources || [],
      }
      setMessages(prev => [...prev, aiMsg])
      if (!open) setHasNew(true)
    } catch (err) {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: err.response?.data?.detail || 'Sorry, I could not process your request. Please try again.',
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => { setMessages([]); setInput('') }

  return (
    <>
      <style>{`
        @keyframes aiDot   { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes aiSlide { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes aiPulse { 0%{box-shadow:0 0 0 0 rgba(0,82,204,.45)} 70%{box-shadow:0 0 0 10px rgba(0,82,204,0)} 100%{box-shadow:0 0 0 0 rgba(0,82,204,0)} }
        .ai-panel  { animation: aiSlide .22s cubic-bezier(.4,0,.2,1); }
        .ai-pulse  { animation: aiPulse 2.2s ease-in-out infinite; }
      `}</style>

      {/* ── Panel ── */}
      {open && (
        <div
          className="ai-panel fixed bottom-24 right-6 w-[390px] max-w-[calc(100vw-2rem)] bg-gray-50 rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{
            zIndex: 9999,
            height: 580,
            boxShadow: '0 32px 80px -12px rgba(0,82,204,.28), 0 8px 32px -8px rgba(0,0,0,.12)',
          }}
        >
          {view === 'sources' && isAdmin ? (
            <SourcesPanel onClose={() => setView('chat')} />
          ) : (
            <>
              {/* Chat header */}
              <div
                className="flex flex-col shrink-0"
                style={{ background: 'linear-gradient(135deg,#0052CC 0%,#00B4FF 100%)' }}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
                         style={{ background: 'rgba(255,255,255,.2)' }}>
                      <Sparkles size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-widget-label leading-none">HR AI Assistant</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Cpu size={10} className="text-sky-300" />
                        <p className="text-sky-200 text-dense">
                          {ollamaStatus?.model || 'llama3.2:3b'} · Policy-aware
                        </p>
                        {ollamaStatus !== null && (
                          <span className={`w-1.5 h-1.5 rounded-full ${ollamaStatus.ok && ollamaStatus.model_ready ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                      <button
                        onClick={clearChat}
                        className="text-sky-200 hover:text-white text-dense px-2.5 py-1 rounded-lg hover:bg-white/10 transition-all font-medium"
                      >
                        Clear
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setView('sources')}
                        title="Manage policy PDFs"
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all text-sky-200 hover:text-white"
                      >
                        <Upload size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => setOpen(false)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all text-sky-200 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Ollama offline warning */}
                {ollamaStatus !== null && (!ollamaStatus.ok || !ollamaStatus.model_ready) && (
                  <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-red-500/20 border border-red-400/30 flex items-start gap-2">
                    <AlertCircle size={13} className="text-red-300 mt-0.5 shrink-0" />
                    <p className="text-dense text-red-200 leading-relaxed">
                      {!ollamaStatus.ok
                        ? 'Ollama is not running. Open a terminal and run: ollama serve'
                        : `Model not downloaded. Run: ollama pull ${ollamaStatus.model}`
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
                {messages.length === 0 ? (
                  <div className="flex flex-col h-full">
                    <div className="text-center pt-4 pb-5">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: 'linear-gradient(135deg,#0052CC,#00B4FF)' }}
                      >
                        <Bot size={26} className="text-white" />
                      </div>
                      <p className="font-bold text-gray-800 text-widget-label">Hello! I'm your HR Assistant</p>
                      <p className="text-gray-400 text[12px] mt-1 max-w-[240px] mx-auto leading-relaxed">
                        Ask me anything about company policies, leave, payroll, or attendance.
                      </p>
                    </div>

                    <div>
                      <p className="text-dense-tight font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                        Suggested questions
                      </p>
                      <div className="space-y-1.5">
                        {SUGGESTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => send(s)}
                            className="w-full text-left text-dense text-gray-600 bg-white hover:bg-primary-50 hover:text-primary-700 border border-gray-100 hover:border-primary-200 rounded-xl px-3.5 py-2.5 transition-all font-medium"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => <Bubble key={i} msg={m} />)}
                    {loading && <TypingDots />}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="shrink-0 px-4 pb-4 pt-3 bg-white border-t border-gray-100">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask about HR policies, leave, payroll…"
                    rows={1}
                    className="flex-1 resize-none text-body text-gray-700 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all leading-relaxed"
                    style={{ maxHeight: 100, minHeight: 44 }}
                    onInput={e => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                    }}
                  />
                  <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0"
                    style={{
                      background: 'linear-gradient(135deg,#0052CC,#00B4FF)',
                      boxShadow: '0 4px 16px -4px rgba(0,82,204,.5)',
                    }}
                  >
                    {loading
                      ? <Loader2 size={17} className="text-white animate-spin" />
                      : <Send size={17} className="text-white" />
                    }
                  </button>
                </div>
                <p className="text-dense-tight text-gray-300 text-center mt-2">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FAB ── */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) setView('chat') }}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all hover:-translate-y-1 active:translate-y-0 ${!open ? 'ai-pulse' : ''}`}
        style={{
          zIndex: 9999,
          background: open
            ? 'linear-gradient(135deg,#374151,#1f2937)'
            : 'linear-gradient(135deg,#0052CC,#00B4FF)',
          boxShadow: open
            ? '0 8px 24px -4px rgba(55,65,81,.4)'
            : '0 8px 24px -4px rgba(0,82,204,.5)',
        }}
        title="Ask HR AI"
      >
        {open
          ? <ChevronDown size={22} className="text-white" />
          : <MessageSquare size={22} className="text-white" />
        }
        {hasNew && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Label */}
      {!open && (
        <div
          className="fixed bottom-[88px] right-6 text-dense font-bold text-white px-3 py-1 rounded-full pointer-events-none select-none"
          style={{
            zIndex: 9999,
            background: 'linear-gradient(135deg,#0052CC,#00B4FF)',
            boxShadow: '0 2px 8px rgba(0,82,204,.4)',
          }}
        >
          Ask AI
        </div>
      )}
    </>
  )
}
