import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { login, verifyMfaLogin } from '../services/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, ArrowRight, ChevronDown } from 'lucide-react'
import TechLogo from '../assets/techdemocracy-logo.svg'

// Quick demo access — one fixed account per tier, all sharing the dev-hr
// demo password. Lets anyone open a role's dashboard in one click without
// knowing real credentials. "Manager" isn't an RBAC tier (system_role is
// still Employee) — it's someone with direct reports via Employee.manager_id,
// which unlocks a genuinely different dashboard (team leave approvals, etc).
// Labels here are picker-specific (kept as "Super Admin"/"Human Resources"
// so the two admin tiers stay distinguishable) — independent of
// roleDisplayLabel(), which drives the role label elsewhere in the app.
const DEMO_ACCOUNTS = [
  { role: 'Super Admin', label: 'Super Admin',     email: 'nisha.biswas@devhr.com' },
  { role: 'Admin',       label: 'Human Resources', email: 'sagar.ghosh@devhr.com' },
  { role: 'Manager',     label: 'Manager',         email: 'akash.menon@devhr.com' },
  { role: 'Employee',    label: 'Employee',        email: 'rakesh.subramaniam@devhr.com' },
]
const DEMO_PASSWORD = 'demo@123'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [demoRole, setDemoRole] = useState(null)
  const [emailError, setEmailError] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [mfaCode, setMfaCode]   = useState('')
  const [verifyingMfa, setVerifyingMfa] = useState(false)
  const { login: storeLogin }   = useAuthStore()
  const navigate                = useNavigate()

  const finishLogin = (data, welcomeName) => {
    storeLogin(data.user, data.access_token)
    toast.success(`Welcome, ${welcomeName}!`)
    navigate('/')
  }

  const validateEmail = (value) => {
    if (!value) return 'Work email is required.'
    if (!value.toLowerCase().endsWith('@devhr.com')) return 'Only @devhr.com email addresses are allowed.'
    return ''
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (emailError) setEmailError(validateEmail(e.target.value))
  }

  const handleEmailBlur = () => setEmailError(validateEmail(email))

  const handleLogin = async (e) => {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) { setEmailError(err); return }
    setLoading(true)
    try {
      const res = await login({ email, password })
      if (res.data.mfa_required) {
        setMfaChallenge(res.data.challenge_token)
        return
      }
      finishLogin(res.data, res.data.user.name)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async (account) => {
    setDemoRole(account.role)
    try {
      const res = await login({ email: account.email, password: DEMO_PASSWORD })
      if (res.data.mfa_required) {
        setMfaChallenge(res.data.challenge_token)
        return
      }
      finishLogin(res.data, `${res.data.user.name}! (${account.label} demo)`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Demo login failed')
    } finally {
      setDemoRole(null)
    }
  }

  const handleVerifyMfa = async (e) => {
    e.preventDefault()
    setVerifyingMfa(true)
    try {
      const res = await verifyMfaLogin(mfaChallenge, mfaCode)
      finishLogin(res.data, res.data.user.name)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Incorrect authenticator code')
    } finally {
      setVerifyingMfa(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ══════════════════════════════════════
          LEFT — Sky/cyan gradient panel
      ══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] xl:w-[42%] shrink-0 relative overflow-hidden px-14 py-12"
        style={{ background: 'linear-gradient(150deg, #bae6fd 0%, #38bdf8 28%, #0284c7 58%, #0c4a6e 100%)' }}>

        {/* Overlay blobs for depth */}
        <div className="pointer-events-none absolute top-0 right-0 w-[380px] h-[380px] rounded-full -translate-y-1/2 translate-x-1/3"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute bottom-0 left-0 w-[340px] h-[340px] rounded-full translate-y-1/3 -translate-x-1/4"
          style={{ background: 'radial-gradient(circle, rgba(165,243,252,0.20) 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10">
          <img src={TechLogo} alt="Techdemocracy" className="h-8 w-auto"
            style={{ filter: 'brightness(0)' }} />
        </div>

        {/* Center tagline */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="space-y-5">
            <div className="w-10 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
            <p className="font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '20px' }}>
              Cotelligent · A TechDemocracy Company
            </p>
            <h2 className="text-3xl xl:text-4xl font-black leading-snug tracking-tight" style={{ color: '#fff' }}>
              Comprehensive Cyber<br />Risk Assurance &amp;<br />
              <span style={{ color: 'rgba(255,255,255,0.60)' }}>Identity Management.</span>
            </h2>
            <p className="leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '15px' }}>
              Delivering end-to-end services and solutions to enterprises of all sizes.
            </p>
          </div>
        </div>

        {/* Spacer */}
        <div className="relative z-10 h-12" />

      </div>

      {/* ══════════════════════════════════════
          RIGHT — Pure white form (no card)
      ══════════════════════════════════════ */}
      <div className="flex-1 bg-white flex items-center justify-center px-10 xl:px-20 py-12">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <img src={TechLogo} alt="Techdemocracy" className="h-8 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Welcome Back.
            </h1>
          </div>

          {/* ══════════════════════════════════════
              Quick demo access — one click per role
          ══════════════════════════════════════ */}
          <div className="mb-8">
            <p className="text-dense font-bold text-slate-400 uppercase tracking-widest mb-2.5">
              Quick Demo Access
            </p>
            <div className="relative">
              <select
                value=""
                disabled={demoRole !== null}
                onChange={e => {
                  const account = DEMO_ACCOUNTS.find(a => a.role === e.target.value)
                  if (account) handleDemoLogin(account)
                }}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60 cursor-pointer transition-all"
                style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <option value="" disabled>Select a role to sign in…</option>
                {DEMO_ACCOUNTS.map(({ role, label }) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
              {demoRole !== null
                ? <Loader2 size={16} className="animate-spin text-sky-600 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                : <ChevronDown size={16} className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              }
            </div>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-dense-tight font-semibold text-slate-300 uppercase tracking-widest">or sign in manually</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Form — no card, just floating on white */}
          {mfaChallenge ? (
            <form onSubmit={handleVerifyMfa} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-dense font-bold text-slate-400 uppercase tracking-widest">
                  Authenticator Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  required
                  className="w-full rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all tracking-[0.3em] text-center font-bold"
                  style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}
                />
                <p className="text-dense text-slate-400">Enter the code from your authenticator app.</p>
              </div>
              <button
                type="submit"
                disabled={verifyingMfa || mfaCode.length !== 6}
                className="w-full text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #0c4a6e 100%)',
                  boxShadow: '0 6px 24px rgba(2,132,199,0.38)',
                }}
              >
                {verifyingMfa
                  ? <><Loader2 size={15} className="animate-spin" /> Verifying…</>
                  : <>Verify <ArrowRight size={15} /></>
                }
              </button>
              <button
                type="button"
                onClick={() => { setMfaChallenge(null); setMfaCode('') }}
                className="w-full text-dense text-slate-400 hover:text-slate-600 text-center"
              >
                Back to login
              </button>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="space-y-5">

            <div className="space-y-1.5">
              <label className="text-dense font-bold text-slate-400 uppercase tracking-widest">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@devhr.com"
                required
                className="w-full rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all"
                style={{
                  background: '#f8fafc',
                  border: `1.5px solid ${emailError ? '#f87171' : '#e2e8f0'}`,
                  boxShadow: emailError ? '0 0 0 3px rgba(248,113,113,0.12)' : '',
                }}
                onFocus={e => {
                  e.target.style.border = `1.5px solid ${emailError ? '#f87171' : '#38bdf8'}`
                  e.target.style.boxShadow = emailError ? '0 0 0 3px rgba(248,113,113,0.12)' : '0 0 0 3px rgba(56,189,248,0.12)'
                }}
                onBlur={e => {
                  handleEmailBlur()
                  e.target.style.border = `1.5px solid ${emailError ? '#f87171' : '#e2e8f0'}`
                  e.target.style.boxShadow = ''
                }}
              />
              {emailError && (
                <p className="text-dense text-red-500 mt-1">{emailError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-dense font-bold text-slate-400 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all pr-11"
                  style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}
                  onFocus={e => { e.target.style.border = '1.5px solid #38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.12)' }}
                  onBlur={e => { e.target.style.border = '1.5px solid #e2e8f0'; e.target.style.boxShadow = '' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
                ? <><Loader2 size={15} className="animate-spin" /> Signing in…</>
                : <>Continue <ArrowRight size={15} /></>
              }
            </button>
          </form>
          )}

          <p className="text-dense text-slate-300 mt-10 text-center">
            © 2025 TechDemocracy. All rights reserved.
          </p>
        </div>
      </div>

    </div>
  )
}
