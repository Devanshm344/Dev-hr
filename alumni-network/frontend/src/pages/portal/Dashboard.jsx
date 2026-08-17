import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton, ChartSkeleton, RowSkeleton, DashboardHero } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/current-user-context";
import { Gift, Calendar, Bell, ClipboardList, ArrowRight, Search, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
const quickActions = [{
  label: "Request Benefit",
  href: "/portal/requests",
  icon: Gift,
  color: "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 dark:from-blue-900/40 dark:to-blue-950/30 dark:text-blue-400"
}, {
  label: "Update Profile",
  href: "/portal/profile",
  icon: UserCheck,
  color: "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-900/40 dark:to-emerald-950/30 dark:text-emerald-400"
}, {
  label: "Browse Events",
  href: "/portal/events",
  icon: Calendar,
  color: "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 dark:from-orange-900/40 dark:to-orange-950/30 dark:text-orange-400"
}, {
  label: "Find Alumni",
  href: "/portal/networking",
  icon: Search,
  color: "bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 dark:from-purple-900/40 dark:to-purple-950/30 dark:text-purple-400"
}];
function buildRequestsPerMonth(requests) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("default", {
        month: "short"
      }),
      count: 0
    });
  }
  for (const r of requests) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = months.find(m => m.key === key);
    if (bucket) bucket.count += 1;
  }
  return months;
}
function DashboardContent() {
  const {
    user,
    loading
  } = useCurrentUser();
  const firstName = user?.fullName?.split(" ")[0];
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [activeBenefitsCount, setActiveBenefitsCount] = useState(0);
  const [dashLoading, setDashLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([
      fetch("/api/events?status=upcoming&published=true").then(res => res.json()).then(data => setUpcomingEvents(data.events ?? [])),
      fetch("/api/notifications?limit=1").then(res => res.json()).then(data => setUnreadCount(data.unreadCount ?? 0)),
      fetch("/api/announcements?published=true&limit=3").then(res => res.json()).then(data => setAnnouncements(data.announcements ?? [])),
      fetch("/api/service-requests").then(res => res.json()).then(data => setMyRequests(data.requests ?? [])),
      fetch("/api/benefits?active=true").then(res => res.json()).then(data => setActiveBenefitsCount((data.benefits ?? []).length))
    ]).finally(() => setDashLoading(false));
  }, []);
  const requestsPerMonth = buildRequestsPerMonth(myRequests);
  return <>
      <DashboardHero title={loading ? "Welcome Back!" : `Welcome Back, ${firstName}!`} subtitle="Here's what's happening in your alumni community.">
        <Link to="/portal/requests"><Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border border-white/30">New Service Request</Button></Link>
      </DashboardHero>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {dashLoading ? <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </> : <>
            <StatCard style={{ animationDelay: "0ms" }} title="Available Benefits" value={String(activeBenefitsCount)} subtitle="No approval needed" icon={Gift} color="blue" />
            <StatCard style={{ animationDelay: "60ms" }} title="My Requests" value={String(myRequests.length)} subtitle="Chat with HR anytime" icon={ClipboardList} color="orange" />
            <StatCard style={{ animationDelay: "120ms" }} title="Upcoming Events" value={String(upcomingEvents.length)} subtitle={upcomingEvents[0] ? `Next: ${upcomingEvents[0].title}` : "No events scheduled"} icon={Calendar} color="green" />
            <StatCard style={{ animationDelay: "180ms" }} title="Notifications" value={String(unreadCount)} subtitle={`${unreadCount} unread`} icon={Bell} color="red" trend={{
            value: 0,
            label: ""
          }} />
          </>}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Requests Submitted (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {dashLoading ? <ChartSkeleton height={200} /> : <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={requestsPerMonth}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "12px"
              }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorUsage)" />
              </AreaChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map(({
            label,
            href,
            icon: Icon,
            color
          }) => <Link key={label} to={href}>
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-secondary/50 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
                </div>
              </Link>)}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Upcoming Events</CardTitle>
            <Link to="/portal/events"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all<ArrowRight className="h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashLoading ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : <>
            {upcomingEvents.length === 0 && <p className="text-xs text-muted-foreground">No upcoming events.</p>}
            {upcomingEvents.map(e => <div key={e.id} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                  <span className="text-xs font-bold leading-none">{new Date(e.event_date).getDate()}</span>
                  <span className="text-[10px] leading-none">{new Date(e.event_date).toLocaleString("default", {
                  month: "short"
                })}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.location}</p>
                </div>
              </div>)}
            </>}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Latest Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashLoading ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : <>
            {announcements.length === 0 && <p className="text-xs text-muted-foreground">No announcements yet.</p>}
            {announcements.map(a => <div key={a.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground leading-snug">{a.title}</p>
                  <Badge variant={a.priority === "high" ? "destructive" : "secondary"} className="text-[10px] shrink-0">{a.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(a.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })} · {a.author}
                </p>
              </div>)}
            </>}
          </CardContent>
        </Card>
      </div>
    </>;
}
export default function AlumniDashboard() {
  return <>
      <DashboardContent />
    </>;
}
