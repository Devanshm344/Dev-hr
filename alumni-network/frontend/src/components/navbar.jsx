"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Search, Menu, Moon, Sun, ChevronDown, User, Settings, LogOut, Users, Calendar, Gift, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTheme } from "next-themes";
import { broadcastNotificationsChanged, NOTIFICATIONS_CHANGED_EVENT, timeAgo } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
function NotificationsBell() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const load = () => {
    fetch("/api/notifications?limit=8").then(res => res.json()).then(data => {
      setNotifs(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    }).catch(() => {});
  };
  useEffect(() => {
    load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
  }, []);
  const markRead = async id => {
    setNotifs(prev => prev.map(n => n.id === id ? {
      ...n,
      read: true
    } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH"
    }).catch(() => {});
    broadcastNotificationsChanged();
  };
  const handleClick = async n => {
    if (!n.read) await markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };
  return <Popover open={open} onOpenChange={o => {
    setOpen(o);
    if (o) load();
  }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground">
              {unreadCount}
            </Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <Badge variant="secondary">{unreadCount} new</Badge>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {notifs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>}
          {notifs.map(n => <div key={n.id} onClick={() => handleClick(n)} className={`p-4 hover:bg-secondary/50 transition-colors ${n.link ? "cursor-pointer" : ""} ${!n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(n.created_at)}</p>
            </div>)}
        </div>
        <div className="p-3 border-t">
          <Link to="/portal/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full text-xs h-8">View all notifications</Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>;
}
const SEARCH_DESTINATIONS = {
  alumni: {
    alumni: "/portal/networking",
    alumniQuery: name => `/portal/networking?q=${encodeURIComponent(name)}`,
    events: "/portal/events",
    benefits: "/portal/benefits"
  },
  hr: {
    alumni: "/hr/alumni",
    alumniQuery: name => `/hr/alumni?search=${encodeURIComponent(name)}`,
    events: "/hr/events",
    benefits: "/hr/benefits"
  },
  admin: {
    alumni: "/admin/alumni",
    alumniQuery: name => `/admin/alumni?search=${encodeURIComponent(name)}`,
    events: "/admin/events",
    benefits: "/admin/benefits"
  }
};
function GlobalSearch({
  portal
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const [results, setResults] = useState({
    alumni: [],
    events: [],
    benefits: []
  });
  const dest = SEARCH_DESTINATIONS[portal];
  useEffect(() => {
    fetch("/api/events").then(res => res.json()).then(data => setAllEvents(data.events ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({
        alumni: [],
        events: [],
        benefits: []
      });
      setOpen(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const alumniData = portal !== "alumni" ? await fetch(`/api/users?search=${encodeURIComponent(q)}&pageSize=4`).then(res => res.json()).then(data => ({
        alumni: (data.users ?? []).map(u => ({
          id: u.id,
          fullName: u.full_name,
          employer: u.employer,
          designation: u.designation
        }))
      })).catch(() => ({
        alumni: []
      })) : await fetch(`/api/alumni-directory?search=${encodeURIComponent(q)}&pageSize=4`).then(res => res.json()).catch(() => ({
        alumni: []
      }));
      if (cancelled) return;
      const lowerQ = q.toLowerCase();
      const matchedEvents = allEvents.filter(e => e.title.toLowerCase().includes(lowerQ) || (e.location ?? "").toLowerCase().includes(lowerQ)).slice(0, 4);
      const benefitsData = await fetch(`/api/benefits?search=${encodeURIComponent(q)}`).then(res => res.json()).catch(() => ({
        benefits: []
      }));
      if (cancelled) return;
      setResults({
        alumni: alumniData.alumni ?? [],
        events: matchedEvents,
        benefits: (benefitsData.benefits ?? []).slice(0, 4)
      });
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, allEvents, portal]);
  const goTo = href => {
    setOpen(false);
    setQuery("");
    navigate(href);
  };
  const hasResults = results.alumni.length + results.events.length + results.benefits.length > 0;
  return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="hidden md:flex flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search alumni, events, benefits..." className="pl-9 h-9 bg-secondary border-0 focus-visible:ring-1" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => {
          if (query.trim()) setOpen(true);
        }} />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start" onOpenAutoFocus={e => e.preventDefault()}>
        {loading && <p className="p-4 text-sm text-muted-foreground">Searching...</p>}
        {!loading && !hasResults && <p className="p-4 text-sm text-muted-foreground">No results for &quot;{query}&quot;.</p>}
        {!loading && hasResults && <div className="divide-y max-h-96 overflow-y-auto">
            {results.alumni.length > 0 && <div className="p-2">
                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Alumni</p>
                {results.alumni.map(a => <button key={a.id} onClick={() => goTo(dest.alumniQuery(a.fullName))} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-secondary text-left transition-colors">
                    <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.designation}{a.designation && a.employer ? " · " : ""}{a.employer}</p>
                    </div>
                  </button>)}
              </div>}
            {results.events.length > 0 && <div className="p-2">
                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Events</p>
                {results.events.map(e => <button key={e.id} onClick={() => goTo(dest.events)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-secondary text-left transition-colors">
                    <Calendar className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.location}</p>
                    </div>
                  </button>)}
              </div>}
            {results.benefits.length > 0 && <div className="p-2">
                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Benefits</p>
                {results.benefits.map(b => <button key={b.id} onClick={() => goTo(dest.benefits)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-secondary text-left transition-colors">
                    <Gift className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.category}</p>
                    </div>
                  </button>)}
              </div>}
          </div>}
      </PopoverContent>
    </Popover>;
}
function StaffNotificationsBell({
  portal
}) {
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const load = () => {
    fetch("/api/staff-notifications?limit=8").then(res => res.json()).then(data => {
      setNotifs(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    }).catch(() => {});
  };
  useEffect(() => {
    load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
  }, []);
  const handleClick = async n => {
    if (!n.read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? {
        ...x,
        read: true
      } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await fetch(`/api/staff-notifications/${n.id}`, {
        method: "PATCH"
      }).catch(() => {});
      broadcastNotificationsChanged();
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };
  return <Popover open={open} onOpenChange={o => {
    setOpen(o);
    if (o) load();
  }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground">
              {unreadCount}
            </Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <Badge variant="secondary">{unreadCount} new</Badge>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {notifs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>}
          {notifs.map(n => <div key={n.id} onClick={() => handleClick(n)} className={`p-4 hover:bg-secondary/50 cursor-pointer transition-colors ${!n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(n.created_at)}</p>
            </div>)}
        </div>
        <div className="p-3 border-t">
          <Link to={`/${portal}/notifications`} onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full text-xs h-8">View all notifications</Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>;
}
const SETTINGS_HREF = {
  alumni: "/portal/settings",
  hr: "/hr/settings",
  admin: "/admin/settings"
};
const CHANGE_PASSWORD_ENDPOINT = {
  alumni: "/api/auth/change-password",
  hr: "/api/auth/staff-change-password",
  admin: "/api/auth/staff-change-password"
};
const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};
function ChangePasswordDialog({
  portal,
  open,
  onOpenChange
}) {
  const [form, setForm] = useState(emptyPasswordForm);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const reset = () => {
    setForm(emptyPasswordForm);
    setError(null);
    setSuccess(false);
    setShowCurrent(false);
    setShowNew(false);
  };
  const handleSave = async () => {
    setError(null);
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(CHANGE_PASSWORD_ENDPOINT[portal], {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setSuccess(true);
      setForm(emptyPasswordForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };
  return <Dialog open={open} onOpenChange={o => {
    onOpenChange(o);
    if (!o) reset();
  }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Input type={showCurrent ? "text" : "password"} className="pr-10" value={form.currentPassword} onChange={e => setForm(f => ({
              ...f,
              currentPassword: e.target.value
            }))} />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input type={showNew ? "text" : "password"} className="pr-10" placeholder="At least 8 characters" value={form.newPassword} onChange={e => setForm(f => ({
              ...f,
              newPassword: e.target.value
            }))} />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input type={showNew ? "text" : "password"} value={form.confirmPassword} onChange={e => setForm(f => ({
            ...f,
            confirmPassword: e.target.value
          }))} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Password updated ✓</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="td-gradient border-0 text-white" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Update Password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
}
export function Navbar({
  onMenuClick,
  userName = "",
  userEmail = "",
  userAvatar,
  portalLabel,
  portal = "alumni"
}) {
  const {
    theme,
    setTheme
  } = useTheme();
  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    // HR/Admin got here via an SSO handoff from cotelligent-hrms's "Alumni"
    // tile — send them back there, not to this app's own login screen.
    const isStaffPortal = portal === "hr" || portal === "admin";
    window.location.href = isStaffPortal ? `${import.meta.env.VITE_HRMS_URL || "http://localhost:3000"}/modules` : "/";
  };
  // Solid white + shadow-sm, no blur/opacity — matches Cotelligent's header
  // rule exactly ("White, border-b border-card, shadow-sm").
  return <header className="sticky top-0 z-30 h-16 bg-card dark:bg-slate-900 border-b border-border shadow-sm flex items-center px-4 gap-4">
      {/* Hamburger (mobile) */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <GlobalSearch portal={portal} />
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        {portal === "alumni" ? <NotificationsBell /> : <StaffNotificationsBell portal={portal} />}

        {/* Profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
              <Avatar className="h-8 w-8 ring-2 ring-primary/15 ring-offset-2 ring-offset-background">
                <AvatarImage src={userAvatar} />
                {/* Gradient fill, matching Cotelligent's avatar treatment
                    (linear-gradient(135deg, primary-600, secondary-400)) rather
                    than a flat brand-color fill. */}
                <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--primary-2))] text-white text-xs font-semibold">
                  {userName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold leading-none">{userName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-none">{userEmail}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {portal === "alumni" && <DropdownMenuItem asChild>
                <Link to="/portal/profile"><User className="mr-2 h-4 w-4" />Profile</Link>
              </DropdownMenuItem>}
            <DropdownMenuItem asChild>
              <Link to={SETTINGS_HREF[portal]}><Settings className="mr-2 h-4 w-4" />Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
}
