import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Linkedin, Users, Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ALUMNI_PASSWORD, DEMO_HR_PASSWORD, DEMO_ADMIN_PASSWORD } from "@/lib/constants";
const roleConfig = {
  alumni: {
    label: "Alumni",
    portalLabel: "Alumni Network",
    icon: Users,
    headline: "Welcome Back\nTo The Community",
    subheadline: "Connect with 10,000+ alumni and access exclusive career benefits.",
    bullets: ["Exclusive benefits & perks", "Global networking opportunities", "Career mentorship programs", "Industry events & webinars"],
    demoEmail: "demo.alumni@example.com",
    demoPassword: DEMO_ALUMNI_PASSWORD,
    dashboard: "/portal/dashboard",
    showRegister: true
  },
  hr: {
    label: "HR",
    portalLabel: "HR Portal",
    icon: Building2,
    headline: "Manage Your\nAlumni Community",
    subheadline: "Review registrations, manage benefits, and keep alumni engaged.",
    bullets: ["Approve alumni registrations", "Manage benefits & events", "Track engagement analytics", "Respond to service requests"],
    demoEmail: "demo.hr@example.com",
    demoPassword: DEMO_HR_PASSWORD,
    dashboard: "/hr/dashboard",
    showRegister: false
  },
  admin: {
    label: "Admin",
    portalLabel: "Admin Console",
    icon: ShieldCheck,
    headline: "System-Wide\nControl Center",
    subheadline: "Configure roles, monitor audit logs, and oversee the entire platform.",
    bullets: ["Manage HR & admin users", "Role-based access control", "Platform-wide audit logs", "System configuration"],
    demoEmail: "demo.admin@example.com",
    demoPassword: DEMO_ADMIN_PASSWORD,
    dashboard: "/admin/dashboard",
    showRegister: false
  }
};
const roleOrder = ["alumni", "hr", "admin"];
export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState("alumni");
  const [email, setEmail] = useState(roleConfig.alumni.demoEmail);
  const [password, setPassword] = useState(roleConfig.alumni.demoPassword);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const navigate = useNavigate();
  const config = roleConfig[role];
  const selectRole = r => {
    setRole(r);
    setEmail(roleConfig[r].demoEmail);
    setPassword(roleConfig[r].demoPassword);
    setLoginError(null);
  };
  const performAlumniLogin = async (loginEmail, loginPassword) => {
    setSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Invalid email or password.");
      }
      navigate(roleConfig.alumni.dashboard);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const performStaffLogin = async (staffRole, loginEmail, loginPassword) => {
    setSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Invalid email or password.");
      }
      if (body.user.role !== staffRole) {
        throw new Error("These credentials are not valid for this portal.");
      }
      navigate(roleConfig[staffRole].dashboard);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleSubmit = e => {
    e.preventDefault();
    if (role === "alumni") {
      performAlumniLogin(email, password);
    } else {
      performStaffLogin(role, email, password);
    }
  };
  return <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col relative overflow-hidden p-12 td-gradient-dark">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)]" />
        <Link to="/" className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center p-1 shadow-sm"><img src="/logo.png" alt="TechDemocracy" className="w-full h-full" /></div>
          <div>
            <p className="font-bold text-white leading-none">TechDemocracy</p>
            <p className="text-xs text-blue-200/80 leading-none mt-0.5">{config.portalLabel}</p>
          </div>
        </Link>
        <div className="flex-1 flex flex-col justify-center relative z-10 mt-16">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-sm flex items-center justify-center mb-6">
            <config.icon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold leading-tight whitespace-pre-line">
            <span className="text-white">{config.headline.split("\n")[0]}{"\n"}</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-200">{config.headline.split("\n")[1]}</span>
          </h2>
          <p className="mt-4 text-blue-100/90 text-lg max-w-sm">{config.subheadline}</p>
          <div className="mt-10 space-y-5">
            {config.bullets.map((item, i) => <div key={i} className="flex items-center gap-3">
                <svg className="w-4 h-4 text-cyan-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span className="text-blue-50/90 text-sm">{item}</span>
              </div>)}
          </div>
        </div>
        <p className="text-blue-200/70 text-xs relative z-10">© 2026 TechDemocracy. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/logo.png" alt="TechDemocracy" className="w-8 h-8" />
            <span className="font-bold text-foreground">TechDemocracy</span>
          </Link>

          {/* Role selector */}
          <div className="inline-flex w-full rounded-full bg-secondary p-1 mb-8">
            {roleOrder.map(r => {
            const RoleIcon = roleConfig[r].icon;
            return <button key={r} type="button" onClick={() => selectRole(r)} className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200", role === r ? "bg-white dark:bg-slate-800 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <RoleIcon className="h-3.5 w-3.5" />
                  {roleConfig[r].label}
                </button>;
          })}
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Sign In To {config.portalLabel}</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your credentials to access the portal</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input id="password" type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-10 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me for 30 days</Label>
            </div>
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}
            <Button type="submit" disabled={submitting} className="w-full td-gradient border-0 text-white hover:opacity-90 h-10">
              {submitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground bg-background px-2">Or continue with</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-10 gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Google
            </Button>
            <Button variant="outline" className="h-10 gap-2">
              <Linkedin className="h-4 w-4 text-blue-700" />
              LinkedIn
            </Button>
          </div>

          {config.showRegister ? <p className="text-center text-sm text-muted-foreground mt-6">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">Register here</Link>
            </p> : <p className="text-center text-sm text-muted-foreground mt-6">
              {config.label} accounts are provisioned by your system administrator.
            </p>}

          {/* Demo portals */}
          <div className="mt-8 p-4 rounded-lg bg-secondary border border-border">
            <p className="text-xs font-semibold text-foreground mb-3">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
              {roleOrder.map(r => {
              const RoleIcon = roleConfig[r].icon;
              return <Button key={r} size="sm" variant="outline" className={cn("text-xs h-8 gap-1.5", role === r && "border-primary text-primary")} disabled={submitting} onClick={() => {
                selectRole(r);
                if (r === "alumni") {
                  performAlumniLogin(roleConfig.alumni.demoEmail, roleConfig.alumni.demoPassword);
                } else {
                  performStaffLogin(r, roleConfig[r].demoEmail, roleConfig[r].demoPassword);
                }
              }}>
                    <RoleIcon className="h-3 w-3" />
                    {roleConfig[r].label}
                  </Button>;
            })}
            </div>
          </div>
        </div>
      </div>
    </div>;
}
