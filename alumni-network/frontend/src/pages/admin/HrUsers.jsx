import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, UserX, UserCheck, Key, Eye, EyeOff, RefreshCw } from "lucide-react";
import { timeAgo } from "@/lib/utils";
const emptyCreateForm = {
  fullName: "",
  email: "",
  password: "",
  roleId: ""
};
const emptyEditForm = {
  fullName: "",
  email: "",
  roleId: ""
};
export default function AdminHRUsers() {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createError, setCreateError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = () => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/admin/staff-users${params}`).then(res => res.json()).then(data => setStaff(data.staff ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  const handleRefresh = () => {
    setRefreshing(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/admin/staff-users${params}`).then(res => res.json()).then(data => setStaff(data.staff ?? [])).catch(() => {}).finally(() => setRefreshing(false));
  };
  useEffect(() => {
    fetch("/api/admin/roles").then(res => res.json()).then(data => setRoles(data.roles ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const handleCreate = async () => {
    setCreateError(null);
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.roleId) {
      setCreateError("Name, email, and role are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/staff-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...createForm,
          roleId: Number(createForm.roleId)
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };
  const openEdit = u => {
    setEditing(u);
    setEditForm({
      fullName: u.full_name,
      email: u.email,
      roleId: u.role_id ? String(u.role_id) : ""
    });
    setEditError(null);
  };
  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff-users/${editing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: editForm.fullName,
          email: editForm.email,
          roleId: Number(editForm.roleId)
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setEditing(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };
  const handleToggleActive = async u => {
    await fetch(`/api/admin/staff-users/${u.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        active: !u.active
      })
    });
    load();
  };
  const handleDelete = async id => {
    if (!confirm("Delete this staff account? This cannot be undone.")) return;
    await fetch(`/api/admin/staff-users/${id}`, {
      method: "DELETE"
    });
    load();
  };
  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetError(null);
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff-users/${resetTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          newPassword
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };
  return <>
      <PageHeader title="HR Users" description="Manage HR and Admin team members and their portal access." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "HR Users"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />Add Staff User
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{staff.length} Staff Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["User", "Email", "Role", "Last Login", "Status", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
              {!loading && staff.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">No staff users found.</td></tr>}
              {staff.map(u => <tr key={u.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {u.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <p className="text-sm font-medium text-foreground">{u.full_name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-6 py-4"><Badge variant="secondary" className="text-xs">{u.role_name || u.role}</Badge></td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{u.last_login ? timeAgo(u.last_login) : "Never"}</td>
                  <td className="px-6 py-4"><StatusBadge status={u.active ? "active" : "inactive"} /></td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(u)} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                      setResetTarget(u);
                      setNewPassword("");
                      setResetError(null);
                    }} title="Reset Password"><Key className="h-3.5 w-3.5" /></Button>
                      {u.active ? <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-600" onClick={() => handleToggleActive(u)} title="Deactivate"><UserX className="h-3.5 w-3.5" /></Button> : <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => handleToggleActive(u)} title="Activate"><UserCheck className="h-3.5 w-3.5" /></Button>}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(u.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>)}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Staff User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input placeholder="Full name" value={createForm.fullName} onChange={e => setCreateForm(f => ({
              ...f,
              fullName: e.target.value
            }))} /></div>
            <div className="space-y-1.5"><Label>Email Address *</Label><Input type="email" placeholder="user@techdemocracy.com" value={createForm.email} onChange={e => setCreateForm(f => ({
              ...f,
              email: e.target.value
            }))} /></div>
            <div className="space-y-1.5">
              <Label>Temporary Password *</Label>
              <div className="relative">
                <Input type={showCreatePassword ? "text" : "password"} placeholder="At least 8 characters" className="pr-10" value={createForm.password} onChange={e => setCreateForm(f => ({
                ...f,
                password: e.target.value
              }))} />
                <button type="button" onClick={() => setShowCreatePassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={createForm.roleId} onChange={e => setCreateForm(f => ({
              ...f,
              roleId: e.target.value
            }))}>
                <option value="">Select a role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.base_role === "hr" ? "HR Portal" : "Admin Portal"})</option>)}
              </select>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Staff User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm.fullName} onChange={e => setEditForm(f => ({
              ...f,
              fullName: e.target.value
            }))} /></div>
            <div className="space-y-1.5"><Label>Email Address</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({
              ...f,
              email: e.target.value
            }))} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={editForm.roleId} onChange={e => setEditForm(f => ({
              ...f,
              roleId: e.target.value
            }))}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.base_role === "hr" ? "HR Portal" : "Admin Portal"})</option>)}
              </select>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={o => !o && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Set a new password for {resetTarget?.full_name}. There's no email system to send a reset link, so share this password with them directly.</p>
            <div className="space-y-1.5">
              <Label>New Password *</Label>
              <div className="relative">
                <Input type={showResetPassword ? "text" : "password"} placeholder="At least 8 characters" className="pr-10" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <button type="button" onClick={() => setShowResetPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleResetPassword} disabled={saving}>{saving ? "Saving..." : "Reset Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
