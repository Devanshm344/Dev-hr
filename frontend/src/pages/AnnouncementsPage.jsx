import React, { useEffect, useState } from 'react'
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole } from '../rbac/constants'
import { Plus, Bell, Trash2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'

const PRIORITY_COLORS = { low: 'badge-gray', normal: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red' }

export default function AnnouncementsPage() {
  const { user } = useAuthStore()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'general', priority: 'normal' })
  const [saving, setSaving] = useState(false)

  const isAdmin = isAdminRole(user)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const res = await getAnnouncements(); setAnnouncements(res.data) }
    catch {} finally { setLoading(false) }
  }

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await createAnnouncement(form); toast.success('Announcement published!')
      setShowAdd(false); setForm({ title: '', content: '', category: 'general', priority: 'normal' }); load()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove announcement?')) return
    try { await deleteAnnouncement(id); toast.success('Removed'); load() } catch {}
  }

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Announcements</h1><p className="text-sm text-gray-500">Company-wide announcements</p></div>
        {isAdmin && <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /> Post Announcement</button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-600" /></div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16 text-gray-400"><Bell size={48} className="mx-auto mb-3 opacity-30" /><p>No announcements</p></div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={clsx('card p-5 border-l-4', {
              'border-red-500': a.priority === 'urgent' || a.priority === 'high',
              'border-primary-600': a.priority === 'normal',
              'border-gray-200': a.priority === 'low',
            })}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    <span className={PRIORITY_COLORS[a.priority] || 'badge-gray'}>{a.priority}</span>
                    <span className="badge-gray capitalize">{a.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{a.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>By {a.publisher}</span>
                    <span>·</span>
                    <span>{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Post Announcement</h2>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div><label className="label">Title *</label><input required className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Content *</label><textarea required rows={4} className="input" value={form.content} onChange={e => setForm({...form, content: e.target.value})} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {['general','hr','it','finance','operations','celebrations'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null} Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  )
}
