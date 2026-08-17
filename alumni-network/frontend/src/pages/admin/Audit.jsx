import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    successful24h: 0,
    failed24h: 0,
    alerts: 0
  });
  const [alertDetails, setAlertDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("all");
  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({
      pageSize: "50"
    });
    if (search) params.set("search", search);
    if (eventType !== "all") params.set("eventType", eventType);
    fetch(`/api/admin/audit-logs?${params.toString()}`).then(res => res.json()).then(data => {
      setLogs(data.logs ?? []);
      setStats(data.stats ?? {
        successful24h: 0,
        failed24h: 0,
        alerts: 0
      });
      setAlertDetails(data.alertDetails ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, eventType]);
  const handleExport = () => {
    window.location.href = "/api/admin/audit-logs/export";
  };
  return <>
      <PageHeader title="Audit Logs" description="Log of real login and registration-decision activity for compliance and security." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Audit Logs"
    }]}>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={load}><RefreshCw className="h-4 w-4" />Refresh</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}><Download className="h-4 w-4" />Export</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.successful24h}</p>
            <p className="text-xs text-muted-foreground">Successful Events (24h)</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed24h}</p>
            <p className="text-xs text-muted-foreground">Failed Events (24h)</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.alerts}</p>
            <p className="text-xs text-muted-foreground">Alerts</p>
          </CardContent>
        </Card>
      </div>

      {alertDetails.map((a, i) => <div key={i} className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Security Alert</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
              {a.count} failed login attempts for &quot;{a.actor_label}&quot;{a.ip_address ? ` from IP ${a.ip_address}` : ""} in the last 24 hours.
            </p>
          </div>
        </div>)}

      <Card className="border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Activity Log</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-9 h-9 w-48" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All Events" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="login">Login Events</SelectItem>
                <SelectItem value="admin">Admin Actions</SelectItem>
                <SelectItem value="failed">Failed Events</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Status", "Action", "User", "Resource", "IP Address", "Timestamp"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground font-sans">Loading...</td></tr>}
                {!loading && logs.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground font-sans">No audit events yet.</td></tr>}
                {logs.map(log => <tr key={log.id} className={cn("even:bg-muted/30 hover:bg-primary/5 transition-colors", log.status === "failed" && "bg-red-50/30 dark:bg-red-950/10")}>
                    <td className="px-6 py-4">
                      {log.status === "success" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("text-xs font-semibold not-italic", log.status === "failed" ? "text-red-600 dark:text-red-400" : "text-foreground")}>{log.action}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{log.actor_label}</td>
                    <td className="px-6 py-4"><Badge variant="secondary" className="text-[10px]">{log.resource}</Badge></td>
                    <td className="px-6 py-4 text-muted-foreground">{log.ip_address || "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>;
}
