import { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TechLogo from '../../assets/techdemocracy-new-logo.jpg';
import LandingBookDemoModal from './LandingBookDemoModal';

const links = [
  { label: 'Product',   href: '#modules' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing',   href: '#pricing' },
];

export default function LandingNavbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeHref, setActiveHref] = useState('');
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const linkRefs = useRef({});

  useEffect(() => {
    const sectionIds = links.map((l) => l.href.slice(1));
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el) => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHref(`#${entry.target.id}`);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = linkRefs.current[activeHref];
    if (el) {
      setPillStyle({ left: el.offsetLeft, width: el.offsetWidth, opacity: 1 });
    } else {
      setPillStyle((p) => ({ ...p, opacity: 0 }));
    }
  }, [activeHref]);

  return (
    <nav className="fixed top-4 inset-x-0 z-50 px-4">
      <div className="mx-auto max-w-6xl rounded-full backdrop-blur-xl border border-slate-200/60 bg-white/60 shadow-lg shadow-slate-900/5 px-6 py-2">
        <div className="flex items-center justify-between h-12">
          <a href="/" className="flex items-center gap-3 group">
            <img
              src={TechLogo}
              alt="TechDemocracy"
              className="w-9 h-9 object-contain rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            />
            <span className="font-heading font-bold text-lg tracking-tight text-slate-900">
              TechDemocracy
            </span>
          </a>

          <div className="hidden xl:flex items-center gap-2 relative">
            <div
              className="tab-pill"
              style={{
                left: pillStyle.left,
                width: pillStyle.width,
                opacity: pillStyle.opacity,
                background: 'rgba(0,82,204,0.1)',
                boxShadow: 'none',
              }}
            />
            {links.map((link) => (
              <a
                key={link.label}
                ref={(el) => { linkRefs.current[link.href] = el; }}
                href={link.href}
                className="nav-link relative z-10 px-4 py-2 rounded-full transition-colors duration-200 text-slate-700 hover:text-brand-primary"
              >
                {link.label}
              </a>
            ))}
            <button onClick={() => navigate('/login')} className="btn-outline">
              Sign In
            </button>
            <button onClick={() => setDemoOpen(true)} className="btn-primary">
              Book a demo
            </button>
          </div>

          <button
            className="xl:hidden p-2 rounded-full text-slate-900 bg-slate-900/5"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="xl:hidden border-t border-slate-200 mt-1">
            <div className="py-4 flex flex-col gap-3">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block px-2 py-2 font-medium text-slate-700"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => { setMobileOpen(false); navigate('/login'); }}
                className="btn-outline justify-center"
              >
                Sign In
              </button>
              <button
                onClick={() => { setMobileOpen(false); setDemoOpen(true); }}
                className="btn-primary justify-center"
              >
                Book a demo
              </button>
            </div>
          </div>
        )}
      </div>

      <LandingBookDemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </nav>
  );
}
