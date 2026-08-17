import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: 'Starter',
    monthly: 29,
    annual: 23,
    desc: 'Perfect for small teams',
    features: ['Up to 3 users', '10GB storage', 'Basic support', 'API access', 'Email integration'],
  },
  {
    name: 'Professional',
    monthly: 99,
    annual: 79,
    desc: 'For growing companies',
    features: ['Up to 20 users', '100GB storage', 'Priority support', 'Advanced APIs', 'Custom integrations', 'SSO'],
    featured: true,
  },
  {
    name: 'Enterprise',
    monthly: null,
    annual: null,
    desc: 'For large organizations',
    features: ['Unlimited users', 'Unlimited storage', '24/7 support', 'Dedicated account manager', 'Custom SLA', 'On-premise option'],
  },
];

export default function LandingPricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="container-section bg-transparent">
      <div className="section-container">
        <div className="text-center mb-10">
          <div className="section-tag justify-center mb-4">Pricing</div>
          <h2 className="section-heading mb-4 text-slate-900">Simple, Transparent Pricing</h2>
          <p className="section-subheading max-w-2xl mx-auto mb-0 text-slate-600">
            Choose the plan that's right for your business. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-semibold transition-colors ${!annual ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="billing-toggle"
            aria-label="Toggle annual billing"
          >
            <span
              className="billing-toggle-knob"
              style={{ transform: annual ? 'translateX(88px)' : 'translateX(0px)' }}
            />
          </button>
          <span className={`text-sm font-semibold transition-colors ${annual ? 'text-slate-900' : 'text-slate-400'}`}>
            Annual <span className="text-brand-secondary">· save 20%</span>
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, i) => {
            const price = annual ? plan.annual : plan.monthly;
            return (
              <div
                key={plan.name}
                className={`relative reveal animate-fade-in-up rounded-2xl p-8 transition-transform duration-300 hover:-translate-y-2 ${
                  plan.featured
                    ? 'bg-brand-primary text-white border-2 border-brand-primary md:scale-105 animate-border-glow'
                    : 'surface-panel'
                }`}
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-secondary text-brand-darkGray text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse-glow">
                    <Sparkles size={13} />
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${plan.featured ? 'text-white' : 'text-brand-darkGray'}`}>{plan.name}</h3>
                  <p className={plan.featured ? 'text-blue-100' : 'text-brand-gray'}>{plan.desc}</p>
                </div>

                <div className="mb-8 h-12 flex items-end gap-1">
                  {price !== null ? (
                    <span key={`${plan.name}-${annual}`} className="animate-price-swap flex items-end gap-1">
                      <span className={`text-4xl font-bold ${plan.featured ? 'text-white' : 'text-brand-darkGray'}`}>${price}</span>
                      <span className={`text-sm pb-1 ${plan.featured ? 'text-blue-100' : 'text-brand-gray'}`}>/month</span>
                    </span>
                  ) : (
                    <span className={`text-4xl font-bold ${plan.featured ? 'text-white' : 'text-brand-darkGray'}`}>Custom</span>
                  )}
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-3 rounded-lg font-semibold mb-8 transition-all ${plan.featured ? 'bg-white text-brand-primary hover:bg-blue-50' : 'btn-secondary'}`}
                >
                  Get Started
                </button>

                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className={`flex items-center gap-3 ${plan.featured ? 'text-blue-50' : 'text-brand-gray'}`}>
                      <Check size={20} className={plan.featured ? 'text-white' : 'text-brand-secondary'} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
