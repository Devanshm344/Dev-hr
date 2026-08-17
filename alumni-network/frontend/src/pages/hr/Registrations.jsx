import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Eye, Check, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const PAGE_SIZE = 10;
export default function PendingRegistrationsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    active: 0,
    rejected: 0
  });
  const [actioningId, setActioningId] = useState(null);
  const loadRegistrations = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status: "pending",
      page: String(page),
      pageSize: String(PAGE_SIZE)
    });
    if (search) params.set("search", search);
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };
  const loadStats = async () => {
    const [p, a, r] = await Promise.all([fetch("/api/users?status=pending&pageSize=1").then(res => res.json()), fetch("/api/users?status=active&pageSize=1").then(res => res.json()), fetch("/api/users?status=rejected&pageSize=1").then(res => res.json())]);
    setStats({
      pending: p.total ?? 0,
      active: a.total ?? 0,
      rejected: r.total ?? 0
    });
  };
  useEffect(() => {
    const t = setTimeout(loadRegistrations, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);
  useEffect(() => {
    loadStats();
  }, []);
  const handleSearchChange = v => {
    setSearch(v);
    setPage(1);
  };
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
    await Promise.all([loadRegistrations(), loadStats()]);
    setActioningId(null);
    setSelected(null);
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <>
      <PageHeader title="Pending Registrations" description="Review and approve alumni registration requests." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Pending Registrations"
    }]} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{stats.pending}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.active}</p><p className="text-xs text-muted-foreground">Active Alumni</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{stats.rejected}</p><p className="text-xs text-muted-foreground">Rejected</p></CardContent></Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Registration Queue</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 h-9 w-48" value={search} onChange={e => handleSearchChange(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Applicant", "Contact", "LinkedIn", "Exited Year", "Applied", "Status", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
                {!loading && users.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">No pending registrations.</td></tr>}
                {users.map(r => <tr key={r.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={r.profile_photo_path ?? undefined} alt={r.full_name} className="object-cover" />
                          <AvatarFallback className="td-gradient text-white text-xs font-semibold">{r.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.full_name}</p>
                          <p className="text-xs text-muted-foreground">{r.designation || "—"}{r.employer ? ` at ${r.employer}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-foreground">{r.email}</p>
                      <p className="text-xs text-muted-foreground">{r.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      {r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Profile</a> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{r.exited_year || "—"}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}</td>
                    <td className="px-6 py-4"><StatusBadge status="pending" /></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(r)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-2 text-xs" disabled={actioningId === r.id} onClick={() => handleDecision(r.id, "active")}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 text-xs" disabled={actioningId === r.id} onClick={() => handleDecision(r.id, "rejected")}>Reject</Button>
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-xs text-muted-foreground">Showing {users.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + users.length} of {total}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <span className="flex items-center px-3 text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registration Details</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-border">
                  <AvatarImage src={selected.profile_photo_path ?? undefined} alt={selected.full_name} className="object-cover" />
                  <AvatarFallback className="td-gradient text-white text-xl font-semibold">{selected.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selected.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.designation || "—"} at {selected.employer || "—"}</p>
                  <StatusBadge status="pending" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["Email", selected.email], ["Phone", selected.phone], ["Industry", selected.industry], ["Professional Status", selected.professional_status], ["Joining", selected.joining_month && selected.joining_year ? `${selected.joining_month} ${selected.joining_year}` : null], ["Exited Year", selected.exited_year], ["Applied", new Date(selected.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })]].map(([k, v]) => <div key={k} className="min-w-0"><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium text-foreground break-words">{v || "—"}</p></div>)}
              </div>
              {selected.roles_held && <div><p className="text-xs text-muted-foreground">Roles Held</p><p className="text-sm text-foreground">{selected.roles_held}</p></div>}
              {selected.achievements && <div><p className="text-xs text-muted-foreground">Achievements</p><p className="text-sm text-foreground">{selected.achievements}</p></div>}
              <div className="flex items-center gap-3 text-sm">
                {selected.linkedin_url && <a href={selected.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">LinkedIn Profile</a>}
                {selected.resume_path && <a href={selected.resume_path} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Resume</a>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0" disabled={actioningId === selected.id} onClick={() => handleDecision(selected.id, "active")}>
                  <Check className="h-4 w-4 mr-2" />Approve
                </Button>
                <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" disabled={actioningId === selected.id} onClick={() => handleDecision(selected.id, "rejected")}>
                  <X className="h-4 w-4 mr-2" />Reject
                </Button>
              </div>
            </div>}
        </DialogContent>
      </Dialog>
    </>;
}
