import { useEffect, useRef, useState } from 'react';
import { Shield, Users, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const roles = [
  {
    id: 'admin',
    icon: Shield,
    label: 'HR Admin',
    color: 'bg-blue-500',
    tagline: 'Full control over your entire workforce',
    desc: "HR Admins get a bird's eye view of the organisation — manage everything from payroll runs to compliance reports from a single dashboard.",
    capabilities: [
      'Manage all employee records & documents',
      'Run payroll and generate payslips',
      'Configure leave policies & approval chains',
      'View org-wide attendance & reports',
      'Broadcast company announcements',
      'Track assets and HR operations',
    ],
    visual: {
      title: 'Admin Dashboard',
      stats: [
        { label: 'Total Employees',   value: '1,248', delta: '+12 this month',    up: true  },
        { label: 'Payroll Processed', value: '₹24.6L',delta: 'On time',           up: true  },
        { label: 'Pending Approvals', value: '7',     delta: 'Leave requests',    up: false },
        { label: 'Open Positions',    value: '14',    delta: 'Actively hiring',   up: true  },
      ],
    },
  },
  {
    id: 'manager',
    icon: Users,
    label: 'Team Manager',
    color: 'bg-purple-500',
    tagline: 'Lead your team with complete visibility',
    desc: 'Managers can approve leave, monitor attendance, conduct performance reviews, and stay on top of team activities — all without leaving the platform.',
    capabilities: [
      'Approve or reject team leave requests',
      'View team attendance in real-time',
      'Conduct 360° performance reviews',
      'Set and track team KPIs & goals',
      'Access team documents & org chart',
      'Post team-level announcements',
    ],
    visual: {
      title: 'Team Overview',
      stats: [
        { label: 'Team Members',    value: '18',   delta: '2 on leave today',    up: false },
        { label: 'Present Today',   value: '16',   delta: '88% attendance',      up: true  },
        { label: 'Pending Reviews', value: '4',    delta: 'Q1 appraisals',       up: false },
        { label: 'Goal Completion', value: '74%',  delta: '+6% vs last month',   up: true  },
      ],
    },
  },
  {
    id: 'employee',
    icon: User,
    label: 'Employee',
    color: 'bg-green-500',
    tagline: 'Everything you need, right at your fingertips',
    desc: 'Employees have a clean self-service portal to check in, apply for leave, view payslips, update details, and interact with HR — without raising a single ticket.',
    capabilities: [
      'Check in / check out with one click',
      'Apply for leave & track approvals',
      'Download payslips & tax documents',
      'View and update personal profile',
      'Access company policies & announcements',
      'Chat with AI for instant HR help',
    ],
    visual: {
      title: 'My Dashboard',
      stats: [
        { label: 'This Month Hours', value: '162h', delta: '+4h overtime',       up: true  },
        { label: 'Leave Balance',    value: '8d',   delta: 'Casual + Earned',    up: true  },
        { label: 'Last Payslip',     value: '₹62K', delta: 'May 2026',           up: true  },
        { label: 'Pending Tasks',    value: '2',    delta: 'Complete profile',   up: false },
      ],
    },
  },
];

export default function LandingSolutions() {
  const navigate = useNavigate();
  const [active, setActive] = useState('admin');
  const role = roles.find(r => r.id === active) || roles[0];
  const tabRefs = useRef({});
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[active];
    if (el) setPillStyle({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  return (
    <section id="solutions" className="container-section bg-transparent">
      <div className="section-container">
        <div className="text-center mb-14 reveal">
          <div className="section-tag justify-center mb-4">Built for Every Role</div>
          <h2 className="section-heading mb-4 text-slate-900">
            One Platform,{' '}
            <span className="gradient-text">Tailored Experiences</span>
          </h2>
          <p className="section-subheading max-w-xl mx-auto text-slate-600">
            Whether you're an HR Admin, a Team Manager, or an Employee — TechDemocracy adapts to exactly what you need.
          </p>
        </div>

        {/* Role tabs */}
        <div className="relative flex justify-center gap-3 mb-10">
          <div className="tab-pill" style={{ left: pillStyle.left, width: pillStyle.width }} />
          {roles.map(r => (
            <button
              key={r.id}
              ref={(el) => { tabRefs.current[r.id] = el; }}
              onClick={() => setActive(r.id)}
              className={`role-tab flex items-center gap-2 ${active === r.id ? 'active' : ''}`}
            >
              <r.icon size={15} />
              {r.label}
            </button>
          ))}
        </div>

        {/* Role detail */}
        <div key={active} className="grid lg:grid-cols-2 gap-10 items-start animate-panel-fade">
          <div>
            <div className={`w-14 h-14 ${role.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg`}>
              <role.icon size={26} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{role.label}</h3>
            <p className="text-brand-primary font-semibold mb-4">{role.tagline}</p>
            <p className="text-slate-600 mb-7 leading-relaxed">{role.desc}</p>

            <ul className="space-y-3 mb-8">
              {role.capabilities.map((c, i) => (
                <li
                  key={c}
                  className="flex items-start gap-3 text-slate-600 text-sm animate-slide-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                  {c}
                </li>
              ))}
            </ul>

            <button onClick={() => navigate('/login')} className="btn-primary inline-flex">
              Get started as {role.label}
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Stats card */}
          <div
            className="relative rounded-3xl p-7 overflow-hidden"
            style={{ backgroundColor: 'rgba(11, 23, 34, 0.95)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}
          >
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-5">{role.visual.title}</p>
            <div className="grid grid-cols-2 gap-4">
              {role.visual.stats.map((s, i) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand-primaryLight/40 animate-scale-in"
                  style={{ animationDelay: `${i * 0.08}s`, background: 'rgba(255,255,255,0.08)' }}
                >
                  <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-white mb-1">{s.value}</p>
                  <p className={`text-[11px] flex items-center gap-1 ${s.up ? 'text-green-400' : 'text-orange-400'}`}>
                    <span>{s.up ? '↑' : '●'}</span>
                    {s.delta}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-white/60">Live data · updates every 60 seconds</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
