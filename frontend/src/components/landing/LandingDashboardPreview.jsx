import { useEffect, useRef, useState } from 'react';
import {
  Users, Clock, Calendar, DollarSign, TrendingUp, FileText,
  Building2, GitBranch, Megaphone, Package, Settings, Bot,
  Bell, ChevronDown, CheckCircle2, BarChart2, Target, X,
} from 'lucide-react';

const leaveRows = [
  { label: 'Casual Leave',    used: 5,  total: 12,  color: 'bg-purple-500' },
  { label: 'Sick Leave',      used: 3,  total: 10,  color: 'bg-green-500'  },
  { label: 'Earned Leave',    used: 14, total: 21,  color: 'bg-orange-400' },
  { label: 'Maternity Leave', used: 0,  total: 182, color: 'bg-pink-500'   },
  { label: 'Paternity Leave', used: 6,  total: 15,  color: 'bg-cyan-500'   },
];

const sideNav = [
  { icon: BarChart2,  label: 'Dashboard' },
  { icon: Users,      label: 'Employees' },
  { icon: Clock,      label: 'Attendance' },
  { icon: Calendar,   label: 'Leave' },
  { icon: DollarSign, label: 'Payroll' },
  { icon: TrendingUp, label: 'Performance' },
  { icon: FileText,   label: 'Documents' },
  { icon: Building2,  label: 'Departments' },
  { icon: GitBranch,  label: 'Org Chart' },
  { icon: Megaphone,  label: 'Announcements' },
  { icon: Package,    label: 'Assets' },
  { icon: Settings,   label: 'HR Operation' },
];

const announcements = [
  {
    color: 'bg-orange-500',
    icon: Megaphone,
    title: 'Welcome to TechDemocracy HRMS!',
    body: 'We are excited to launch our new HR Management System. Please explore all the features.',
    by: 'Admin User · 2/6/2026',
  },
  {
    color: 'bg-indigo-500',
    icon: TrendingUp,
    title: 'Q1 Performance Reviews',
    body: 'Q1 2026 performance reviews are now open. Please complete your self-assessment by April 30.',
    by: 'Admin User · 2/6/2026',
  },
];

