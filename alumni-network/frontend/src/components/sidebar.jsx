import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Gift, ClipboardList, Calendar, Users, MessageSquare, MessageCircle, Star, Bell, Settings, ChevronLeft, ChevronRight, Building2, UserCheck, BarChart3, Megaphone, Shield, Database, Layers, FileText, Globe, LogOut, X, Quote, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
const alumniNav = [{
  label: "Dashboard",
  href: "/portal/dashboard",
  icon: LayoutDashboard
}, {
  label: "Benefits",
  href: "/portal/benefits",
  icon: Gift
}, {
  label: "Documents",
  href: "/portal/documents",
  icon: FileText
}, {
  label: "Service Requests",
  href: "/portal/requests",
  icon: ClipboardList
}, {
  label: "Events",
  href: "/portal/events",
  icon: Calendar
}, {
  label: "Share Your Story",
  href: "/portal/stories",
  icon: Quote
}, {
  label: "Networking",
  href: "/portal/networking",
  icon: Users
}, {
  label: "Messages",
  href: "/portal/messages",
  icon: MessageSquare
}, {
  label: "Discussion Forum",
  href: "/portal/forum",
  icon: MessageCircle
}, {
  label: "Feedback",
  href: "/portal/feedback",
  icon: Star
}, {
  label: "Notifications",
  href: "/portal/notifications",
  icon: Bell
}, {
  label: "Settings",
  href: "/portal/settings",
  icon: Settings
}];
const hrNav = [{
  label: "Dashboard",
  href: "/hr/dashboard",
  icon: LayoutDashboard
}, {
  label: "Pending Registrations",
  href: "/hr/registrations",
  icon: UserCheck
}, {
  label: "Alumni",
  href: "/hr/alumni",
  icon: Users
}, {
  label: "Salary Certificates",
  href: "/hr/salary-certificates",
  icon: FileText
}, {
  label: "Benefits",
  href: "/hr/benefits",
  icon: Gift
}, {
  label: "Service Requests",
  href: "/hr/requests",
  icon: ClipboardList
}, {
  label: "Messages",
  href: "/hr/messages",
  icon: MessageSquare
}, {
  label: "Events",
  href: "/hr/events",
  icon: Calendar
}, {
  label: "Connections",
  href: "/hr/networking",
  icon: Globe
}, {
  label: "Announcements",
  href: "/hr/announcements",
  icon: Megaphone
}, {
  label: "Feedback",
  href: "/hr/feedback",
  icon: Star
}, {
  label: "Reports",
  href: "/hr/reports",
  icon: BarChart3
}, {
  label: "Settings",
  href: "/hr/settings",
  icon: Settings
}];
const adminNav = [{
  label: "Dashboard",
  href: "/admin/dashboard",
  icon: LayoutDashboard
}, {
  label: "HR Users",
  href: "/admin/hr-users",
  icon: Building2
}, {
  label: "Role",
  href: "/admin/roles",
  icon: Shield
}, {
  label: "Alumni",
  href: "/admin/alumni",
  icon: Users
}, {
  label: "CMS",
  href: "/admin/cms",
  icon: FileText
}, {
  label: "Events",
  href: "/admin/events",
  icon: Calendar
}, {
  label: "Stories",
  href: "/admin/stories",
  icon: Quote
}, {
  label: "Inquiries",
  href: "/admin/inquiries",
  icon: Mail
}, {
  label: "Benefits",
  href: "/admin/benefits",
  icon: Gift
}, {
  label: "Reports",
  href: "/admin/reports",
  icon: BarChart3
}, {
  label: "Audit Logs",
  href: "/admin/audit",
  icon: Database
}, {
  label: "System Settings",
  href: "/admin/settings",
  icon: Layers
}];
const portalLabels = {
  alumni: {
    label: "Alumni - Alumni Portal"
  },
  hr: {
    label: "Alumni - HR Portal"
  },
  admin: {
    label: "Alumni - Admin Portal"
  }
};
export function Sidebar({
  portal,
  mobileOpen,
  onMobileClose
}) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    pathname
  } = useLocation();
  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    // HR/Admin got here via an SSO handoff from cotelligent-hrms's "Alumni"
    // tile — send them back there, not to this app's own login screen.
    const isStaffPortal = portal === "hr" || portal === "admin";
    window.location.href = isStaffPortal ? `${import.meta.env.VITE_HRMS_URL || "http://localhost:3000"}/modules` : "/";
  };
  const navItems = portal === "alumni" ? alumniNav : portal === "hr" ? hrNav : adminNav;
  const {
    label
  } = portalLabels[portal];
  return <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onMobileClose} />}

      {/* Sidebar */}
      <aside className={cn("fixed top-0 left-0 h-full z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-border shadow-sm sidebar-transition", collapsed ? "w-[64px]" : "w-[256px]", "lg:relative lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        {/* Logo */}
        <div className={cn("flex items-center h-16 px-4 border-b border-border", collapsed && "justify-center px-2")}>
          {!collapsed ? <div className="flex items-center gap-3 min-w-0">
              <img src="/logo.png" alt="TechDemocracy" className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-foreground truncate">TechDemocracy</p>
                <p className="text-xs text-muted-foreground truncate">{label}</p>
              </div>
            </div> : <img src="/logo.png" alt="TechDemocracy" className="w-8 h-8" />}
          {/* Mobile close */}
          {mobileOpen && !collapsed && <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={onMobileClose}>
              <X className="h-4 w-4" />
            </Button>}
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-4">
          <TooltipProvider delayDuration={0}>
            <nav className="px-2 space-y-1">
              {navItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return <Tooltip key={item.href} disableHoverableContent>
                    <TooltipTrigger asChild>
                      {/* Active state is a full gradient-fill pill with a colored shadow —
                          Cotelligent's "single strongest you-are-here signal" — rather than
                          a tinted-background + left-border accent. Inactive icons nudge to
                          primary and scale up slightly on hover, matching the same file. */}
                      <Link to={item.href} onClick={onMobileClose} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200", active ? "text-white font-semibold shadow-md shadow-primary/35 bg-gradient-to-r from-primary to-[hsl(var(--primary-2))]" : "text-muted-foreground hover:bg-secondary hover:text-foreground", collapsed && "justify-center px-2")}>
                        <item.icon className={cn("h-4 w-4 shrink-0 transition-all duration-200", !active && "group-hover:text-primary group-hover:scale-110")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                  </Tooltip>;
            })}
            </nav>
          </TooltipProvider>
        </ScrollArea>

        {/* Footer */}
        <div className={cn("p-2 border-t border-border space-y-1", collapsed && "flex flex-col items-center")}>
          <Separator className="mb-2" />
          <button type="button" onClick={handleLogout} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full", collapsed && "justify-center px-2")}>
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <Button variant="outline" size="icon" className="absolute -right-3 top-20 h-6 w-6 rounded-full border shadow-md bg-background hidden lg:flex" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </aside>
    </>;
}
