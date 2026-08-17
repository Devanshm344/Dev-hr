import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Eye, Edit, Trash2, UserX, UserCheck, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { allCountries } from "country-region-data";
const emptyEditForm = {
  firstName: "",
  lastName: "",
  phone: "",
  country: "",
  state: "",
  employer: "",
  designation: "",
  industry: "",
  joiningYear: "",
  linkedinUrl: ""
};
const isValidLinkedinUrl = value => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};
const PAGE_SIZE = 10;
export default function HRAlumniManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [alumni, setAlumni] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const loadAlumni = async () => {
    setLoading(true);
    const statusParam = status === "all" ? "active,inactive" : status;
    const params = new URLSearchParams({
      status: statusParam,
      page: String(page),
      pageSize: String(PAGE_SIZE)
    });
    if (search) params.set("search", search);
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    setAlumni(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };
  useEffect(() => {
    const t = setTimeout(loadAlumni, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);
  const handleSearchChange = v => {
    setSearch(v);
    setPage(1);
  };
  const handleStatusChange = s => {
    setStatus(s);
    setPage(1);
  };
  const handleExport = () => {
    const statusParam = status === "all" ? "active,inactive" : status;
    const params = new URLSearchParams({
      status: statusParam
    });
    if (search) params.set("search", search);
    window.location.href = `/api/users/export?${params}`;
  };
  const handleToggleActive = async u => {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: u.status === "active" ? "inactive" : "active"
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not update this alumni's status.");
      return;
    }
    await loadAlumni();
  };
  const handleDelete = async id => {
    if (!confirm("Delete this alumni record? This cannot be undone.")) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not delete this alumni record.");
      return;
    }
    await loadAlumni();
  };
  const openEdit = u => {
    setEditing(u);
    setEditForm({
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      country: u.country ?? "",
      state: u.state ?? "",
      employer: u.employer ?? "",
      designation: u.designation ?? "",
      industry: u.industry ?? "",
      joiningYear: u.joining_year != null ? String(u.joining_year) : "",
      linkedinUrl: u.linkedin_url ?? ""
    });
  };
  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phone: editForm.phone,
          country: editForm.country,
          state: editForm.state,
          employer: editForm.employer,
          designation: editForm.designation,
          industry: editForm.industry,
          joiningYear: editForm.joiningYear.trim() === "" ? null : Number(editForm.joiningYear),
          linkedinUrl: editForm.linkedinUrl.trim()
        })
      });
      await loadAlumni();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };
  const regionsForCountry = allCountries.find(([name]) => name === editForm.country)?.[2] ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <>
      <PageHeader title="Alumni Management" description="View, manage, and update alumni member records." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Alumni Management"
    }]}>
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExport}><Download className="h-4 w-4" />Export</Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search alumni..." className="pl-9" value={search} onChange={e => handleSearchChange(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "active", "inactive"].map(s => <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => handleStatusChange(s)} className={cn("h-9 capitalize", status === s && "td-gradient border-0 text-white")}>
              {s}
            </Button>)}
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">{total} Alumni</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Alumni", "Email", "LinkedIn", "Exited Year", "Status", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
                {!loading && alumni.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">No alumni found.</td></tr>}
                {alumni.map(a => <tr key={a.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={a.profile_photo_path ?? undefined} alt={a.full_name} className="object-cover" />
                          <AvatarFallback className="td-gradient text-white text-xs font-semibold">{a.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground">{a.designation || "—"}{a.employer ? ` at ${a.employer}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{a.email}</td>
                    <td className="px-6 py-4">
                      {a.linkedin_url ? <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Profile</a> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{a.exited_year || "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(a)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(a)}><Edit className="h-3.5 w-3.5" /></Button>
                        {a.status === "active" ? <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700" onClick={() => handleToggleActive(a)}><UserX className="h-3.5 w-3.5" /></Button> : <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700" onClick={() => handleToggleActive(a)}><UserCheck className="h-3.5 w-3.5" /></Button>}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-xs text-muted-foreground">Showing {alumni.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + alumni.length} of {total} alumni</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <span className="flex items-center px-3 text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Alumni Details</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-border">
                  <AvatarImage src={selected.profile_photo_path ?? undefined} alt={selected.full_name} className="object-cover" />
                  <AvatarFallback className="td-gradient text-white text-xl font-semibold">{selected.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selected.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.designation || "—"} at {selected.employer || "—"}</p>
                  <StatusBadge status={selected.status} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["Email", selected.email], ["Phone", selected.phone], ["Country", selected.country], ["State", selected.state], ["Industry", selected.industry], ["Joining Year", selected.joining_year], ["Exited Year", selected.exited_year]].map(([k, v]) => <div key={k} className="min-w-0"><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium text-foreground break-words">{v || "—"}</p></div>)}
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Alumni Record</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input value={editForm.firstName} onChange={e => setEditForm(f => ({
                ...f,
                firstName: e.target.value
              }))} /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input value={editForm.lastName} onChange={e => setEditForm(f => ({
                ...f,
                lastName: e.target.value
              }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({
              ...f,
              phone: e.target.value
            }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.country} onChange={e => setEditForm(f => ({
                ...f,
                country: e.target.value,
                state: ""
              }))}>
                  <option value="">Select country</option>
                  {allCountries.map(([name]) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>State / Region</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" value={editForm.state} onChange={e => setEditForm(f => ({
                ...f,
                state: e.target.value
              }))} disabled={regionsForCountry.length === 0}>
                  <option value="">{regionsForCountry.length === 0 ? "Select country first" : "Select state / region"}</option>
                  {regionsForCountry.map(([name]) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Employer</Label><Input value={editForm.employer} onChange={e => setEditForm(f => ({
                ...f,
                employer: e.target.value
              }))} /></div>
              <div className="space-y-1.5"><Label>Designation</Label><Input value={editForm.designation} onChange={e => setEditForm(f => ({
                ...f,
                designation: e.target.value
              }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Industry</Label><Input value={editForm.industry} onChange={e => setEditForm(f => ({
                ...f,
                industry: e.target.value
              }))} /></div>
              <div className="space-y-1.5"><Label>Joining Year</Label><Input type="number" value={editForm.joiningYear} onChange={e => setEditForm(f => ({
                ...f,
                joiningYear: e.target.value
              }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>LinkedIn Profile URL</Label>
              <Input placeholder="https://linkedin.com/in/yourprofile" value={editForm.linkedinUrl} onChange={e => setEditForm(f => ({
                ...f,
                linkedinUrl: e.target.value
              }))} />
              {!isValidLinkedinUrl(editForm.linkedinUrl) && <p className="text-xs text-destructive mt-0.5">Enter a full URL, e.g. https://linkedin.com/in/yourprofile</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSaveEdit} disabled={saving || !isValidLinkedinUrl(editForm.linkedinUrl)}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
