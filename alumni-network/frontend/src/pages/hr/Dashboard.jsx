import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton, ChartSkeleton, RowSkeleton, DashboardHero } from "@/components/ui-custom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Calendar, ClipboardList, ArrowRight, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from "recharts";
export default function HRDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const load = () => {
    fetch("/api/hr/dashboard").then(res => res.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const handleDecision = async (id, status) => {
    setActioningId(id);
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status
      })
    });
    load();
    setActioningId(null);
  };
  const maxBenefitCount = Math.max(1, ...(data?.topBenefits ?? []).map(b => b.count));
  return <>
      <DashboardHero title="Alumni - HR Dashboard" subtitle="Overview of alumni registrations, requests, and engagement.">
        <Link to="/hr/registrations"><Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border border-white/30">Review Registrations</Button></Link>
      </DashboardHero>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading ? <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </> : <>
            <StatCard style={{ animationDelay: "0ms" }} title="Pending Registrations" value={data.stats.pendingRegistrations.value} subtitle={data.stats.pendingRegistrations.subtitle} icon={UserCheck} color="orange" trend={{
            value: data.stats.pendingRegistrations.trend,
            label: data.stats.pendingRegistrations.trendLabel
          }} />
            <StatCard style={{ animationDelay: "60ms" }} title="Total Alumni" value={data.stats.totalAlumni.value} subtitle={data.stats.totalAlumni.subtitle} icon={Users} color="blue" trend={{
            value: data.stats.totalAlumni.trend,
            label: data.stats.totalAlumni.trendLabel
          }} />
            <StatCard style={{ animationDelay: "120ms" }} title="Active Requests" value={data.stats.activeRequests.value} subtitle={data.stats.activeRequests.subtitle} icon={ClipboardList} color="red" trend={{
            value: data.stats.activeRequests.trend,
            label: data.stats.activeRequests.trendLabel
          }} />
            <StatCard style={{ animationDelay: "180ms" }} title="Events This Month" value={data.stats.eventsThisMonth.value} subtitle={data.stats.eventsThisMonth.subtitle} icon={Calendar} color="green" trend={{
            value: data.stats.eventsThisMonth.trend,
            label: data.stats.eventsThisMonth.trendLabel
          }} />
          </>}
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Monthly Registrations & Alumni Growth</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <ChartSkeleton height={220} /> : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.monthlyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{
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
                <Bar yAxisId="left" dataKey="registrations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="New Registrations" />
                <Line yAxisId="right" type="monotone" dataKey="alumni" stroke="#10b981" strokeWidth={2} dot={{
                fill: "#10b981",
                r: 3
              }} name="Total Alumni" />
              </BarChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Registrations */}
        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Pending Registrations</CardTitle>
            <Link to="/hr/registrations"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all<ArrowRight className="h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : <>
            {(data?.pendingRegistrationsList.length ?? 0) === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pending registrations.</p>}
            {data?.pendingRegistrationsList.map(r => <div key={r.id} className="flex items-center gap-3">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={r.profile_photo_path ?? undefined} alt={r.full_name} className="object-cover" />
                  <AvatarFallback className="td-gradient text-white text-xs font-semibold">{r.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.designation || "—"} · {r.employer || "—"}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700 text-white border-0" disabled={actioningId === r.id} onClick={() => handleDecision(r.id, "active")}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="outline" className="h-7 w-7 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" disabled={actioningId === r.id} onClick={() => handleDecision(r.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </div>)}
            </>}
          </CardContent>
        </Card>

        {/* Top Benefits Usage */}
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Top Benefits Usage</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="space-y-4">
                <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-2/3" />
              </div> : (data?.topBenefits.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No benefit requests yet.</p> : <div className="space-y-3">
                {data?.topBenefits.map(b => <div key={b.benefit_title}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground">{b.benefit_title}</span>
                      <span className="text-xs text-muted-foreground">{b.count}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{
                  width: `${b.count / maxBenefitCount * 100}%`
                }} />
                    </div>
                  </div>)}
              </div>}
          </CardContent>
        </Card>
      </div>
    </>;
}
