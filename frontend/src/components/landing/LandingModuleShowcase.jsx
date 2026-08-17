import { useState } from 'react';
import {
  Users, Clock, Calendar, DollarSign, TrendingUp, FileText,
  Building2, GitBranch, Megaphone, Package, Settings, Bot, ArrowRight,
} from 'lucide-react';

const modules = [
  {
    icon: Users,      label: 'Employees',    color: 'bg-blue-500',
    desc: 'Complete employee lifecycle — profiles, documents, onboarding, and offboarding in one place.',
    highlights: ['Digital employee profiles', 'Document management', 'Onboarding workflows', 'Exit management'],
  },
  {
    icon: Clock,      label: 'Attendance',   color: 'bg-green-500',
    desc: 'Real-time attendance with geo-fencing, biometric support, and shift scheduling.',
    highlights: ['Live check-in / check-out', 'Geo-fencing & biometric', 'Shift scheduling', 'Overtime tracking'],
  },
  {
    icon: Calendar,   label: 'Leave',        color: 'bg-purple-500',
    desc: 'Streamlined leave management with multi-level approvals and balance tracking.',
    highlights: ['Multi-level approvals', 'Holiday calendar', 'Leave encashment', 'Balance reporting'],
  },
  {
    icon: DollarSign, label: 'Payroll',      color: 'bg-yellow-500',
    desc: 'Fully automated payroll with statutory compliance, tax calculations, and payslips.',
    highlights: ['Auto salary computation', 'TDS / PF / ESI', 'Digital payslips', 'Compliance reports'],
  },
  {
    icon: TrendingUp, label: 'Performance',  color: 'bg-orange-500',
    desc: '360° performance reviews, KPI tracking, and appraisal cycles aligned to business goals.',
    highlights: ['360° feedback', 'KPI & goal tracking', 'Appraisal cycles', 'Rating bell curves'],
  },
  {
    icon: FileText,   label: 'Documents',    color: 'bg-pink-500',
    desc: 'Secure digital locker for all HR documents with e-signing and expiry alerts.',
    highlights: ['Digital document storage', 'E-signatures', 'Expiry alerts', 'Policy distribution'],
  },
  {
    icon: Building2,  label: 'Departments',  color: 'bg-cyan-500',
    desc: 'Manage departments, headcount planning, and reporting structures effortlessly.',
    highlights: ['Department structure', 'Headcount planning', 'Budget tracking', 'Reporting lines'],
  },
  {
    icon: GitBranch,  label: 'Org Chart',    color: 'bg-indigo-500',
    desc: 'Dynamic org charts with drill-down views, role mapping, and export capabilities.',
    highlights: ['Interactive hierarchy', 'Drill-down views', 'Role mapping', 'PDF/PNG export'],
  },
  {
    icon: Megaphone,  label: 'Announcements',color: 'bg-red-500',
    desc: 'Broadcast company updates, team messages, and track who has read them.',
    highlights: ['Company-wide broadcasts', 'Targeted team posts', 'Read receipts', 'Priority flags'],
  },
  {
    icon: Package,    label: 'Assets',       color: 'bg-teal-500',
    desc: 'Track and manage company assets assigned to employees from allocation to return.',
    highlights: ['Asset assignment', 'Lifecycle tracking', 'Maintenance logs', 'Return workflows'],
  },
  {
    icon: Settings,   label: 'HR Operations',color: 'bg-slate-500',
    desc: 'Generate HR letters, manage compliance workflows, and handle day-to-day HR tasks.',
    highlights: ['Letter generation', 'Compliance tracking', 'Checklists', 'Workflow automation'],
  },
  {
    icon: Bot,        label: 'Ask AI',       color: 'bg-brand-primary',
    desc: 'Get instant answers on policies, leave balances, reports, and HR processes via AI.',
    highlights: ['Natural language queries', 'Policy lookups', 'Report generation', 'Smart suggestions'],
  },
];

export default function LandingModuleShowcase() {
  const [active, setActive] = useState(0);
  const mod = modules[active];

  return (
    <section id="modules" className="container-section bg-transparent">
      <div className="section-container">
        <div className="text-center mb-14 reveal">
          <div className="section-tag justify-center mb-4">Module Explorer</div>
          <h2 className="section-heading mb-4 text-slate-900">
            Pick A Module,{' '}
            <span className="gradient-text">Explore What It Does</span>
          </h2>
          <p className="section-subheading max-w-xl mx-auto text-slate-600">
            Click any module to see exactly what TechDemocracy HRMS delivers for that area.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Module grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {modules.map((m, i) => (
              <button
                key={m.label}
                onClick={() => setActive(i)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200
                  ${active === i
                    ? 'border-brand-primary bg-brand-primary/10 shadow-[0_0_30px_-5px_rgba(0,82,204,0.25)]'
                    : 'border-slate-200 bg-white hover:border-brand-primary/30 hover:bg-slate-50'
                  }`}
              >
                <div className={`w-10 h-10 ${m.color} rounded-xl flex items-center justify-center`}>
                  <m.icon size={18} className="text-white" />
                </div>
                <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div key={active} className="surface-panel-strong rounded-3xl p-8 min-h-[280px] animate-panel-fade">
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-14 h-14 ${mod.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                <mod.icon size={26} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{mod.label}</h3>
                <p className="text-sm text-slate-500">HRMS Module</p>
              </div>
            </div>

            <p className="text-slate-600 mb-6 leading-relaxed">{mod.desc}</p>

            <ul className="space-y-3 mb-7">
              {mod.highlights.map((h, i) => (
                <li
                  key={h}
                  className="flex items-center gap-3 text-sm text-slate-600 animate-slide-up"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
                  {h}
                </li>
              ))}
            </ul>

            <a href="#" className="inline-flex items-center gap-2 text-brand-primary font-semibold text-sm hover:gap-3 transition-all">
              Learn more about {mod.label} <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
