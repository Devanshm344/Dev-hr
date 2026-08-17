import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getEmployeeProfile, updateEmployeeProfile, getDepartments, getEmployeeDocuments, getEmployees, deleteEmployee, uploadEmployeePhoto, removeEmployeePhoto } from '../services/api'
import ManagerSearchDropdown from '../components/ManagerSearchDropdown'
import { useAuthStore } from '../store/authStore'
import { isAdmin as isAdminRole, roleDisplayLabel } from '../rbac/constants'
import {
  ArrowLeft, Edit2, Save, X, Mail, Phone, Building2, Loader2,
  User, CreditCard, FileText, MapPin, Briefcase, AlertCircle, Users,
  Shield, Calendar, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Container from '../components/ui/Container'

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'personal',   label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'skills',     label: 'Skills' },
  { id: 'bank',       label: 'Bank & Tax' },
  { id: 'emergency',  label: 'Emergency' },
  { id: 'documents',  label: 'Documents' },
]

const Field = ({ label, value, colSpan }) => (
  <div className={colSpan === 2 ? 'col-span-2' : ''}>
    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
    <p className="text-sm text-gray-900 font-medium">{value || '—'}</p>
  </div>
)

const Card = ({ title, icon: Icon, children, grid = true }) => (
  <div className="card p-5">
    {title && (
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon size={16} className="text-primary-600" />{title}
      </h3>
    )}
    <div className={grid ? 'grid grid-cols-2 gap-x-6 gap-y-4' : ''}>{children}</div>
  </div>
)

