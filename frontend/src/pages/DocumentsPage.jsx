import React, { useEffect, useState } from 'react'
import { getMyDocuments, uploadDocument, deleteDocument } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Upload, File, Trash2, Loader2, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import Container from '../components/ui/Container'

const DOC_TYPES = ['offer_letter', 'id_proof', 'pan_card', 'aadhar_card', 'bank_statement', 'certificate', 'appraisal_letter', 'promotion_letter', 'experience_letter', 'other']

export default function DocumentsPage() {
  const { user } = useAuthStore()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ title: '', document_type: '' })
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadDocs() }, [])

  const loadDocs = async () => {
    setLoading(true)
    try {
      const res = await getMyDocuments()
      setDocs(res.data)
    } catch {} finally { setLoading(false) }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please select a file')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('employee_id', user.id)
      fd.append('title', form.title)
      fd.append('document_type', form.document_type)
      fd.append('file', file)
      await uploadDocument(fd)
      toast.success('Document uploaded!')
      setShowUpload(false)
      setFile(null)
      setForm({ title: '', document_type: '' })
      loadDocs()
    } catch (e) { toast.error('Upload failed') } finally { setUploading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return
    try {
      await deleteDocument(id)
      toast.success('Document deleted')
      loadDocs()
    } catch { toast.error('Failed') }
  }

  const iconForType = (type) => {
    const icons = { offer_letter: '📄', id_proof: '🪪', pan_card: '💳', aadhar_card: '🪪', bank_statement: '🏦', certificate: '🎓', default: '📁' }
    return icons[type] || icons.default
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500">Your HR documents and files</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary"><Upload size={16} /> Upload Document</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-600" /></div>
      ) : docs.length === 0 ? (
        <div className="card text-center py-20 text-gray-400">
          <File size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents uploaded yet</p>
          <p className="text-sm mt-1">Upload your HR documents here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(d => (
            <div key={d.id} className="card p-4 flex items-start gap-3 group hover:shadow-md transition-shadow">
              <div className="text-3xl">{iconForType(d.document_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{d.title}</p>
                <p className="text-xs text-gray-400 capitalize">{d.document_type?.replace('_', ' ')}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{formatSize(d.file_size)}</span>
                  <span>·</span>
                  <span>{new Date(d.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Upload Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpload} className="p-5 space-y-4">
              <div>
                <label className="label">Document Title *</label>
                <input required className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Aadhar Card" />
              </div>
              <div>
                <label className="label">Document Type *</label>
                <select required className="input" value={form.document_type} onChange={e => setForm({...form, document_type: e.target.value})}>
                  <option value="">Select Type</option>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="label">File *</label>
                <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors ${file ? 'border-primary-400 bg-primary-50' : 'border-gray-200'}`}
                  onClick={() => document.getElementById('doc-file').click()}>
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-primary-600">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">Click to select file</p>
                      <p className="text-xs text-gray-300">PDF, DOC, JPG, PNG (max 10MB)</p>
                    </div>
                  )}
                </div>
                <input id="doc-file" type="file" className="hidden" onChange={e => setFile(e.target.files[0])} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowUpload(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={uploading} className="btn-primary flex-1 justify-center">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : null} Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  )
}
