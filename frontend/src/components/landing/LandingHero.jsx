import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Users, Clock, Calendar, DollarSign, TrendingUp, FileText,
  CheckCircle2, ShieldCheck, CreditCard,
} from 'lucide-react';

const sidebarItems = [
  { icon: Users,      label: 'Employees' },
  { icon: Clock,      label: 'Attendance' },
  { icon: Calendar,   label: 'Leave' },
  { icon: DollarSign, label: 'Payroll' },
  { icon: TrendingUp, label: 'Performance' },
  { icon: FileText,   label: 'Documents' },
];

const leaveData = [
  { label: 'Casual Leave',  used: 12, total: 12, color: 'bg-purple-500', pct: 100 },
  { label: 'Sick Leave',    used: 10, total: 10, color: 'bg-green-500',  pct: 100 },
  { label: 'Earned Leave',  used: 15, total: 21, color: 'bg-orange-400', pct: 71  },
  { label: 'Maternity',     used: 90, total: 182,color: 'bg-pink-500',   pct: 49  },
];

function CountUp({ end, suffix = '', duration = 1500 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{value.toLocaleString()}{suffix}</span>;
}

export default function LandingHero() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -8, y: px * 10 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <section
      className="relative overflow-hidden pt-28 pb-24 md:pt-32 md:pb-28"
      style={{ background: '#FFFFFF' }}
    >
      <div className="section-container relative">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Left copy */}
          <div className="animate-fade-in-left relative z-10">
            <h1 className="section-heading mb-6 text-slate-900 leading-snug space-y-2">
              <span className="block">Complete HRMS</span>
              <span className="gradient-text block">Built For Modern Enterprises</span>
            </h1>

            <p className="section-subheading mb-8 max-w-xl text-slate-600">
              Manage your entire workforce — attendance, payroll, leave, performance, and more — from one powerful, AI-driven platform.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <button onClick={() => navigate('/login')} className="btn-primary">
                Start Free Trial
                <ArrowRight size={18} />
              </button>
              <a href="#modules" className="btn-secondary">
                See All Modules
              </a>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                { icon: CreditCard,  label: 'No credit card required' },
                { icon: Clock,       label: 'Setup in under 24 hours' },
                { icon: ShieldCheck, label: 'GDPR & SOC 2 compliant' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3.5 py-2 shadow-sm"
                >
                  <Icon size={14} className="text-brand-primary shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right – dashboard mockup */}
          <div className="animate-fade-in-right relative z-10" style={{ perspective: '1200px' }}>
            <div
              ref={panelRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="hero-panel bg-[#0B1722]/95 animate-border-glow"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: 'transform 0.2s ease-out',
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="absolute -top-8 left-10 w-24 h-24 rounded-full bg-brand-primary/20 blur-3xl" />
              <div className="absolute bottom-8 right-8  w-28 h-28 rounded-full bg-brand-secondary/20 blur-3xl" />

              <div className="relative flex gap-3">
                {/* Mini sidebar */}
                <div className="hidden sm:flex flex-col gap-2 pt-1">
                  <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center mb-1">
                    <span className="text-white text-[10px] font-bold">TD</span>
                  </div>
                  {sidebarItems.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      title={label}
                      className="w-8 h-8 rounded-xl bg-white/10 hover:bg-brand-primary/40 flex items-center justify-center transition-colors duration-200 cursor-pointer"
                    >
                      <Icon size={14} className="text-white/70" />
                    </div>
                  ))}
                </div>

                {/* Main panel content */}
                <div className="flex-1 space-y-3 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-[11px] text-white/50">Welcome back,</p>
                      <p className="text-sm font-semibold text-white">Employee!</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-glow" />
                      <span className="text-[10px] text-white/60 font-mono">04:26:53 PM</span>
                    </div>
                  </div>

                  {/* Check-in widget */}
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-3 flex items-center gap-3">
                    <div className="relative w-14 h-14 shrink-0">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                        <circle cx="28" cy="28" r="23" fill="none" stroke="#0052CC" strokeWidth="4"
                          strokeDasharray="144" strokeDashoffset="144" strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-white leading-none">0.0h</span>
                        <span className="text-[9px] text-white/50">of 8h</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/60 mb-1.5">Not checked in yet</p>
                      <div className="bg-brand-primary rounded-xl py-1.5 px-3 text-center text-xs font-semibold text-white flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={12} />
                        Check In
                      </div>
                    </div>
                  </div>

                  {/* Leave balance */}
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-white/80">Leave Balance</p>
                      <Calendar size={12} className="text-white/40" />
                    </div>
                    <div className="space-y-2">
                      {leaveData.map((l) => (
                        <div key={l.label}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-white/60">{l.label}</span>
                            <span className="text-white/40">{l.used}/{l.total}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${l.color} rounded-full animate-progress`}
                              style={{ width: `${l.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[{ v: '8.4h', l: 'Avg/Day' }, { v: '42h', l: 'This Week' }, { v: '2h', l: 'Overtime' }].map((s) => (
                      <div key={s.l} className="rounded-xl bg-white/10 border border-white/10 p-2 text-center">
                        <p className="text-sm font-bold text-white">{s.v}</p>
                        <p className="text-[9px] text-white/50">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-float">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">+<CountUp end={42} suffix="%" /></p>
                <p className="text-[10px] text-slate-500">HR Efficiency</p>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 animate-float-delay">
              <p className="text-xs font-bold text-slate-800"><CountUp end={10000} suffix="+" /></p>
              <p className="text-[10px] text-slate-500">Employees Managed</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
