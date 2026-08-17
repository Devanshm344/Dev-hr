import React, { useEffect, useState } from 'react'
import { createEmployee, getDepartments, getManagersList, uploadDocument, uploadEmployeePhoto } from '../services/api'
import { Plus, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import ManagerSearchDropdown from './ManagerSearchDropdown'
import { roleDisplayLabel } from '../rbac/constants'

const TABS = ['Basic Info', 'Work Details', 'Personal', 'Skills', 'Bank Details', 'Upload Docs']

const EMPTY_FORM = {
  employee_id: '',
  first_name: '', last_name: '', email: '', mobile_phone: '', personal_email: '', work_phone: '', gender: '', about_me: '',
  date_of_joining: '', department_id: '', sub_department: '', title: '', job_role: '', job_level: '',
  employment_type: 'Permanent', source_of_hire: 'Direct', work_location: '',
  manager_id: null, reporting_manager_name: '',
  system_role: 'Employee', base_salary: '', probation_end_date: '',
  date_of_birth: '', marital_status: '', father_name: '', blood_group: '',
  present_address: '', permanent_address: '', city: '', state: '', country: '', pincode: '',
  emergency_contact_primary_name: '', emergency_contact_primary_number: '',
  emergency_contact_secondary_name: '', emergency_contact_secondary_number: '',
  primary_skill_set: '', secondary_skill_set: '', other_skills: '', total_experience: '',
  pan_number: '', aadhar_number: '', passport_number: '', passport_valid_from: '', passport_valid_to: '',
  bank_name: '', bank_account_number: '', ifsc_code: '', bank_account_holder_name: '',
}
const EMPTY_DOC_ENTRIES = [{ title: '', document_type: 'Resume', file: null }]

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

/**
 * Full 6-step "Add Employee" wizard, shared by EmployeesPage and
 * UserManagementPage so there is exactly one place that knows how to
 * create an employee (same createEmployee endpoint, same fields, same
 * generated-temp-password convention) rather than two independently-maintained
 * copies of this form.
 */
export default function AddEmployeeModal({ onClose, onCreated }) {
  const [activeTab, setActiveTab] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState([])
  const [allManagers, setAllManagers] = useState([])
  const [docEntries, setDocEntries] = useState(EMPTY_DOC_ENTRIES)
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null)

  useEffect(() => {
    getDepartments().then(r => setDepartments(r.data)).catch(() => {})
    getManagersList().then(r => setAllManagers(r.data)).catch(() => {})
  }, [])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const addDocEntry = () => setDocEntries(prev => [...prev, { title: '', document_type: 'Resume', file: null }])
  const removeDocEntry = (i) => setDocEntries(prev => prev.filter((_, idx) => idx !== i))
  const updateDocEntry = (i, field, val) => setDocEntries(prev => prev.map((entry, idx) => idx === i ? { ...entry, [field]: val } : entry))

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
    setProfilePhoto(file)
    const reader = new FileReader()
    reader.onload = (ev) => setProfilePhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (activeTab !== TABS.length - 1) {
      setActiveTab(t => t + 1)
      return
    }
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.employee_id?.trim()) delete payload.employee_id
      if (!payload.department_id) delete payload.department_id
      if (!payload.manager_id) delete payload.manager_id
      else payload.manager_id = parseInt(payload.manager_id)
      if (!payload.reporting_manager_name) delete payload.reporting_manager_name
      payload.base_salary = payload.base_salary ? parseFloat(payload.base_salary) : 0
      const dateFields = ['date_of_joining', 'date_of_birth', 'probation_end_date', 'passport_valid_from', 'passport_valid_to']
      dateFields.forEach(k => { if (!payload[k]) delete payload[k] })

      const res = await createEmployee(payload)
      const newEmployeeId = res.data.id

      if (profilePhoto) {
        const fd = new FormData()
        fd.append('file', profilePhoto)
        await uploadEmployeePhoto(newEmployeeId, fd)
      }

      const filledDocs = docEntries.filter(d => d.file && d.title.trim())
      for (const doc of filledDocs) {
        const fd = new FormData()
        fd.append('employee_id', newEmployeeId)
        fd.append('title', doc.title.trim())
        fd.append('document_type', doc.document_type)
        fd.append('file', doc.file)
        await uploadDocument(fd)
      }

      const tempPassword = res.data.temp_password
      toast.success(
        tempPassword ? `Employee created! Temp password: ${tempPassword}` : 'Employee created!',
        { duration: tempPassword ? 15000 : 4000 },
      )
      onCreated?.(res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create employee')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Add New Employee</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b shrink-0 px-6 overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === i
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <span className={clsx(
                'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-2',
                activeTab === i ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
              )}>{i + 1}</span>
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={e => e.preventDefault()} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-6">

            {activeTab === 0 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Basic Information</p>

                <div className="flex flex-col items-center gap-3 py-4 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-2xl shrink-0 ring-2 ring-white shadow">
                    {profilePhotoPreview ? (
                      <img src={profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span>{form.first_name?.charAt(0) || '?'}{form.last_name?.charAt(0) || ''}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <span className="btn-secondary text-xs py-1.5 px-3 inline-block">
                        {profilePhotoPreview ? 'Change Photo' : 'Upload Photo'}
                      </span>
                      <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={handlePhotoChange} />
                    </label>
                    {profilePhotoPreview && (
                      <button
                        type="button"
                        onClick={() => { setProfilePhoto(null); setProfilePhotoPreview(null) }}
                        className="text-xs py-1.5 px-3 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">JPG, JPEG, PNG or WEBP · Max 5 MB</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First Name" required>
                    <input required className="input" value={form.first_name} onChange={set('first_name')} placeholder="Enter first name" />
                  </Field>
                  <Field label="Last Name" required>
                    <input required className="input" value={form.last_name} onChange={set('last_name')} placeholder="Enter last name" />
                  </Field>
                  <Field label="Email ID" required>
                    <input required type="email" className="input" value={form.email} onChange={set('email')} placeholder="name@techdemocracy.com" />
                  </Field>
                  <Field label="Mobile Phone">
                    <input type="tel" className="input" value={form.mobile_phone} onChange={set('mobile_phone')} placeholder="91-XXXXXXXXXX" />
                  </Field>
                  <Field label="Personal Email">
                    <input type="email" className="input" value={form.personal_email} onChange={set('personal_email')} placeholder="personal@gmail.com" />
                  </Field>
                  <Field label="Work Phone">
                    <input type="tel" className="input" value={form.work_phone} onChange={set('work_phone')} placeholder="Enter work phone number" maxLength={30} />
                  </Field>
                  <Field label="Gender">
                    <select className="input" value={form.gender} onChange={set('gender')}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Field>
                </div>
                <Field label="About Me">
                  <textarea rows={3} className="input" value={form.about_me} onChange={set('about_me')} placeholder="Brief introduction about the employee..." />
                </Field>
              </div>
            )}

            {activeTab === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Work Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Employee ID">
                    <input className="input" value={form.employee_id} onChange={set('employee_id')} placeholder="e.g. CTL-0001 (leave blank to auto-generate)" />
                  </Field>
                  <Field label="Date of Joining">
                    <input type="date" className="input" value={form.date_of_joining} onChange={set('date_of_joining')} />
                  </Field>
                  <Field label="Probation End Date">
                    <input type="date" className="input" value={form.probation_end_date} onChange={set('probation_end_date')} />
                  </Field>
                  <Field label="Department">
                    <select className="input" value={form.department_id} onChange={set('department_id')}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Sub Department">
                    <input className="input" value={form.sub_department} onChange={set('sub_department')} placeholder="e.g. Frontend Team" />
                  </Field>
                  <Field label="Title / Designation">
                    <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Trainee Consultant" />
                  </Field>
                  <Field label="Job Role">
                    <input className="input" value={form.job_role} onChange={set('job_role')} placeholder="e.g. Team member" />
                  </Field>
                  <Field label="Job Level">
                    <input className="input" value={form.job_level} onChange={set('job_level')} placeholder="e.g. L1, Junior, Senior" />
                  </Field>
                  <Field label="Employment Type">
                    <select className="input" value={form.employment_type} onChange={set('employment_type')}>
                      <option>Permanent</option>
                      <option>On Contract</option>
                      <option>Temporary</option>
                      <option>Intern</option>
                    </select>
                  </Field>
                  <Field label="Source of Hire">
                    <select className="input" value={form.source_of_hire} onChange={set('source_of_hire')}>
                      <option>Direct</option>
                      <option>Referral</option>
                      <option>Agency</option>
                      <option>Job Portal</option>
                      <option>Campus</option>
                    </select>
                  </Field>
                  <Field label="Work Location">
                    <input className="input" value={form.work_location} onChange={set('work_location')} placeholder="e.g. Hyderabad" />
                  </Field>
                  <Field label="Reporting Manager">
                    <ManagerSearchDropdown
                      employees={allManagers}
                      value={form.manager_id}
                      onChange={(id, name) => setForm(f => ({ ...f, manager_id: id, reporting_manager_name: name }))}
                    />
                  </Field>
                  <Field label="System Role">
                    <select className="input" value={form.system_role} onChange={set('system_role')}>
                      <option value="Employee">{roleDisplayLabel('Employee')}</option>
                      <option value="Admin">{roleDisplayLabel('Admin')}</option>
                      <option value="Super Admin">{roleDisplayLabel('Super Admin')}</option>
                    </select>
                  </Field>
                  <Field label="Base Salary (₹)">
                    <input type="number" className="input" value={form.base_salary} onChange={set('base_salary')} placeholder="0" />
                  </Field>
                </div>
              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Personal Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Date of Birth">
                    <input type="date" className="input" value={form.date_of_birth} onChange={set('date_of_birth')} />
                  </Field>
                  <Field label="Marital Status">
                    <select className="input" value={form.marital_status} onChange={set('marital_status')}>
                      <option value="">Select</option>
                      <option>Unmarried</option>
                      <option>Married</option>
                      <option>Divorced</option>
                      <option>Widowed</option>
                    </select>
                  </Field>
                  <Field label="Father Name">
                    <input className="input" value={form.father_name} onChange={set('father_name')} />
                  </Field>
                  <Field label="Blood Group">
                    <select className="input" value={form.blood_group} onChange={set('blood_group')}>
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </Field>
                  <Field label="City">
                    <input className="input" value={form.city} onChange={set('city')} placeholder="Enter city" />
                  </Field>
                  <Field label="State">
                    <input className="input" value={form.state} onChange={set('state')} placeholder="Enter state" />
                  </Field>
                  <Field label="Country">
                    <input className="input" value={form.country} onChange={set('country')} placeholder="Enter country" />
                  </Field>
                  <Field label="Pincode">
                    <input className="input" value={form.pincode} onChange={set('pincode')} placeholder="Enter pincode" maxLength={10} />
                  </Field>
                </div>
                <Field label="Present Address">
                  <textarea rows={2} className="input" value={form.present_address} onChange={set('present_address')} placeholder="Current residential address" />
                </Field>
                <Field label="Permanent Address">
                  <textarea rows={2} className="input" value={form.permanent_address} onChange={set('permanent_address')} placeholder="Permanent address (if different)" />
                </Field>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-4 mb-2">Emergency Contacts</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Emergency Contact Name (Primary)">
                    <input className="input" value={form.emergency_contact_primary_name} onChange={set('emergency_contact_primary_name')} />
                  </Field>
                  <Field label="Emergency Contact Number (Primary)">
                    <input className="input" value={form.emergency_contact_primary_number} onChange={set('emergency_contact_primary_number')} />
                  </Field>
                  <Field label="Emergency Contact Name (Secondary)">
                    <input className="input" value={form.emergency_contact_secondary_name} onChange={set('emergency_contact_secondary_name')} />
                  </Field>
                  <Field label="Emergency Contact Number (Secondary)">
                    <input className="input" value={form.emergency_contact_secondary_number} onChange={set('emergency_contact_secondary_number')} />
                  </Field>
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Profile Summary</p>
                <Field label="Primary Skill Set">
                  <textarea rows={3} className="input" value={form.primary_skill_set} onChange={set('primary_skill_set')} placeholder="e.g. UI/UX Design, Figma, Prototyping, User Research..." />
                </Field>
                <Field label="Secondary Skill Set">
                  <textarea rows={2} className="input" value={form.secondary_skill_set} onChange={set('secondary_skill_set')} />
                </Field>
                <Field label="Other Skills">
                  <textarea rows={2} className="input" value={form.other_skills} onChange={set('other_skills')} />
                </Field>
              </div>
            )}

            {activeTab === 4 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Bank Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Bank Name">
                    <input className="input" value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. State Bank of India" />
                  </Field>
                  <Field label="Bank Account Number">
                    <input className="input" value={form.bank_account_number} onChange={set('bank_account_number')} />
                  </Field>
                  <Field label="IFSC Code">
                    <input className="input" value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="e.g. SBIN0021820" />
                  </Field>
                  <Field label="Name as Appears in Bank Account">
                    <input className="input" value={form.bank_account_holder_name} onChange={set('bank_account_holder_name')} />
                  </Field>
                </div>
                <div className="mt-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <p className="text-sm text-primary-700 font-medium">One more step!</p>
                  <p className="text-xs text-primary-500 mt-1">
                    Click <strong>Next</strong> to proceed to the Upload Docs step where you can attach documents and complete the employee record.
                    Other fields can be updated later from the employee profile.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">A unique temporary password will be generated and shown once you create this employee — share it with them securely.</p>
                </div>
              </div>
            )}

            {activeTab === 5 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Documents & Identity</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Total Experience">
                    <input className="input" value={form.total_experience} onChange={set('total_experience')} placeholder="e.g. 2 years" />
                  </Field>
                  <Field label="PAN Number">
                    <input className="input" value={form.pan_number} onChange={set('pan_number')} placeholder="ABCDE1234F" />
                  </Field>
                  <Field label="Aadhar Number">
                    <input className="input" value={form.aadhar_number} onChange={set('aadhar_number')} placeholder="XXXX XXXX XXXX" />
                  </Field>
                  <Field label="Passport Number">
                    <input className="input" value={form.passport_number} onChange={set('passport_number')} />
                  </Field>
                  <Field label="Passport Valid From">
                    <input type="date" className="input" value={form.passport_valid_from} onChange={set('passport_valid_from')} />
                  </Field>
                  <Field label="Passport Valid To">
                    <input type="date" className="input" value={form.passport_valid_to} onChange={set('passport_valid_to')} />
                  </Field>
                </div>

                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-6 mb-2">Upload Documents</p>
                <div className="space-y-3">
                  {docEntries.map((doc, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Document Title">
                          <input className="input" value={doc.title} onChange={e => updateDocEntry(i, 'title', e.target.value)} placeholder="e.g. Resume, Offer Letter" />
                        </Field>
                        <Field label="Document Type">
                          <select className="input" value={doc.document_type} onChange={e => updateDocEntry(i, 'document_type', e.target.value)}>
                            <option>Resume</option>
                            <option>Offer Letter</option>
                            <option>Experience Letter</option>
                            <option>Educational Certificate</option>
                            <option>ID Proof</option>
                            <option>Address Proof</option>
                            <option>Other</option>
                          </select>
                        </Field>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer">
                          <div className="input flex items-center gap-2 text-gray-500 hover:border-primary-400 transition-colors cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span className="text-sm truncate">{doc.file ? doc.file.name : 'Choose file…'}</span>
                          </div>
                          <input type="file" className="hidden" onChange={e => updateDocEntry(i, 'file', e.target.files[0] || null)} />
                        </label>
                        {docEntries.length > 1 && (
                          <button type="button" onClick={() => removeDocEntry(i)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Remove">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addDocEntry} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5">
                  <Plus size={15} /> Add Another Document
                </button>
                <p className="text-xs text-gray-400 mt-1">Document upload is optional. Max file size: 10 MB per file.</p>
              </div>
            )}

          </div>

          <div className="border-t px-6 py-4 flex items-center justify-between shrink-0 bg-gray-50 rounded-b-2xl">
            <p className="text-xs text-gray-400">
              Step {activeTab + 1} of {TABS.length} — {TABS[activeTab]}
            </p>
            <div className="flex gap-3">
              {activeTab > 0 && (
                <button type="button" onClick={() => setActiveTab(t => t - 1)} className="btn-secondary">
                  ← Previous
                </button>
              )}
              {activeTab < TABS.length - 1 ? (
                <button type="button" onClick={() => setActiveTab(t => t + 1)} className="btn-primary">
                  Next →
                </button>
              ) : (
                <button type="button" onClick={handleCreate} disabled={saving} className="btn-primary">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Create Employee
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
