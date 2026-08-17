import { useEffect, useState } from "react";
import { PageHeader, StatCard } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, Gift, Calendar, Download } from "lucide-react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear, currentYear - 1, currentYear - 2];
export default function AdminReports() {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/reports?year=${year}`).then(res => res.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [year]);
  const handleExport = () => {
    window.location.href = `/api/admin/reports/export?year=${year}`;
  };
  return <>
      <PageHeader title="Reports & Analytics" description="System-wide analytics and performance metrics." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Reports"
    }]}>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}><Download className="h-4 w-4" />Export</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Users" value={loading ? "—" : data.totalUsers.value} icon={Users} color="blue" trend={data ? {
        value: data.totalUsers.trend,
        label: "this month"
      } : undefined} />
        <StatCard title="Alumni Growth" value={loading ? "—" : `+${data.alumniGrowth.value}`} icon={TrendingUp} color="green" trend={data ? {
        value: data.alumniGrowth.trend,
        label: "vs last year"
      } : undefined} />
        <StatCard title="Benefit Requests" value={loading ? "—" : data.benefitRequests.value} icon={Gift} color="orange" trend={data ? {
        value: data.benefitRequests.trend,
        label: "vs last year"
      } : undefined} />
        <StatCard title="Events Hosted" value={loading ? "—" : data.eventsHosted.value} icon={Calendar} color="purple" trend={data ? {
        value: data.eventsHosted.trend,
        label: "vs last year"
      } : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">System User Growth ({year})</CardTitle></CardHeader>
          <CardContent>
            {!loading && (data?.userGrowth.length ?? 0) === 0 ? <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No signups recorded for {year}.</div> : <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.userGrowth ?? []}>
                  <defs>
                    <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} />
                  <YAxis tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))"
              }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "12px"
              }} />
                  <Area type="monotone" dataKey="alumni" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#usersGrad)" name="Alumni" />
                </AreaChart>
              </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">User Role Distribution</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data?.roleDistribution ?? []} cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="value">
                  {(data?.roleDistribution ?? []).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "12px"
              }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 shrink-0">
              {(data?.roleDistribution ?? []).map(d => <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{
                background: d.color
              }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium text-foreground ml-auto pl-2">{d.value}</span>
                </div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">Login Activity (Last 7 Days)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.loginActivity ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))"
            }} axisLine={false} tickLine={false} />
              <YAxis tick={{
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))"
            }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "12px"
            }} />
              <Bar dataKey="logins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Logins" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>;
}