const SkillTags = ({ value, color = 'primary' }) => {
  if (!value) return <p className="text-sm text-gray-400">—</p>
  const tags = value.split(',').map(s => s.trim()).filter(Boolean)
  const cls = {
    primary:   'bg-primary-50 text-primary-700',
    secondary: 'bg-secondary-50 text-secondary-700',
    gray:      'bg-gray-100 text-gray-700',
  }[color]
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(s => <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${cls}`}>{s}</span>)}
    </div>
  )
}

export default function EmployeeDetail() {
  const { id } = useParams()
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [departments, setDepartments] = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [documents, setDocuments] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('overview')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [photoImgError, setPhotoImgError] = useState(false)

  const isAdmin = isAdminRole(user)
  const isSelf = user?.id === parseInt(id)

  useEffect(() => { loadAll() }, [id])
  useEffect(() => { setPhotoImgError(false) }, [profile?.profile_picture, photoPreview, photoRemoved])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [profRes, docRes, deptRes, empRes] = await Promise.all([
        getEmployeeProfile(id),
        getEmployeeDocuments(id),
        getDepartments(),
        getEmployees({ limit: 500 }),
      ])
      const p = profRes.data
      setProfile(p)
      setDocuments(docRes.data)
      setDepartments(deptRes.data)
      setAllEmployees(empRes.data?.employees || [])
      setForm({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        title: p.title,
        status: p.status,
        department_id: p.department_id,
        sub_department: p.employment?.sub_department,
        job_role: p.employment?.job_role,
        source_of_hire: p.employment?.source_of_hire,
        probation_end_date: p.employment?.probation_end_date || '',
        mobile_phone: p.personal?.mobile_phone,
        extension: p.personal?.extension,
        gender: p.personal?.gender,
        blood_group: p.personal?.blood_group,
        marital_status: p.personal?.marital_status,
        about_me: p.personal?.about_me,
        present_address: p.address?.present_address,
        permanent_address: p.address?.permanent_address,
        city: p.address?.city,
        state: p.address?.state,
        country: p.address?.country,
        pincode: p.address?.pincode,
        employment_type: p.employment?.employment_type,
        work_location: p.employment?.work_location,
        base_salary: p.employment?.base_salary,
        date_of_joining: p.employment?.date_of_joining || '',
        job_level: p.employment?.job_level || '',
        manager_id: p.employment?.manager_id || null,
        reporting_manager_name: p.employment?.reporting_manager_name || '',
        primary_skill_set: p.skills?.primary_skill_set,
        secondary_skill_set: p.skills?.secondary_skill_set,
        other_skills: p.skills?.other_skills,
        total_experience: p.skills?.total_experience,
        current_project: p.skills?.current_project,
        pan_number: p.bank_tax?.pan_number,
        aadhar_number: p.bank_tax?.aadhar_number,
        bank_account_number: p.bank_tax?.bank_account_number,
        bank_name: p.bank_tax?.bank_name,
        ifsc_code: p.bank_tax?.ifsc_code,
        bank_account_holder_name: p.bank_tax?.bank_account_holder_name,
        passport_number: p.bank_tax?.passport_number,
        passport_valid_from: p.bank_tax?.passport_valid_from || '',
        passport_valid_to: p.bank_tax?.passport_valid_to || '',
        personal_email: p.personal?.personal_email,
        work_phone: p.personal?.work_phone,
        date_of_birth: p.personal?.date_of_birth,
        father_name: p.personal?.father_name,
        emergency_contact_primary_name: p.emergency_contacts?.primary_name,
        emergency_contact_primary_number: p.emergency_contacts?.primary_number,
        emergency_contact_secondary_name: p.emergency_contacts?.secondary_name,
        emergency_contact_secondary_number: p.emergency_contacts?.secondary_number,
      })
    } catch {
      toast.error('Failed to load employee')
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, and WEBP images are allowed')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5 MB')
      e.target.value = ''
      return
    }
    setPhotoFile(file)
    setPhotoRemoved(false)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (tab === 'employment' && isAdmin) {
      if (form.date_of_joining && new Date(form.date_of_joining) > new Date()) {
        toast.error('Date of joining cannot be a future date')
        return
      }
      if (form.probation_end_date && form.date_of_joining && new Date(form.probation_end_date) < new Date(form.date_of_joining)) {
        toast.error('Probation end date cannot be before the date of joining')
        return
      }
      if (form.base_salary !== '' && form.base_salary !== null && form.base_salary !== undefined) {
        const salary = parseFloat(form.base_salary)
        if (isNaN(salary) || salary < 0) {
          toast.error('Base salary must be a positive number')
          return
        }
      }
    }
    if (tab === 'personal' && isAdmin) {
      if (!form.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        toast.error('Work email address is required and must be valid')
        return
      }
      if (form.personal_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personal_email.trim())) {
        toast.error('Personal email address is invalid')
        return
      }
      const phoneRegex = /^[+]?[\d\s\-(). ]{7,20}$/
      if (form.work_phone?.trim() && !phoneRegex.test(form.work_phone.trim())) {
        toast.error('Work phone number is invalid')
        return
      }
      if (form.date_of_birth && new Date(form.date_of_birth) > new Date()) {
        toast.error('Date of birth cannot be a future date')
        return
      }
      if (form.father_name?.trim() && form.father_name.trim().length > 200) {
        toast.error('Father\'s name must be 200 characters or fewer')
        return
      }
    }
    if (tab === 'emergency') {
      if (!form.emergency_contact_primary_name?.trim()) {
        toast.error('Primary contact name is required')
        return
      }
      if (!form.emergency_contact_primary_number?.trim()) {
        toast.error('Primary contact phone number is required')
        return
      }
      const phoneRegex = /^[+]?[\d\s\-(). ]{7,20}$/
      if (!phoneRegex.test(form.emergency_contact_primary_number)) {
        toast.error('Primary contact phone number is invalid')
        return
      }
      if (form.emergency_contact_secondary_number?.trim() && !phoneRegex.test(form.emergency_contact_secondary_number)) {
        toast.error('Secondary contact phone number is invalid')
        return
      }
    }
    setSaving(true)
    try {
      const payload = { ...form }
      const dateFields = ['date_of_joining', 'date_of_birth', 'passport_valid_from', 'passport_valid_to', 'probation_end_date']
      dateFields.forEach(k => { if (!payload[k]) delete payload[k] })
      const res = await updateEmployeeProfile(id, payload)
      if (isSelf) {
        const u = res.data
        updateUser({ id: u.id, employee_id: u.employee_id, name: u.name, email: u.email, role: u.role, title: u.title, profile_picture: u.profile_picture })
      }
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        await uploadEmployeePhoto(id, fd)
      } else if (photoRemoved) {
        await removeEmployeePhoto(id)
      }
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoRemoved(false)
      toast.success('Profile updated')
      setEditing(false)
      loadAll()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => {
    setEditing(true)
    // overview/documents have no edit form — admins land on employment, others on personal
    if (['overview', 'documents'].includes(tab)) setTab(isAdmin ? 'employment' : 'personal')
    // non-admins cannot edit emergency contacts — redirect to personal
    if (tab === 'emergency' && !isAdmin) setTab('personal')
  }

  const cancelEdit = () => {
    setEditing(false)
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoRemoved(false)
    loadAll()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEmployee(id)
      toast.success('Employee profile deleted successfully')
      navigate('/employees')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete employee')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-primary-600" />
    </div>
  )
  if (!profile) return <div className="text-gray-500 p-8">Employee not found</div>

  const p = profile
  const visibleTabs = TABS.filter(t => t.id !== 'bank' || isAdmin || isSelf)

  return (
    <Container>

      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Link to="/employees" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
        <div className="flex-1" />
        {(isAdmin || isSelf) && !editing && (
          <button onClick={startEditing} className="btn-primary">
            <Edit2 size={16} /> Edit Profile
          </button>
        )}
        {isAdmin && !isSelf && !editing && (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
            <Trash2 size={16} /> Delete Profile
          </button>
        )}
        {editing && (
          <>
            <button onClick={cancelEdit} className="btn-secondary"><X size={16} /> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Delete Employee</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-gray-900">{profile?.name}</span>?{' '}
              This will remove their profile and all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-400 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary-200">
              <span className="absolute inset-0 flex items-center justify-center">{p.first_name?.charAt(0)}{p.last_name?.charAt(0)}</span>
              {(() => {
                const src = photoFile ? photoPreview : (photoRemoved ? null : p.profile_picture)
                return (src && !photoImgError) ? (
                  <img src={src} alt={p.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setPhotoImgError(true)} />
                ) : null
              })()}
            </div>
            {editing && (isAdmin || isSelf) && (
              <div className="flex flex-col gap-1 w-full">
                <label className="cursor-pointer w-full">
                  <span className="btn-secondary text-xs py-1 px-2.5 inline-block w-full text-center">
                    {photoFile ? 'Change' : 'Upload'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handlePhotoChange}
                  />
                </label>
                {(photoFile || (!photoRemoved && p.profile_picture)) && (
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoRemoved(true) }}
                    className="text-xs py-1 px-2.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors w-full"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{p.name}</h1>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">{p.employee_id}</span>
              <span className={clsx('badge', {
                'badge-green':  p.status === 'active',
                'badge-yellow': p.status === 'on_leave',
                'badge-red':    p.status === 'terminated',
                'badge-gray':   p.status === 'inactive',
              })}>{p.status?.replace('_', ' ')}</span>
            </div>
            <p className="text-gray-500 mt-1">{p.title}{p.department ? ` · ${p.department}` : ''}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5"><Mail size={14} />{p.email}</span>
              {p.personal?.mobile_phone && (
                <span className="flex items-center gap-1.5"><Phone size={14} />{p.personal.mobile_phone}</span>
              )}
              {p.employment?.work_location && (
                <span className="flex items-center gap-1.5"><MapPin size={14} />{p.employment.work_location}</span>
              )}
              {p.employment?.date_of_joining && (
                <span className="flex items-center gap-1.5"><Calendar size={14} />Joined {p.employment.date_of_joining}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Personal Information" icon={User}>
            <Field label="Email"          value={p.email} />
            <Field label="Mobile"         value={p.personal?.mobile_phone} />
            <Field label="Gender"         value={p.personal?.gender} />
            <Field label="Date of Birth"  value={p.personal?.date_of_birth} />
            <Field label="Blood Group"    value={p.personal?.blood_group} />
            <Field label="Marital Status" value={p.personal?.marital_status} />
          </Card>
          <Card title="Employment Details" icon={Building2}>
            <Field label="Employee ID"      value={p.employee_id} />
            <Field label="Designation"      value={p.title} />
            <Field label="Department"       value={p.department} />
            <Field label="Employment Type"  value={p.employment?.employment_type} />
            <Field label="Work Location"    value={p.employment?.work_location} />
            <Field label="Manager"          value={p.employment?.manager || p.employment?.reporting_manager_name} />
            <Field label="Date of Joining"  value={p.employment?.date_of_joining} />
            <Field label="Job Level"        value={p.employment?.job_level} />
            {isAdmin && (
              <Field label="Base Salary"
                value={p.employment?.base_salary ? `₹${p.employment.base_salary.toLocaleString('en-IN')}` : null} />
            )}
          </Card>
        </div>
      )}

      {/* ── PERSONAL ─────────────────────────────────────────────────── */}
      {tab === 'personal' && !editing && (
        <div className="space-y-5">
          <Card title="Contact Information" icon={Phone}>
            <Field label="Work Email"     value={p.email} />
            <Field label="Personal Email" value={p.personal?.personal_email} />
            <Field label="Mobile Phone"   value={p.personal?.mobile_phone} />
            <Field label="Work Phone"     value={p.personal?.work_phone} />
            <Field label="Extension"      value={p.personal?.extension} />
          </Card>

          <Card title="Personal Details" icon={User}>
            <Field label="Gender"         value={p.personal?.gender} />
            <Field label="Date of Birth"  value={p.personal?.date_of_birth} />
            <Field label="Blood Group"    value={p.personal?.blood_group} />
            <Field label="Marital Status" value={p.personal?.marital_status} />
            <Field label="Father's Name"  value={p.personal?.father_name} />
          </Card>

          {p.personal?.about_me && (
            <div className="card p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">About Me</p>
              <p className="text-sm text-gray-700 leading-relaxed">{p.personal.about_me}</p>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-primary-600" /> Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Present Address</p>
                <p className="text-sm text-gray-700">{p.address?.present_address || '—'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {[p.address?.city, p.address?.state, p.address?.country].filter(Boolean).join(', ')}
                </p>
                {p.address?.pincode && <p className="text-xs text-gray-400 mt-0.5">PIN: {p.address.pincode}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Permanent Address</p>
                <p className="text-sm text-gray-700">{p.address?.permanent_address || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'personal' && editing && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Phone size={16} className="text-primary-600" /> Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Mobile Phone</label>
                <input className="input" value={form.mobile_phone || ''} onChange={e => setForm({...form, mobile_phone: e.target.value})} /></div>
              {isAdmin && (
                <>
                  <div><label className="label">Work Email <span className="text-red-500">*</span></label>
                    <input type="email" required className="input" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} placeholder="name@techdemocracy.com" /></div>
                  <div><label className="label">Work Phone</label>
                    <input className="input" value={form.work_phone || ''} onChange={e => setForm({...form, work_phone: e.target.value})} placeholder="+91 XXXXX XXXXX" /></div>
                  <div><label className="label">Extension</label>
                    <input className="input" value={form.extension || ''} onChange={e => setForm({...form, extension: e.target.value})} placeholder="e.g. 1042" /></div>
                  <div><label className="label">Personal Email</label>
                    <input type="email" className="input" value={form.personal_email || ''} onChange={e => setForm({...form, personal_email: e.target.value})} placeholder="personal@example.com" /></div>
                </>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={16} className="text-primary-600" /> Personal Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">First Name</label>
                <input className="input" value={form.first_name || ''} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
              <div><label className="label">Last Name</label>
                <input className="input" value={form.last_name || ''} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
              <div><label className="label">Gender</label>
                <select className="input" value={form.gender || ''} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select></div>
              <div><label className="label">Blood Group</label>
                <select className="input" value={form.blood_group || ''} onChange={e => setForm({...form, blood_group: e.target.value})}>
                  <option value="">Select</option>
                  {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg => <option key={bg}>{bg}</option>)}
                </select></div>
              <div><label className="label">Marital Status</label>
                <select className="input" value={form.marital_status || ''} onChange={e => setForm({...form, marital_status: e.target.value})}>
                  <option value="">Select</option>
                  <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                </select></div>
              {isAdmin && (
                <>
                  <div><label className="label">Date of Birth</label>
                    <input type="date" className="input" value={form.date_of_birth || ''} max={new Date().toISOString().split('T')[0]} onChange={e => setForm({...form, date_of_birth: e.target.value})} /></div>
                  <div className="col-span-2"><label className="label">Father's Name</label>
                    <input className="input" maxLength={200} value={form.father_name || ''} onChange={e => setForm({...form, father_name: e.target.value})} /></div>
                </>
              )}
            </div>
            <div className="mt-4"><label className="label">About Me</label>
              <textarea className="input" rows={3} value={form.about_me || ''} onChange={e => setForm({...form, about_me: e.target.value})} placeholder="Brief introduction..." /></div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-primary-600" /> Address
            </h3>
            <div className="space-y-3">
              <div><label className="label">Present Address</label>
                <textarea className="input" rows={2} value={form.present_address || ''} onChange={e => setForm({...form, present_address: e.target.value})} /></div>
              <div><label className="label">Permanent Address</label>
                <textarea className="input" rows={2} value={form.permanent_address || ''} onChange={e => setForm({...form, permanent_address: e.target.value})} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">City</label>
                  <input className="input" value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})} /></div>
                <div><label className="label">State</label>
                  <input className="input" value={form.state || ''} onChange={e => setForm({...form, state: e.target.value})} /></div>
                <div><label className="label">Country</label>
                  <input className="input" value={form.country || ''} onChange={e => setForm({...form, country: e.target.value})} /></div>
                <div><label className="label">Pincode</label>
                  <input className="input" value={form.pincode || ''} onChange={e => setForm({...form, pincode: e.target.value})} placeholder="Enter pincode" maxLength={10} /></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EMPLOYMENT ───────────────────────────────────────────────── */}
      {tab === 'employment' && !editing && (
        <div className="space-y-5">
          <Card title="Job Details" icon={Building2}>
            <Field label="Employee ID"      value={p.employee_id} />
            <Field label="Designation"      value={p.title} />
            <Field label="Job Role"         value={p.employment?.job_role} />
            <Field label="Job Level"        value={p.employment?.job_level} />
            <Field label="Department"       value={p.department} />
            <Field label="Sub Department"   value={p.employment?.sub_department} />
            <Field label="Employment Type"  value={p.employment?.employment_type} />
            <Field label="Work Location"    value={p.employment?.work_location} />
            <Field label="Source of Hire"   value={p.employment?.source_of_hire} />
            <Field label="Onboarding Status" value={p.employment?.onboarding_status} />
            <Field label="Date of Joining"  value={p.employment?.date_of_joining} />
            <Field label="Probation End"    value={p.employment?.probation_end_date} />
            {p.employment?.date_of_exit && <Field label="Date of Exit" value={p.employment.date_of_exit} />}
            {p.employment?.last_working_day && <Field label="Last Working Day" value={p.employment.last_working_day} />}
            {p.employment?.exit_reason && <Field label="Exit Reason" value={p.employment.exit_reason} colSpan={2} />}
          </Card>

          <Card title="Reporting & Compensation" icon={Users}>
            <Field label="Reporting Manager"
              value={p.employment?.manager || p.employment?.reporting_manager_name} />
            <Field label="System Role" value={p.role ? roleDisplayLabel(p.role) : undefined} />
            {isAdmin && (
              <Field label="Base Salary"
                value={p.employment?.base_salary ? `₹${p.employment.base_salary.toLocaleString('en-IN')}` : null} />
            )}
          </Card>
        </div>
      )}

      {tab === 'employment' && editing && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-primary-600" /> Edit Employment Details
          </h3>
          {isAdmin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Designation</label>
                <input className="input" value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Job Role</label>
                <input className="input" placeholder="e.g. Team member" value={form.job_role || ''} onChange={e => setForm({...form, job_role: e.target.value})} /></div>
              <div><label className="label">Department</label>
                <select className="input" value={form.department_id || ''} onChange={e => setForm({...form, department_id: e.target.value})}>
                  <option value="">Select</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
              <div><label className="label">Sub Department</label>
                <input className="input" placeholder="e.g. Frontend Team" value={form.sub_department || ''} onChange={e => setForm({...form, sub_department: e.target.value})} /></div>
              <div><label className="label">Status</label>
                <select className="input" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select></div>
              <div><label className="label">Employment Type</label>
                <select className="input" value={form.employment_type || ''} onChange={e => setForm({...form, employment_type: e.target.value})}>
                  <option value="">Select</option>
                  <option>Permanent</option>
                  <option>On Contract</option>
                  <option>Temporary</option>
                  <option>Intern</option>
                  <option>Part-time</option>
                </select></div>
              <div><label className="label">Work Location</label>
                <input className="input" value={form.work_location || ''} onChange={e => setForm({...form, work_location: e.target.value})} /></div>
              <div><label className="label">Date of Joining</label>
                <input type="date" className="input" value={form.date_of_joining || ''} max={new Date().toISOString().split('T')[0]} onChange={e => setForm({...form, date_of_joining: e.target.value})} /></div>
              <div><label className="label">Probation End Date</label>
                <input type="date" className="input" value={form.probation_end_date || ''} onChange={e => setForm({...form, probation_end_date: e.target.value})} /></div>
              <div><label className="label">Job Level</label>
                <input className="input" placeholder="e.g. L1, Senior, Manager" value={form.job_level || ''} onChange={e => setForm({...form, job_level: e.target.value})} /></div>
              <div><label className="label">Source of Hire</label>
                <select className="input" value={form.source_of_hire || ''} onChange={e => setForm({...form, source_of_hire: e.target.value})}>
                  <option value="">Select</option>
                  <option>Direct</option>
                  <option>Referral</option>
                  <option>Agency</option>
                  <option>Job Portal</option>
                  <option>Campus</option>
                </select></div>
              <div className="col-span-2">
                <label className="label">Reporting Manager</label>
                <ManagerSearchDropdown
                  employees={allEmployees
                    .filter(e => e.id !== parseInt(id))
                    .map(e => ({ id: e.id, employee_id: e.employee_id, full_name: e.name, designation: e.title || '' }))}
                  value={form.manager_id}
                  onChange={(mid, name) => setForm({ ...form, manager_id: mid, reporting_manager_name: name })}
                />
              </div>
              <div><label className="label">Base Salary (₹)</label>
                <input type="number" min="0" className="input" value={form.base_salary || ''} onChange={e => setForm({...form, base_salary: e.target.value})} /></div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4">Only admins can edit employment details.</p>
          )}
        </div>
      )}

      {/* ── SKILLS ───────────────────────────────────────────────────── */}
      {tab === 'skills' && !editing && (
        <div className="card p-5 space-y-5">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase size={16} className="text-primary-600" /> Skills & Experience
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Total Experience" value={p.skills?.total_experience} />
            <Field label="Current Project"  value={p.skills?.current_project} />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Primary Skills</p>
              <SkillTags value={p.skills?.primary_skill_set} color="primary" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Secondary Skills</p>
              <SkillTags value={p.skills?.secondary_skill_set} color="secondary" />
            </div>
            {p.skills?.other_skills && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Other Skills</p>
                <SkillTags value={p.skills.other_skills} color="gray" />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'skills' && editing && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Briefcase size={16} className="text-primary-600" /> Edit Skills
          </h3>
          <div className="space-y-3">
            <div><label className="label">Total Experience</label>
              <input className="input" placeholder="e.g. 2 years" value={form.total_experience || ''} onChange={e => setForm({...form, total_experience: e.target.value})} /></div>
            <div><label className="label">Current Project</label>
              <input className="input" value={form.current_project || ''} onChange={e => setForm({...form, current_project: e.target.value})} /></div>
            <div><label className="label">Primary Skills <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <textarea className="input" rows={2} value={form.primary_skill_set || ''} onChange={e => setForm({...form, primary_skill_set: e.target.value})} /></div>
            <div><label className="label">Secondary Skills <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <textarea className="input" rows={2} value={form.secondary_skill_set || ''} onChange={e => setForm({...form, secondary_skill_set: e.target.value})} /></div>
            <div><label className="label">Other Skills <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <textarea className="input" rows={2} value={form.other_skills || ''} onChange={e => setForm({...form, other_skills: e.target.value})} /></div>
          </div>
        </div>
      )}

      {/* ── BANK & TAX ───────────────────────────────────────────────── */}
      {tab === 'bank' && (isAdmin || isSelf) && !editing && (
        <div className="space-y-5">
          <Card title="Identity Documents" icon={Shield}>
            <Field label="PAN Number"    value={p.bank_tax?.pan_number} />
            <Field label="Aadhar Number" value={p.bank_tax?.aadhar_number} />
            <Field label="Passport No."  value={p.bank_tax?.passport_number} />
            <Field label="Passport Valid From" value={p.bank_tax?.passport_valid_from} />
            <Field label="Passport Valid To"   value={p.bank_tax?.passport_valid_to} />
          </Card>
          <Card title="Bank Details" icon={CreditCard}>
            <Field label="Account Number"  value={p.bank_tax?.bank_account_number} />
            <Field label="Bank Name"       value={p.bank_tax?.bank_name} />
            <Field label="IFSC Code"       value={p.bank_tax?.ifsc_code} />
            <Field label="Account Holder"  value={p.bank_tax?.bank_account_holder_name} />
          </Card>
        </div>
      )}

      {tab === 'bank' && (isAdmin || isSelf) && editing && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield size={16} className="text-primary-600" /> Identity Documents
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">PAN Number</label>
                <input className="input" value={form.pan_number || ''} onChange={e => setForm({...form, pan_number: e.target.value})} /></div>
              <div><label className="label">Aadhar Number</label>
                <input className="input" value={form.aadhar_number || ''} onChange={e => setForm({...form, aadhar_number: e.target.value})} /></div>
              <div><label className="label">Passport Number</label>
                <input className="input" value={form.passport_number || ''} onChange={e => setForm({...form, passport_number: e.target.value})} /></div>
              <div><label className="label">Passport Valid From</label>
                <input type="date" className="input" value={form.passport_valid_from || ''} onChange={e => setForm({...form, passport_valid_from: e.target.value})} /></div>
              <div><label className="label">Passport Valid To</label>
                <input type="date" className="input" value={form.passport_valid_to || ''} onChange={e => setForm({...form, passport_valid_to: e.target.value})} /></div>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-primary-600" /> Bank Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Account Number</label>
                <input className="input" value={form.bank_account_number || ''} onChange={e => setForm({...form, bank_account_number: e.target.value})} /></div>
              <div><label className="label">Bank Name</label>
                <input className="input" value={form.bank_name || ''} onChange={e => setForm({...form, bank_name: e.target.value})} /></div>
              <div><label className="label">IFSC Code</label>
                <input className="input" value={form.ifsc_code || ''} onChange={e => setForm({...form, ifsc_code: e.target.value})} /></div>
              <div><label className="label">Account Holder Name</label>
                <input className="input" value={form.bank_account_holder_name || ''} onChange={e => setForm({...form, bank_account_holder_name: e.target.value})} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── EMERGENCY CONTACTS ───────────────────────────────────────── */}
      {tab === 'emergency' && !editing && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-primary-600" /> Emergency Contacts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Contact</p>
              <Field label="Name"  value={p.emergency_contacts?.primary_name} />
              <Field label="Phone" value={p.emergency_contacts?.primary_number} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Secondary Contact</p>
              <Field label="Name"  value={p.emergency_contacts?.secondary_name} />
              <Field label="Phone" value={p.emergency_contacts?.secondary_number} />
            </div>
          </div>
        </div>
      )}

      {tab === 'emergency' && editing && isAdmin && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-primary-600" /> Edit Emergency Contacts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Contact <span className="text-red-500">*</span></p>
              <div>
                <label className="label">Name <span className="text-red-500">*</span></label>
                <input className="input" value={form.emergency_contact_primary_name || ''} onChange={e => setForm({...form, emergency_contact_primary_name: e.target.value})} placeholder="Full name" />
              </div>
              <div>
                <label className="label">Phone Number <span className="text-red-500">*</span></label>
                <input className="input" value={form.emergency_contact_primary_number || ''} onChange={e => setForm({...form, emergency_contact_primary_number: e.target.value})} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Secondary Contact</p>
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.emergency_contact_secondary_name || ''} onChange={e => setForm({...form, emergency_contact_secondary_name: e.target.value})} placeholder="Full name" />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input className="input" value={form.emergency_contact_secondary_number || ''} onChange={e => setForm({...form, emergency_contact_secondary_number: e.target.value})} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS ────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-primary-600" /> Documents
          </h3>
          {documents.length === 0 ? (
            <p className="text-gray-400 text-center py-10">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {documents.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <FileText size={20} className="text-primary-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-gray-400">{d.document_type} · {new Date(d.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </Container>
  )
}