export default function LandingDashboardPreview() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="container-section bg-transparent" ref={ref}>
      <div className="section-container">
        <div className="text-center mb-14 reveal">
          <div className="section-tag justify-center mb-4">Live Preview</div>
          <h2 className="section-heading mb-4 text-slate-900">
            See The Dashboard{' '}
            <span className="gradient-text">In Action</span>
          </h2>
          <p className="section-subheading max-w-xl mx-auto text-slate-600">
            A pixel-perfect replica of the actual TechDemocracy HRMS — showing attendance, leave balance, and announcements at a glance.
          </p>
        </div>

        {/* Dashboard mockup */}
        <div
          className={`relative rounded-3xl border border-white/15 overflow-hidden shadow-[0_40px_120px_-30px_rgba(15,23,42,0.25)] transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ background: '#0B1722', backdropFilter: 'blur(20px)' }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand-primary flex items-center justify-center">
                <span className="text-white text-[9px] font-bold">TD</span>
              </div>
              <span className="text-white text-xs font-semibold">TechDemocracy</span>
              <div className="w-5 h-5 ml-1 rounded bg-white/10 flex items-center justify-center text-white/40">
                <span className="text-[10px]">✕</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Bell size={14} className="text-white/60" />
              <div className="flex items-center gap-1 text-[11px] text-white/70 bg-white/10 rounded-full px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                cotelligent-hrms
                <ChevronDown size={10} />
              </div>
              <span className="text-[11px] text-white/60 font-mono">04:26:53 pm</span>
              <span className="text-[11px] bg-white/10 rounded-full px-2 py-0.5 text-white/70">Human Resources</span>
            </div>
          </div>

          <div className="flex" style={{ minHeight: '420px' }}>
            {/* Sidebar */}
            <div className="w-44 border-r border-white/10 py-3 flex flex-col gap-0.5 shrink-0 hidden md:flex" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {sideNav.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => setActiveNav(label)}
                  className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer text-left
                    ${activeNav === label ? 'bg-brand-primary text-white' : 'text-white/50 hover:bg-white/10 hover:text-white/80'}`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
              <div className="mt-auto mx-2 px-3 py-2 flex items-center gap-2 border-t border-white/10 pt-3">
                <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center text-white text-[9px] font-bold">E</div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-white truncate">Employee</p>
                  <p className="text-[9px] text-white/40">Human Resources</p>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white">
                  Welcome back, <span className="text-brand-primaryLight">Employee!</span>
                </h3>
                <p className="text-[11px] text-white/50">Tuesday, 2 June 2026</p>
              </div>

              {activeNav !== 'Dashboard' ? (
                <div className="rounded-2xl bg-white/8 border border-white/10 p-10 flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: '360px', background: 'rgba(255,255,255,0.08)' }}>
                  {(() => {
                    const NavIcon = sideNav.find((n) => n.label === activeNav)?.icon ?? FileText;
                    return <NavIcon size={28} className="text-brand-primaryLight" />;
                  })()}
                  <p className="text-sm font-semibold text-white">{activeNav}</p>
                  <p className="text-[11px] text-white/40 max-w-xs">
                    The full {activeNav} module is available inside your live workspace — start a free trial to explore it.
                  </p>
                  <button onClick={() => setActiveNav('Dashboard')} className="text-[11px] text-brand-primaryLight font-semibold hover:underline mt-1">
                    ← Back to Dashboard
                  </button>
                </div>
              ) : (
                <div className="grid lg:grid-cols-3 gap-4">
                  {/* Left column */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 p-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="relative w-16 h-16 shrink-0">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                          <circle cx="32" cy="32" r="26" fill="none" stroke="#0052CC" strokeWidth="5"
                            strokeDasharray="163" strokeDashoffset={visible ? 163 - (2.5 / 8) * 163 : 163}
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out 0.3s' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-bold text-white leading-none">2.5h</span>
                          <span className="text-[9px] text-white/50">of 8h</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-white/60 mb-2">Checked in at 9:30 AM</p>
                        <button className="w-full bg-brand-primary hover:bg-brand-primaryDark rounded-xl py-2 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors">
                          <CheckCircle2 size={13} /> Check Out
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-white">Leave Balance</h4>
                        <Calendar size={12} className="text-white/40" />
                      </div>
                      <div className="space-y-2.5">
                        {leaveRows.map((l, i) => (
                          <div key={l.label}>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-white/70">{l.label}</span>
                              <span className="text-white/50">{l.used} / {l.total} days</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${l.color} rounded-full transition-all duration-1000`}
                                style={{ width: visible ? `${(l.used / l.total) * 100}%` : '0%', transitionDelay: `${0.3 + i * 0.1}s` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Middle column */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-white">Weekly Attendance</h4>
                        <span className="text-[10px] text-brand-primaryLight">This week</span>
                      </div>
                      <div className="flex items-end gap-2 h-20 mb-2">
                        {[6, 8, 7.5, 8, 6.5, 4, 0].map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t-md bg-brand-primary/60 transition-all duration-700"
                              style={{ height: visible ? `${(h / 8) * 100}%` : '0%', transitionDelay: `${0.2 + i * 0.08}s`, minHeight: h > 0 ? '4px' : '0' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[9px] text-white/40">
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[{ v: '8.4h', l: 'Avg/Day' }, { v: '42h', l: 'This Week' }, { v: '2h', l: 'Overtime' }].map(s => (
                          <div key={s.l} className="text-center">
                            <p className="text-sm font-bold text-white">{s.v}</p>
                            <p className="text-[9px] text-white/50">{s.l}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-white">Announcements</h4>
                        <span className="text-[10px] bg-brand-primary text-white rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
                      </div>
                      <div className="space-y-3">
                        {announcements.map((a) => (
                          <div key={a.title} className="flex gap-2.5">
                            <div className={`w-7 h-7 ${a.color} rounded-xl flex items-center justify-center shrink-0`}>
                              <a.icon size={13} className="text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-white truncate">{a.title}</p>
                              <p className="text-[10px] text-white/50 line-clamp-1">{a.body}</p>
                              <p className="text-[9px] text-white/30 mt-0.5">{a.by}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-white">Payroll Snapshot</h4>
                        <DollarSign size={12} className="text-white/40" />
                      </div>
                      <p className="text-2xl font-bold text-white leading-none">$4,820</p>
                      <p className="text-[10px] text-white/50 mb-3">Estimated net pay</p>
                      <div className="flex items-center justify-between text-[10px] rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-white/60">Next payslip</span>
                        <span className="text-brand-primaryLight font-semibold">June 30, 2026</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-white">Performance</h4>
                        <Target size={12} className="text-white/40" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="relative w-14 h-14 shrink-0">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                            <circle cx="32" cy="32" r="26" fill="none" stroke="#00B4FF" strokeWidth="5"
                              strokeDasharray="163" strokeDashoffset={visible ? 163 - 0.72 * 163 : 163}
                              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out 0.4s' }} />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">72%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-white">Q2 Review Cycle</p>
                          <p className="text-[10px] text-white/50">Self-assessment in progress</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ask AI fab */}
          <div className="absolute bottom-5 right-5">
            {aiOpen && (
              <div className="mb-3 w-60 rounded-2xl bg-[#0B1722] border border-white/15 shadow-2xl p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                    <Bot size={13} className="text-brand-primaryLight" /> AI Assistant
                  </p>
                  <button onClick={() => setAiOpen(false)} aria-label="Close" className="text-white/40 hover:text-white">
                    <X size={13} />
                  </button>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  You have 5 casual leave days left and your next payslip lands June 30. Want me to draft a leave request?
                </p>
              </div>
            )}
            <button
              onClick={() => setAiOpen((o) => !o)}
              className={`bg-brand-primary hover:bg-brand-primaryDark text-white text-xs font-semibold rounded-full px-4 py-2 shadow-lg flex items-center gap-1.5 transition-colors ${aiOpen ? '' : 'animate-float'}`}
            >
              <Bot size={13} /> Ask AI
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
