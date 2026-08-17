import { useEffect, useState } from "react";
import { PageHeader, StatCard } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Gift, Calendar, Download } from "lucide-react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
export default function HRReports() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/hr/reports?year=${year}`).then(res => res.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [year]);
  const handleExport = () => {
    window.location.href = `/api/hr/reports/export?year=${year}`;
  };
  return <>
      <PageHeader title="Reports & Analytics" description="Comprehensive insights into alumni engagement and portal usage." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Reports"
    }]}>
        <div className="flex gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(data?.years ?? [new Date().getFullYear()]).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}><Download className="h-4 w-4" />Export CSV</Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Alumni Growth" value={loading ? "—" : data.kpis.alumniGrowth.value} icon={TrendingUp} color="green" trend={data ? {
        value: data.kpis.alumniGrowth.trend,
        label: "vs prior year"
      } : undefined} />
        <StatCard title="Benefit Usage" value={loading ? "—" : data.kpis.benefitUsage.value} icon={Gift} color="orange" trend={data ? {
        value: data.kpis.benefitUsage.trend,
        label: "vs prior year"
      } : undefined} />
        <StatCard title="Event Attendance" value={loading ? "—" : data.kpis.eventAttendance.value} icon={Calendar} color="purple" trend={data ? {
        value: data.kpis.eventAttendance.trend,
        label: "vs prior year"
      } : undefined} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alumni Growth {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.monthlyGrowth ?? []}>
                <defs>
                  <linearGradient id="alumniGrad" x1="0" y1="0" x2="0" y2="1">
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
              }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "12px"
              }} />
                <Area type="monotone" dataKey="alumni" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#alumniGrad)" name="Total Alumni" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Benefit Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {!loading && (data?.benefitCategories.length ?? 0) === 0 ? <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No benefit requests in {year}</div> : <div className="flex items-center gap-6">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data?.benefitCategories ?? []} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value">
                      {(data?.benefitCategories ?? []).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  fontSize: "12px"
                }} formatter={v => [`${v}%`, "Usage"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 shrink-0">
                  {data?.benefitCategories.map(d => <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                  background: d.color
                }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium text-foreground ml-auto">{d.value}%</span>
                    </div>)}
                </div>
              </div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Event Attendance History ({year})</CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && (data?.eventAttendance.length ?? 0) === 0 ? <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No events in {year}</div> : <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.eventAttendance ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="event" tick={{
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))"
            }} axisLine={false} tickLine={false} />
                <YAxis tick={{
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
                <Bar dataKey="attendees" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Attendees" />
              </BarChart>
            </ResponsiveContainer>}
        </CardContent>
      </Card>
    </>;
}
