import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton, ChartSkeleton, RowSkeleton, DashboardHero } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Building2, Database, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([
      fetch("/api/admin/dashboard").then(res => res.json()).then(setData),
      fetch("/api/admin/system-metrics").then(res => res.json()).then(setMetrics),
      fetch("/api/admin/audit-logs?pageSize=3").then(res => res.json()).then(data => setAuditLogs(data.logs ?? []))
    ]).finally(() => setLoading(false));
  }, []);
  const chartData = [...(metrics?.history ?? [])];
  if (metrics) chartData.push({
    time: "Now",
    cpu: metrics.current.cpu,
    memory: metrics.current.memory
  });
  return <>
      <DashboardHero title="Alumni - Admin Dashboard" subtitle="System-wide overview of the TechDemocracy Alumni Portal.">
        <Link to="/admin/audit"><Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border border-white/30">View Audit Logs</Button></Link>
      </DashboardHero>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading ? <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </> : <>
            <StatCard style={{ animationDelay: "0ms" }} title="Total Users" value={data.totalUsers.value} subtitle={`${data.totalUsers.alumniCount} alumni + ${data.totalUsers.staffCount} staff`} icon={Users} color="blue" trend={{
            value: data.totalUsers.trend,
            label: "this month"
          }} />
            <StatCard style={{ animationDelay: "60ms" }} title="HR Users" value={data.hrUsers.value} subtitle="Staff accounts with HR role" icon={Building2} color="green" />
            <StatCard style={{ animationDelay: "120ms" }} title="Active Roles" value={data.activeRoles.value} subtitle="Across all portals" icon={Shield} color="orange" />
            <StatCard style={{ animationDelay: "180ms" }} title="Audit Events (24h)" value={data.auditEvents.value} subtitle={`${data.auditEvents.failedCount} failed logins`} icon={Database} color="slate" trend={{
            value: data.auditEvents.trend,
            label: "vs prior 24h"
          }} />
          </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">System Performance (Today)</CardTitle></CardHeader>
          <CardContent>
            {loading ? <ChartSkeleton height={200} /> : chartData.length === 0 ? <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Collecting metrics...</div> : <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" tick={{
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }} axisLine={false} tickLine={false} />
                    <YAxis tick={{
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  fontSize: "12px"
                }} />
                    <Line type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} dot={false} name="Memory %" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-3 h-1 rounded-full bg-primary" />CPU: {metrics?.current.cpu ?? "—"}%</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-3 h-1 rounded-full bg-emerald-500" />Memory: {metrics?.current.memory ?? "—"}%</div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Reflects the server host running this app; history fills in over time as samples are collected.</p>
              </>}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Users by Role</CardTitle></CardHeader>
          <CardContent>
            {loading ? <ChartSkeleton height={200} /> : <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.usersByRole ?? []} layout="vertical">
                <XAxis type="number" tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "12px"
              }} />
                <Bar dataKey="users" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">HR Users</CardTitle>
            <Link to="/admin/hr-users"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all<ArrowRight className="h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : <>
            {(data?.staffPreview.length ?? 0) === 0 && <p className="text-sm text-muted-foreground text-center py-4">No staff accounts.</p>}
            {data?.staffPreview.map(u => <div key={u.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {u.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.roleName || u.role}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${u.active ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}`}>{u.active ? "active" : "inactive"}</Badge>
              </div>)}
            </>}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Audit Events</CardTitle>
            <Link to="/admin/audit"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">View all<ArrowRight className="h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : auditLogs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No audit events yet.</p> : auditLogs.map(e => <div key={e.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${e.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{e.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.actor_label}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit"
              })}
                </span>
              </div>)}
          </CardContent>
        </Card>
      </div>
    </>;
}
