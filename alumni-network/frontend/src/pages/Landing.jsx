import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Users, Calendar, Gift, Star, ArrowRight, CheckCircle, Menu, X, Shield, BookOpen, Globe, Briefcase, Award, Mail, Phone, MapPin, Quote, ChevronDown, FileText, Linkedin, MessageSquare, Monitor, GraduationCap, Search, Grid, Heart, Share2, HeartPulse, Activity, Home, LifeBuoy, Plane, ShoppingBag, Laptop, DollarSign, Trophy, Lock } from "lucide-react";
const BENEFIT_ICON_MAP = {
  Users,
  Briefcase,
  FileText,
  Linkedin,
  MessageSquare,
  Award,
  BookOpen,
  Globe,
  Monitor,
  GraduationCap,
  Search,
  Grid,
  Heart,
  Share2,
  Shield,
  HeartPulse,
  Activity,
  Home,
  LifeBuoy,
  Plane,
  ShoppingBag,
  Laptop,
  DollarSign,
  Trophy
};
const BENEFIT_COLOR_MAP = {
  blue: "bg-blue-500/10 text-blue-600 group-hover:bg-blue-600",
  green: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600",
  orange: "bg-orange-500/10 text-orange-600 group-hover:bg-orange-600",
  red: "bg-red-500/10 text-red-600 group-hover:bg-red-600",
  purple: "bg-purple-500/10 text-purple-600 group-hover:bg-purple-600",
  yellow: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-600"
};
const stats = [{
  value: "10,000+",
  label: "Active Alumni"
}, {
  value: "25+",
  label: "Benefits Available"
}, {
  value: "50+",
  label: "Events Annually"
}, {
  value: "98%",
  label: "Satisfaction Rate"
}];
const footerColumns = [{
  title: "Solutions",
  links: [{
    label: "Identity Governance & Administration (IGA)",
    href: "#"
  }, {
    label: "Customer Identity Access Management (CIAM)",
    href: "#"
  }, {
    label: "Privileged Access Management (PAM)",
    href: "#"
  }, {
    label: "Access Management (AM)",
    href: "#"
  }, {
    label: "Managed Security Operation Center (SOC)",
    href: "#"
  }]
}, {
  title: "Services",
  links: [{
    label: "Advisory Consulting",
    href: "#"
  }, {
    label: "Implementation Services",
    href: "#"
  }, {
    label: "Operation & Support Services",
    href: "#"
  }, {
    label: "Managed Services",
    href: "#"
  }, {
    label: "FMMS",
    href: "#"
  }, {
    label: "WFaaS",
    href: "#"
  }]
}, {
  title: "Our Company",
  links: [{
    label: "About Us",
    href: "https://www.techdemocracy.com/company/about-us"
  }, {
    label: "Leadership Team",
    href: "https://www.techdemocracy.com/company/leadership"
  }, {
    label: "Resources",
    href: "https://www.techdemocracy.com/resources"
  }, {
    label: "Careers",
    href: "https://www.techdemocracy.com/company/careers"
  }, {
    label: "Events",
    href: "https://www.techdemocracy.com/company/events"
  }, {
    label: "Workshop",
    href: "https://www.techdemocracy.com/passwordless-workshop/schedule"
  }]
}];
export default function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [benefitsExpanded, setBenefitsExpanded] = useState(false);
  const BENEFITS_PREVIEW_COUNT = 6;
  const [rawBenefits, setRawBenefits] = useState([]);
  const benefits = rawBenefits.map(b => ({
    id: b.id,
    icon: BENEFIT_ICON_MAP[b.icon] ?? Gift,
    label: b.title,
    desc: b.description,
    colorClass: BENEFIT_COLOR_MAP[b.color] ?? BENEFIT_COLOR_MAP.blue
  }));
  const visibleBenefits = benefitsExpanded ? benefits : benefits.slice(0, BENEFITS_PREVIEW_COUNT);
  const [lockedBenefit, setLockedBenefit] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const EVENTS_PREVIEW_COUNT = 3;
  const visibleEvents = eventsExpanded ? events : events.slice(0, EVENTS_PREVIEW_COUNT);
  const [stories, setStories] = useState([]);
  const [storiesExpanded, setStoriesExpanded] = useState(false);
  const STORIES_PREVIEW_COUNT = 3;
  const visibleStories = storiesExpanded ? stories : stories.slice(0, STORIES_PREVIEW_COUNT);
  const [faqs, setFaqs] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: ""
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState(null);
  const [contactSent, setContactSent] = useState(false);
  const handleContactSubmit = async () => {
    const {
      firstName,
      lastName,
      email,
      message
    } = contactForm;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !message.trim()) {
      setContactError("Please fill in all fields.");
      return;
    }
    setContactSubmitting(true);
    setContactError(null);
    try {
      const res = await fetch("/api/contact-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contactForm)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setContactForm({
        firstName: "",
        lastName: "",
        email: "",
        message: ""
      });
      setContactSent(true);
      setTimeout(() => setContactSent(false), 5000);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setContactSubmitting(false);
    }
  };
  useEffect(() => {
    fetch("/api/benefits?active=true").then(res => res.json()).then(data => setRawBenefits(data.benefits ?? [])).catch(() => setRawBenefits([]));
    fetch("/api/events?status=upcoming&published=true").then(res => res.json()).then(data => setEvents(data.events ?? [])).catch(() => setEvents([]));
    fetch("/api/stories?status=approved&published=true").then(res => res.json()).then(data => setStories(data.stories ?? [])).catch(() => setStories([]));
    fetch("/api/faqs?published=true").then(res => res.json()).then(data => setFaqs(data.faqs ?? [])).catch(() => setFaqs([]));
    fetch("/api/system-settings/public").then(res => res.json()).then(setSiteSettings).catch(() => {});
  }, []);
  if (siteSettings?.maintenanceMode) {
    return <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Under Maintenance</h1>
          <p className="text-muted-foreground">{siteSettings.portalName} is currently undergoing scheduled maintenance. Please check back shortly.</p>
        </div>
      </div>;
  }
  if (siteSettings && !siteSettings.enablePublicLandingPage) {
    return <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">{siteSettings.portalName}</h1>
          <p className="text-muted-foreground mb-6">The public landing page is currently disabled. Members can still sign in directly.</p>
          <Link to="/login" className="text-primary font-medium hover:underline">Member Login →</Link>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Sticky nav is bounded to this wrapper so it releases before the footer instead of overlapping it */}
      <div className="relative">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 pt-3 px-3 sm:pt-4 sm:px-4">
        <div className="max-w-[88rem] mx-auto rounded-2xl bg-white/65 dark:bg-slate-900/55 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-lg shadow-black/[0.04] transition-shadow">
          <div className="flex items-center justify-between h-20 px-5 sm:px-8">
            <div className="flex items-center gap-3 group cursor-default">
              <img src="/logo.png" alt="TechDemocracy" className="w-10 h-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
              <div>
                <p className="font-bold text-base text-foreground leading-none tracking-tight">TechDemocracy</p>
                <p className="text-xs text-muted-foreground leading-none mt-1">Alumni Network</p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-1 rounded-full bg-black/[0.03] dark:bg-white/5 border border-black/[0.04] dark:border-white/5 p-1">
              {["Benefits", "Events", "Stories", "FAQ", "Contact"].map(item => <a key={item} href={`#${item.toLowerCase()}`} className="rounded-full px-5 py-2.5 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-sm transition-all duration-200">
                  {item}
                </a>)}
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <Button variant="ghost" asChild className="text-[15px] rounded-full hover:bg-white/60 dark:hover:bg-white/10 transition-all"><Link to="/login">Login</Link></Button>
              <Button asChild className="rounded-full td-gradient border-0 text-white text-[15px] px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-105 transition-all duration-200"><Link to="/register">Register</Link></Button>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden rounded-full" onClick={() => setNavOpen(!navOpen)}>
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
          {navOpen && <div className="lg:hidden border-t border-white/40 dark:border-white/10 px-5 py-4 space-y-1">
              {["Benefits", "Events", "Stories", "FAQ", "Contact"].map(item => <a key={item} href={`#${item.toLowerCase()}`} className="block rounded-full px-4 py-2.5 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/70 dark:hover:bg-white/10 hover:translate-x-1 transition-all" onClick={() => setNavOpen(false)}>{item}</a>)}
              <div className="flex gap-3 pt-3">
                <Button variant="outline" asChild className="flex-1 rounded-full"><Link to="/login">Login</Link></Button>
                <Button asChild className="flex-1 rounded-full td-gradient border-0 text-white"><Link to="/register">Register</Link></Button>
              </div>
            </div>}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 td-gradient opacity-5 dark:opacity-10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.12),_transparent_60%)]" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl opacity-40 animate-pulse" />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-blue-400/20 blur-3xl opacity-30 animate-pulse [animation-delay:1s]" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-cyan-300/20 blur-3xl opacity-30 animate-pulse [animation-delay:2s]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24 lg:pt-16 lg:pb-40">
          <div className="max-w-3xl">
            <Badge className="mb-7 bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-primary shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 px-4 py-1.5 text-sm">
              ✦ Trusted by 10,000+ Alumni Worldwide
            </Badge>
            <p className="mt-5 text-xs sm:text-sm font-bold tracking-[0.2em] text-primary uppercase">TechDemocracy</p>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mt-3">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-cyan-400">Welcome To Talent Universe&nbsp;-<br />Alumni Network</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base font-medium text-muted-foreground/80 tracking-wide">Since September 2000</p>
            <p className="mt-7 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Connect, grow, and thrive with the TechDemocracy alumni community. Access exclusive benefits, career opportunities, and a global network of professionals.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild className="group/btn relative overflow-hidden rounded-full td-gradient border-0 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 h-14 px-9 text-base">
                <Link to="/register">
                  <span className="absolute inset-0 -translate-x-[120%] group-hover/btn:translate-x-[120%] transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                  <span className="relative flex items-center">Join Our Community <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" /></span>
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-full h-14 px-9 text-base bg-white/40 dark:bg-white/5 backdrop-blur-md border-white/60 dark:border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] hover:bg-white/70 dark:hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300">
                <Link to="/login">Member Login</Link>
              </Button>
            </div>
            {siteSettings?.showAlumniStatsOnLanding !== false && <div className="mt-14 inline-flex flex-wrap gap-x-10 gap-y-6 rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-sm px-7 py-5">
                {stats.map(stat => <div key={stat.label} className="group cursor-default">
                    <p className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-primary to-blue-500 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">{stat.value}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>)}
              </div>}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="relative py-20 bg-secondary/30 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-primary shadow-sm px-4 py-1.5 text-sm">Benefits</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Everything You Need To Succeed</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-base">25+ exclusive benefits designed to accelerate your career and enrich your professional life.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleBenefits.map((b, i) => <Card key={b.id} style={{
            animationDelay: `${i % 6 * 80}ms`
          }} onClick={() => setLockedBenefit(b)} className="group relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 hover:border-primary/30 transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-500">
                <CardContent className="p-7">
                  <div className={cn("w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:text-white group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg", b.colorClass)}>
                    <b.icon className="h-6 w-6 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg">{b.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{b.desc}</p>
                  <span className="inline-flex items-center gap-1 mt-4 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Lock className="h-3 w-3" />Register to unlock
                  </span>
                </CardContent>
              </Card>)}
          </div>
          <div className="text-center mt-12">
            <Button variant="outline" onClick={() => setBenefitsExpanded(e => !e)} className="group/btn rounded-full bg-white/40 dark:bg-white/5 backdrop-blur-md border-white/60 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 hover:scale-105 transition-all duration-200 px-6">
              {benefitsExpanded ? "View Less" : "View All 25 Benefits"}
              <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform duration-300", benefitsExpanded && "rotate-180")} />
            </Button>
          </div>
        </div>
      </section>

      {/* Events */}
      <section id="events" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <Badge className="mb-4 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-primary shadow-sm px-4 py-1.5 text-sm">Events</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Upcoming Events</h2>
              <p className="mt-2 text-muted-foreground text-base">Stay connected with exclusive alumni events.</p>
            </div>
            {events.length > EVENTS_PREVIEW_COUNT && <Button variant="ghost" onClick={() => setEventsExpanded(e => !e)} className="hidden md:flex rounded-full group/btn">
                {eventsExpanded ? "View Less" : "View All"}
                <ArrowRight className={cn("ml-1 h-4 w-4 transition-transform duration-300", eventsExpanded ? "rotate-90" : "group-hover/btn:translate-x-1")} />
              </Button>}
          </div>
          {events.length === 0 ? <p className="text-muted-foreground text-sm">No upcoming events scheduled yet — check back soon.</p> : <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {visibleEvents.map((e, i) => <Card key={e.id} style={{
            animationDelay: `${i % 3 * 100}ms`
          }} className="group animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-500 overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] hover:shadow-2xl hover:-translate-y-2 hover:border-primary/30 transition-all duration-300 cursor-default">
                  <div className="relative aspect-video overflow-hidden">
                    {e.banner_path ? <img src={e.banner_path} alt={e.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full td-gradient flex items-center justify-center">
                        <Calendar className="h-10 w-10 text-white/70" />
                      </div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Badge className="absolute top-3 left-3 bg-white/80 backdrop-blur-md text-slate-900 border-0 text-xs shadow-sm">{e.type}</Badge>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-foreground text-lg leading-snug group-hover:text-primary transition-colors duration-300">{e.title}</h3>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(e.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                      </span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>
                    </div>
                  </CardContent>
                </Card>)}
            </div>}
        </div>
      </section>

      {/* Success Stories */}
      <section id="stories" className="relative py-20 bg-primary/5 dark:bg-primary/10 overflow-hidden">
        <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-primary shadow-sm px-4 py-1.5 text-sm">Success Stories</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">What Our Alumni Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {visibleStories.map((t, i) => <Card key={t.id} style={{
            animationDelay: `${i % 3 * 100}ms`
          }} className="group animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-500 rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-0">
                  <Quote className="h-8 w-8 text-primary/30 mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary/50" />
                  <p className="text-sm text-muted-foreground leading-relaxed italic">&quot;{t.quote}&quot;</p>
                  <div className="flex items-center gap-3 mt-6">
                    <Avatar className="w-11 h-11 ring-2 ring-white/60 dark:ring-white/10 transition-transform duration-300 group-hover:scale-110">
                      <AvatarImage src={t.avatar_path ?? undefined} alt={t.alumni_name} className="object-cover" />
                      <AvatarFallback className="td-gradient text-white font-semibold text-sm">{t.alumni_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{t.alumni_name}</p>
                      {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {[...Array(5)].map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < t.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />)}
                  </div>
                </CardContent>
              </Card>)}
          </div>

          {stories.length > STORIES_PREVIEW_COUNT && <div className="flex justify-center mt-12">
              <Button variant="outline" onClick={() => setStoriesExpanded(e => !e)} className="group/btn rounded-full h-12 px-7 bg-white/50 dark:bg-white/5 backdrop-blur-md border-white/60 dark:border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] hover:bg-white/80 dark:hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15 transition-all duration-300">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {storiesExpanded ? "View Less" : `View More Stories`}
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-300 group-hover/btn:translate-y-0.5", storiesExpanded && "rotate-180")} />
                </span>
              </Button>
            </div>}
        </div>
      </section>

      {/* Join Us */}
      <section id="join-us" className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 td-gradient" />
        <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-5 bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-sm px-4 py-1.5 text-sm">
            ✦ Become a Member
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Ready To Join Us?</h2>
          <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-xl mx-auto">
            Become part of the TechDemocracy Talent Universe - Alumni Network and unlock exclusive benefits, events, and a global community of professionals.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="group/btn rounded-full bg-white text-primary hover:bg-white/90 hover:-translate-y-0.5 shadow-lg shadow-black/10 hover:shadow-xl transition-all duration-300 h-14 px-9 text-base font-semibold">
              <Link to="/register">
                Join Our Community <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full border-white/40 text-white bg-white/5 hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300 h-14 px-9 text-base">
              <Link to="/login">Member Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-primary shadow-sm px-4 py-1.5 text-sm">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Frequently Asked Questions</h2>
          </div>
          {faqs.length === 0 ? <p className="text-center text-muted-foreground text-sm">No FAQs published yet — check back soon.</p> : <Accordion type="single" collapsible className="space-y-3">
              {faqs.map(faq => <AccordionItem key={faq.id} value={`item-${faq.id}`} className="border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-2xl px-5 overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] hover:shadow-md hover:border-primary/30 transition-all duration-300 data-[state=open]:shadow-lg data-[state=open]:border-primary/30">
                  <AccordionTrigger className="text-[15px] font-medium text-foreground hover:no-underline hover:text-primary transition-colors py-5">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>)}
            </Accordion>}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative py-20 bg-secondary/30 overflow-hidden">
        <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full bg-primary/10 blur-3xl -translate-y-1/2" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-primary shadow-sm px-4 py-1.5 text-sm">Contact Us</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Get In Touch</h2>
              <p className="text-muted-foreground mt-3 text-base">Have questions about the alumni program? Our team is here to help.</p>
              <div className="mt-8 space-y-4">
                {[{
                icon: Mail,
                label: "alumni@techdemocracy.com"
              }, {
                icon: Phone,
                label: "+1 (800) TD-ALUMNI"
              }, {
                icon: MapPin,
                label: "123 Tech Plaza, San Francisco, CA 94105"
              }].map(({
                icon: Icon,
                label
              }, i) => <div key={i} className="group flex items-center gap-3 text-sm text-muted-foreground cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:bg-primary group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/30">
                      <Icon className="h-4 w-4 text-primary group-hover:text-white transition-colors duration-300" />
                    </div>
                    <span className="group-hover:text-foreground transition-colors duration-300">{label}</span>
                  </div>)}
              </div>
            </div>
            <Card className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] shadow-2xl">
              <CardContent className="p-7 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">First Name</label>
                    <input className="w-full h-11 px-3.5 rounded-xl border border-input bg-white/70 dark:bg-white/5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/40" placeholder="John" value={contactForm.firstName} onChange={e => setContactForm(f => ({
                    ...f,
                    firstName: e.target.value
                  }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Last Name</label>
                    <input className="w-full h-11 px-3.5 rounded-xl border border-input bg-white/70 dark:bg-white/5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/40" placeholder="Doe" value={contactForm.lastName} onChange={e => setContactForm(f => ({
                    ...f,
                    lastName: e.target.value
                  }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <input className="w-full h-11 px-3.5 rounded-xl border border-input bg-white/70 dark:bg-white/5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/40" placeholder="john.doe@example.com" value={contactForm.email} onChange={e => setContactForm(f => ({
                  ...f,
                  email: e.target.value
                }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Message</label>
                  <textarea className="w-full h-28 px-3.5 py-2.5 rounded-xl border border-input bg-white/70 dark:bg-white/5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/40 resize-none" placeholder="How can we help you?" value={contactForm.message} onChange={e => setContactForm(f => ({
                  ...f,
                  message: e.target.value
                }))} />
                </div>
                {contactError && <p className="text-sm text-destructive">{contactError}</p>}
                {contactSent && <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4" />Message sent! Our team will get back to you soon.
                  </div>}
                <Button onClick={handleContactSubmit} disabled={contactSubmitting} className="group/btn relative overflow-hidden w-full rounded-xl h-11 td-gradient border-0 text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300">
                  <span className="absolute inset-0 -translate-x-[120%] group-hover/btn:translate-x-[120%] transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                  <span className="relative">{contactSubmitting ? "Sending..." : "Send Message"}</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      </div>

      {/* Footer */}
      <footer className="relative bg-slate-900 text-slate-400 py-14 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-10 group cursor-default w-fit">
            <img src="/logo.png" alt="TechDemocracy" className="w-9 h-9 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
            <span className="font-bold text-white">TechDemocracy</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
            {footerColumns.map(section => <div key={section.title}>
                <h4 className="text-white font-bold text-lg mb-5">{section.title}</h4>
                <ul className="space-y-3">
                  {section.links.map(link => <li key={link.label} className="flex items-start gap-2 text-sm">
                      <span className="mt-2 h-1 w-1 rounded-full bg-slate-500 shrink-0" />
                      <a href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined} className="relative hover:text-white transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-white after:transition-all after:duration-300 hover:after:w-full">
                        {link.label}
                      </a>
                    </li>)}
                </ul>
              </div>)}
            <div>
              <h4 className="text-white font-bold text-lg mb-5">Head Office: United States</h4>
              <p className="text-sm leading-relaxed">
                1 Corporate Place South Suite # 110, Piscataway, NJ 08854. Call Us : +1 732 404 8350
              </p>
              <p className="text-sm font-semibold text-white mt-5 mb-1">Email us :</p>
              <a href="mailto:solutions@techdemocracy.com" className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors">solutions@techdemocracy.com</a>
              <h4 className="text-white font-bold text-lg mt-6 mb-2">Delivery Centers :</h4>
              <p className="text-sm flex items-center gap-2">
                <span>Canada</span><span className="text-slate-600">|</span><span>India</span><span className="text-slate-600">|</span><span>Philippines</span>
              </p>
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-10">Your Trusted Identity Security Partner</h3>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs">© 2026 TechDemocracy LLC and/or its affiliates. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms & Conditions</a>
              <span className="text-slate-500">We are ISO/IEC 27001:2013 certified</span>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={!!lockedBenefit} onOpenChange={open => !open && setLockedBenefit(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-2xl td-gradient flex items-center justify-center mb-2 shadow-lg shadow-primary/25">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-xl">Register to Unlock</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create your free Alumni account to unlock <span className="font-semibold text-foreground">{lockedBenefit?.label}</span> and 24 other exclusive benefits.
          </p>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setLockedBenefit(null)}>Maybe Later</Button>
            <Button className="td-gradient border-0 text-white" asChild>
              <Link to="/register">Register Now</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}
