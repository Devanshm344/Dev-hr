import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
export default function HRNetworking() {
  const [stats, setStats] = useState(null);
  const [alumni, setAlumni] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/hr/networking${params}`).then(res => res.json()).then(data => {
      setStats(data.stats ?? null);
      setAlumni(data.alumni ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  return <>
      <PageHeader title="Connections" description="Monitor and manage alumni networking activity." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Connections"
    }]} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{stats?.total_connections ?? "—"}</p><p className="text-xs text-muted-foreground">Total Connections Made</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-orange-500">{stats?.active_networkers ?? "—"}</p><p className="text-xs text-muted-foreground">Active Networkers</p></CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between">
          <CardTitle className="text-base">Alumni Network Directory</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search alumni..." className="pl-9 h-9 w-48" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Alumni", "Company", "Industry", "Connections", "Status"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
                {!loading && alumni.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">No alumni found.</td></tr>}
                {alumni.map(a => <tr key={a.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full td-gradient flex items-center justify-center text-white text-xs font-semibold">{a.full_name.charAt(0)}</div>
                        <span className="text-sm font-medium text-foreground">{a.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{a.employer || "—"}</td>
                    <td className="px-6 py-4"><Badge variant="secondary" className="text-xs">{a.industry}</Badge></td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{a.connections}</td>
                    <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>;
}
