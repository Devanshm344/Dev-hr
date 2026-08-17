import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { changePassword, getMe, enrollMfa, verifyMfaEnroll, disableMfa } from '../services/api'
import { User, Lock, Eye, EyeOff, Loader2, CheckCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const [mfaEnabled, setMfaEnabled] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [enrollCode, setEnrollCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disabling, setDisabling] = useState(false)

  useEffect(() => {
    getMe().then(r => setMfaEnabled(r.data.mfa_enabled)).catch(() => {})
  }, [])

  const handleStartEnroll = async () => {
    setEnrolling(true)
    try {
      const res = await enrollMfa()
      setEnrollData(res.data)
    } catch {
      toast.error('Failed to start MFA enrollment')
      setEnrolling(false)
    }
  }

  const handleVerifyEnroll = async (e) => {
    e.preventDefault()
    setVerifying(true)
    try {
      await verifyMfaEnroll(enrollCode)
      toast.success('Authenticator app enabled!')
      setMfaEnabled(true)
      setEnrolling(false)
      setEnrollData(null)
      setEnrollCode('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Incorrect code')
    } finally {
      setVerifying(false)
    }
  }

  const handleDisableMfa = async (e) => {
    e.preventDefault()
    setDisabling(true)
    try {
      await disableMfa(disablePassword)
      toast.success('Authenticator app disabled')
      setMfaEnabled(false)
      setShowDisableForm(false)
      setDisablePassword('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to disable MFA')
    } finally {
      setDisabling(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('New passwords do not match')
      return
    }
    setSaving(true)
    try {
      await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password })
      toast.success('Password changed successfully!')
      setShowPwForm(false)
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to change password')
    } finally { setSaving(false) }
  }

  const InfoItem = ({ label, value }) => (
    <div className="flex justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500">Your personal account information</p>
      </div>

      {/* Avatar & Name */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-600 to-secondary-400 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary-200">
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h2 className="text-heading text-gray-900">{user?.name}</h2>
            <p className="text-gray-500">{user?.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full font-medium">{user?.employee_id}</span>
              <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium">Employee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <User size={16} className="text-primary-600" /> Account Details
        </h3>
        <div>
          <InfoItem label="Full Name" value={user?.name} />
          <InfoItem label="Email" value={user?.email} />
          <InfoItem label="Employee ID" value={user?.employee_id} />
          <InfoItem label="Role" value="Employee" />
          <InfoItem label="Designation" value={user?.title} />
          <InfoItem label="Department" value={user?.department} />
        </div>
      </div>

      {/* Security */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Lock size={16} className="text-primary-600" /> Security
          </h3>
          <button onClick={() => setShowPwForm(!showPwForm)} className="btn-secondary text-xs py-1.5">
            {showPwForm ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {!showPwForm ? (
          <p className="text-sm text-gray-400">••••••••••••  <span className="text-gray-500 ml-2">Password set</span></p>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-3 mt-2">
            <div>
              <label className="label">Current Password</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} required className="input pr-10"
                  value={pwForm.current_password} onChange={e => setPwForm({...pwForm, current_password: e.target.value})} />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} required className="input pr-10"
                  value={pwForm.new_password} onChange={e => setPwForm({...pwForm, new_password: e.target.value})} />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" required className="input"
                value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Update Password
            </button>
          </form>
        )}
      </div>

      {/* Authenticator App (MFA) */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary-600" /> Authenticator App
          </h3>
          {mfaEnabled === false && !enrolling && (
            <button onClick={handleStartEnroll} className="btn-secondary text-xs py-1.5">Enable</button>
          )}
          {mfaEnabled === true && (
            <button onClick={() => setShowDisableForm(v => !v)} className="btn-secondary text-xs py-1.5">
              {showDisableForm ? 'Cancel' : 'Disable'}
            </button>
          )}
        </div>

        {mfaEnabled === null && <p className="text-sm text-gray-400">Loading…</p>}

        {mfaEnabled === true && !showDisableForm && (
          <p className="text-sm text-gray-500">
            <span className="text-success-600 font-medium">Enabled</span> — a code from your authenticator app
            is required at login.
          </p>
        )}

        {mfaEnabled === true && showDisableForm && (
          <form onSubmit={handleDisableMfa} className="space-y-3 mt-2">
            <div>
              <label className="label">Current Password</label>
              <input type="password" required className="input"
                value={disablePassword} onChange={e => setDisablePassword(e.target.value)} />
            </div>
            <button type="submit" disabled={disabling} className="btn-danger">
              {disabling ? <Loader2 size={16} className="animate-spin" /> : null}
              Disable Authenticator App
            </button>
          </form>
        )}

        {mfaEnabled === false && !enrolling && (
          <p className="text-sm text-gray-400">Not enabled — add a second factor for extra login security.</p>
        )}

        {enrolling && (
          <div className="mt-2 space-y-3">
            {!enrollData ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Generating your QR code…
              </div>
            ) : (
              <form onSubmit={handleVerifyEnroll} className="space-y-3">
                <p className="text-sm text-gray-600">Scan this with an authenticator app (Google Authenticator, Authy, etc.):</p>
                <img src={enrollData.qr_code_base64} alt="MFA QR code" className="w-40 h-40 border border-gray-100 rounded-lg" />
                <p className="text-dense text-gray-400">Or enter this key manually: <span className="font-mono">{enrollData.secret}</span></p>
                <div>
                  <label className="label">6-digit code</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} required
                    className="input" placeholder="000000"
                    value={enrollCode} onChange={e => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={verifying || enrollCode.length !== 6} className="btn-primary text-sm">
                    {verifying ? <Loader2 size={14} className="animate-spin" /> : 'Verify & Enable'}
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => { setEnrolling(false); setEnrollData(null); setEnrollCode('') }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
