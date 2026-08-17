import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Search, Eye, Trash2 } from "lucide-react";
function ActionButton({
  label,
  onClick,
  className,
  children
}) {
  return <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="ghost" className={`h-7 w-7 p-0 ${className ?? ""}`} onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>;
}
export default function HRServiceRequests() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({
      all: "true",
      pageSize: "100"
    });
    if (search) params.set("search", search);
    fetch(`/api/service-requests?${params.toString()}`).then(res => res.json()).then(data => {
      setRequests(data.requests ?? []);
      setTotal(data.total ?? 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const handleDelete = async id => {
    if (!confirm("Delete this service request? This permanently removes the request and its conversation history.")) return;
    await fetch(`/api/service-requests/${id}`, { method: "DELETE" });
    load();
  };
  return <>
    <TooltipProvider>
      <PageHeader title="Service Requests" description="View alumni questions and chat with them about a benefit." breadcrumbs={[{
        label: "HR Portal"
      }, {
        label: "Service Requests"
      }]} />

      <div className="grid grid-cols-1 max-w-[10rem] gap-4 mb-6">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">All Service Requests</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requests..." className="pl-9 h-9 w-48" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Alumni", "Benefit", "Date", "Priority", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
              {!loading && requests.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">No requests found.</td></tr>}
              {requests.map(r => <tr key={r.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => navigate(`/hr/requests/${r.id}`)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {r.alumni_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm text-foreground">{r.alumni_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{r.benefit_title}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={r.priority} /></td>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <ActionButton label="View details" onClick={() => navigate(`/hr/requests/${r.id}`)}><Eye className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton label="Delete request" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                    </div>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </TooltipProvider>
    </>;
}
