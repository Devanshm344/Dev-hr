import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, KeyRound, CheckCircle, Users, TrendingUp, Shield, Star } from 'lucide-react'
import TechLogo from '../assets/techdemocracy-logo.svg'

const highlights = [
  { icon: Users,      value: '10,000+', label: 'Employees managed'  },
  { icon: TrendingUp, value: '500+',    label: 'Companies trust us' },
  { icon: Star,       value: '4.9/5',   label: 'Customer rating'    },
  { icon: Shield,     value: '99.9%',   label: 'System uptime'      },
]

export default function ResetPasswordPage() {
  const [searchParams]              = useSearchParams()
  const token                       = searchParams.get('token') || ''
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [errors, setErrors]                   = useState({})
  const [loading, setLoading]                 = useState(false)
  const [success, setSuccess]                 = useState(false)
  const navigate                              = useNavigate()

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing reset token.')
      navigate('/forgot-password')
    }
  }, [token, navigate])

  const validate = () => {
    const e = {}
    if (!newPassword)              e.newPassword = 'New password is required.'
    else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters.'
    if (!confirmPassword)          e.confirmPassword = 'Please confirm your password.'
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await resetPassword({ token, new_password: newPassword })
      toast.success(res.data.message)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (hasError) => ({
    background: '#f8fafc',
    border: `1.5px solid ${hasError ? '#f87171' : '#e2e8f0'}`,
    boxShadow: hasError ? '0 0 0 3px rgba(248,113,113,0.12)' : '',
  })

  const handleFocus = (e, hasError) => {
    e.target.style.border = `1.5px solid ${hasError ? '#f87171' : '#38bdf8'}`
    e.target.style.boxShadow = hasError
      ? '0 0 0 3px rgba(248,113,113,0.12)'
      : '0 0 0 3px rgba(56,189,248,0.12)'
  }

  const handleBlur = (e, hasError) => {
    e.target.style.border = `1.5px solid ${hasError ? '#f87171' : '#e2e8f0'}`
    e.target.style.boxShadow = ''
  }

  return (
    <div className="min-h-screen flex">

      {/* LEFT — gradient panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] xl:w-[42%] shrink-0 relative overflow-hidden px-14 py-12"
        style={{ background: 'linear-gradient(150deg, #bae6fd 0%, #38bdf8 28%, #0284c7 58%, #0c4a6e 100%)' }}
      >
        <div className="pointer-events-none absolute top-0 right-0 w-[380px] h-[380px] rounded-full -translate-y-1/2 translate-x-1/3"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute bottom-0 left-0 w-[340px] h-[340px] rounded-full translate-y-1/3 -translate-x-1/4"
          style={{ background: 'radial-gradient(circle, rgba(165,243,252,0.20) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <img src={TechLogo} alt="Techdemocracy" className="h-8 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }} />
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(12,42,74,0.65)' }}>
              AI-Powered · HR Platform
            </p>
            <h2 className="text-5xl xl:text-6xl font-black leading-[1.04] mb-5 tracking-tight"
              style={{ color: '#0c2a4a' }}>
              HR built<br />for people,<br />
              <span style={{ color: 'rgba(12,42,74,0.50)' }}>not processes.</span>
            </h2>
            <p className="text-base leading-relaxed max-w-xs" style={{ color: 'rgba(12,42,74,0.88)' }}>
              Automate payroll, track attendance, manage performance — all in one
              intelligent platform trusted by 500+ companies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {highlights.map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.18)' }}>
                  <Icon size={15} className="text-white" />
                </div>
                <div>
                  <div className="text-white font-black text-sm leading-none">{value}</div>
                  <div className="text-white/55 text-dense-tight mt-0.5 leading-none">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-dense-tight font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(12,42,74,0.50)' }}>
            Trusted by
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {['Accenture', 'Deloitte', 'Infosys', 'Wipro', 'TCS'].map(c => (
              <span key={c} className="text-xs font-bold" style={{ color: 'rgba(12,42,74,0.65)' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex-1 bg-white flex items-center justify-center px-10 xl:px-20 py-12">
        <div className="w-full max-w-[360px]">

          <div className="lg:hidden mb-10">
            <img src={TechLogo} alt="Techdemocracy" className="h-8 w-auto" />
          </div>

          {!success ? (
            <>
              <Link to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-8 group">
                <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
                Back to login
              </Link>

              <div className="mb-10">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)' }}>
                  <KeyRound size={20} style={{ color: '#0284c7' }} />
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                  Set new password
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Choose a strong password. It must be at least 8 characters long.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-dense font-bold text-slate-400 uppercase tracking-widest">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); if (errors.newPassword) setErrors(v => ({ ...v, newPassword: '' })) }}
                      placeholder="Min. 8 characters"
                      required
                      className="w-full rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all pr-11"
                      style={inputStyle(!!errors.newPassword)}
                      onFocus={e => handleFocus(e, !!errors.newPassword)}
                      onBlur={e => handleBlur(e, !!errors.newPassword)}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.newPassword && <p className="text-dense text-red-500">{errors.newPassword}</p>}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-dense font-bold text-slate-400 uppercase tracking-widest">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(v => ({ ...v, confirmPassword: '' })) }}
                      placeholder="Re-enter your password"
                      required
                      className="w-full rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all pr-11"
                      style={inputStyle(!!errors.confirmPassword)}
                      onFocus={e => handleFocus(e, !!errors.confirmPassword)}
                      onBlur={e => handleBlur(e, !!errors.confirmPassword)}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-dense text-red-500">{errors.confirmPassword}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-70"
                  style={{
                    background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #0c4a6e 100%)',
                    boxShadow: '0 6px 24px rgba(2,132,199,0.38)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 32px rgba(2,132,199,0.55)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(2,132,199,0.38)'}
                >
                  {loading
                    ? <><Loader2 size={15} className="animate-spin" /> Resetting…</>
                    : <>Reset Password <ArrowRight size={15} /></>
                  }
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)' }}>
                <CheckCircle size={30} style={{ color: '#16a34a' }} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Password reset!</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your password has been updated successfully. Redirecting you to the login page in a moment…
                </p>
              </div>
              <Link to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: '#0284c7' }}>
                Go to login <ArrowRight size={14} />
              </Link>
            </div>
          )}

          <p className="text-center text-dense text-slate-300 mt-10">
            © 2025 TechDemocracy. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
