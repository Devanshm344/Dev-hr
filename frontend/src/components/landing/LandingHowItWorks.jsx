import { useEffect, useRef, useState } from 'react';
import { Building2, Users, Settings2, Rocket } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Building2,
    title: 'Set Up Your Company',
    desc: 'Create your organisation profile, define departments, designations, pay grades, and leave policies in minutes.',
    color: 'bg-blue-500',
  },
  {
    num: '02',
    icon: Users,
    title: 'Add Your Employees',
    desc: 'Bulk-import employees via CSV or invite them by email. Auto-assign roles, departments, and reporting managers.',
    color: 'bg-purple-500',
  },
  {
    num: '03',
    icon: Settings2,
    title: 'Configure Your Modules',
    desc: 'Turn on Attendance, Payroll, Leave, Performance, and any other modules you need. Each one is ready in clicks.',
    color: 'bg-orange-500',
  },
  {
    num: '04',
    icon: Rocket,
    title: 'Go Live in 24 Hours',
    desc: 'Your HRMS is live. Employees check in, managers approve, admins run payroll — all from day one.',
    color: 'bg-green-500',
  },
];

export default function LandingHowItWorks() {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="container-section bg-transparent" ref={sectionRef}>
      <div className="section-container">
        <div className="text-center mb-16 reveal">
          <div className="section-tag justify-center mb-4">Simple Onboarding</div>
          <h2 className="section-heading mb-4 text-slate-900">
            Up And Running{' '}
            <span className="gradient-text">In 4 Easy Steps</span>
          </h2>
          <p className="section-subheading max-w-xl mx-auto text-slate-600">
            No lengthy implementations. No consultants. Just a clean setup flow that gets your team productive fast.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="relative reveal surface-panel group hover:-translate-y-2 transition-transform duration-300"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 -right-3 w-6 h-0.5 bg-slate-200 z-10 connector-track">
                  <div
                    className={`connector-fill ${visible ? 'filled' : ''}`}
                    style={{ transitionDelay: `${0.3 + i * 0.15}s` }}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 ${step.color} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
                  {step.num}
                </div>
                <div className={`w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center transition-colors duration-300`}>
                  <step.icon size={18} className="text-slate-500 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>

              <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
