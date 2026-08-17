import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

const teamSizes = ['1 – 10', '11 – 50', '51 – 200', '201 – 1,000', '1,000+'];

export default function LandingBookDemoModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', teamSize: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
  };

  const handleClose = () => {
    onClose();
    setSubmitted(false);
    setForm({ name: '', email: '', company: '', phone: '', teamSize: '' });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0B1722] shadow-[0_40px_120px_-30px_rgba(0,82,204,0.5)] p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-5 right-5 text-white/40 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {submitted ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-brand-primary/15 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-brand-primaryLight" />
            </div>
            <h3 className="text-xl font-bold text-white">You're all set!</h3>
            <p className="text-sm text-slate-300 max-w-xs">
              A TechDemocracy specialist will reach out within 24 hours to schedule your personalized demo.
            </p>
            <button onClick={handleClose} className="btn-secondary text-sm mt-2">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="section-tag mb-4 text-brand-primaryLight bg-brand-primary/15 inline-flex">
              <Sparkles size={14} />
              Free Personalized Demo
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">See TechDemocracy in action</h3>
            <p className="text-sm text-slate-300 mb-6">
              Tell us a bit about your team and we'll tailor a walkthrough to your needs.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jordan Lee"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-primaryLight focus:ring-2 focus:ring-brand-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Work Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jordan@company.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-primaryLight focus:ring-2 focus:ring-brand-primary/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Company *</label>
                  <input
                    type="text"
                    required
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Acme Inc."
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-primaryLight focus:ring-2 focus:ring-brand-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 0100"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-primaryLight focus:ring-2 focus:ring-brand-primary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Team Size *</label>
                <select
                  required
                  value={form.teamSize}
                  onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-brand-primaryLight focus:ring-2 focus:ring-brand-primary/20 transition-all [&>option]:text-slate-900"
                >
                  <option value="" disabled>Select team size</option>
                  {teamSizes.map((size) => (
                    <option key={size} value={size}>{size} employees</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary justify-center mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Book My Demo <ArrowRight size={16} /></>
                )}
              </button>
              <p className="text-center text-xs text-white/30">No credit card required. 30-minute walkthrough.</p>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
