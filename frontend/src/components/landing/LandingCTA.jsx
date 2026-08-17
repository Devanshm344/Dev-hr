import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingCTA() {
  const navigate = useNavigate();

  return (
    <section className="container-section bg-transparent">
      <div className="section-container text-center py-20">
        <div className="mx-auto max-w-3xl rounded-[2.5rem] bg-gradient-to-br from-brand-primary to-[#064A78] text-white p-10 shadow-[0_30px_90px_-45px_rgba(0,82,204,0.35)]">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-5">Ready To Accelerate With TechDemocracy?</h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Get started with a tailored enterprise workflow that unifies your tools, teams, and outcomes in one powerful platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/login')} className="btn-primary">
              Get Started Free <ArrowRight size={20} />
            </button>
            <a href="#pricing" className="btn-secondary">
              View pricing
            </a>
          </div>
          <p className="text-blue-100 text-sm mt-5">14-day free trial. No credit card required.</p>
        </div>
      </div>
    </section>
  );
}
