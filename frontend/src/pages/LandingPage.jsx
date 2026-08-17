import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import LandingNavbar from '../components/landing/LandingNavbar';
import LandingHero from '../components/landing/LandingHero';
import LandingModuleShowcase from '../components/landing/LandingModuleShowcase';
import LandingDashboardPreview from '../components/landing/LandingDashboardPreview';
import LandingSolutions from '../components/landing/LandingSolutions';
import LandingHowItWorks from '../components/landing/LandingHowItWorks';
import LandingIntegration from '../components/landing/LandingIntegration';
import LandingPricing from '../components/landing/LandingPricing';
import LandingCTA from '../components/landing/LandingCTA';
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const max = scrollHeight - clientHeight;
      setScrollPct(max > 0 ? (scrollTop / max) * 100 : 0);
      setShowBackToTop(scrollTop > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded]);

  return (
    <div className={`landing-page transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      <div className="scroll-progress" style={{ width: `${scrollPct}%` }} />
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
        aria-label="Back to top"
      >
        <ArrowUp size={20} />
      </button>

      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingModuleShowcase />
        <LandingDashboardPreview />
        <LandingSolutions />
        <LandingHowItWorks />
        <LandingIntegration />
        <LandingPricing />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
