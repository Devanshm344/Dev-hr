import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Shield, Users, Key } from "lucide-react";
const permissionGroups = {
  "Alumni Management": ["View Alumni", "Edit Alumni", "Delete Alumni", "Approve Alumni", "Suspend Alumni"],
  "Benefits": ["View Benefits", "Manage Benefits", "Approve Requests"],
  "Events": ["View Events", "Create Events", "Edit Events", "Delete Events", "Publish Events"],
  "Reports": ["View Reports", "Export Reports"],
  "Settings": ["System Settings", "HR Settings"],
  "Admin": ["Manage Roles", "Manage HR Users", "View Audit Logs", "CMS Access"]
};
const emptyForm = {
  name: "",
  description: "",
  baseRole: "hr",
  permissions: []
};
export default function AdminRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const load = () => {
    setLoading(true);
    fetch("/api/admin/roles").then(res => res.json()).then(data => setRoles(data.roles ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  };
  const openEdit = r => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      description: r.description ?? "",
      baseRole: r.base_role,
      permissions: r.permissions
    });
    setError(null);
    setSelected(null);
    setOpen(true);
  };
  const togglePermission = perm => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm]
    }));
  };
  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/admin/roles/${editingId}` : "/api/admin/roles", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async id => {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/roles/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not delete this role.");
      return;
    }
    load();
  };
  return <>
      <PageHeader title="Role Management" description="Define and manage access roles across the portal." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Role Management"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Create Role
        </Button>
      </PageHeader>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!loading && roles.length === 0 && <p className="text-sm text-muted-foreground">No roles yet.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {roles.map(role => <Card key={role.id} className="border-border hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelected(role)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                  <Shield className="h-5 w-5 text-primary group-hover:text-white" />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => {
                e.stopPropagation();
                openEdit(role);
              }}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={e => {
                e.stopPropagation();
                handleDelete(role.id);
              }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <h3 className="font-semibold text-foreground">{role.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{role.description || "No description"}</p>
              <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide">{role.base_role === "hr" ? "HR Portal" : "Admin Portal"} access</p>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{role.users} users</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Key className="h-3.5 w-3.5" />{role.permissions.length} permissions</div>
              </div>
            </CardContent>
          </Card>)}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Role" : "Create New Role"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Role Name *</Label><Input placeholder="e.g., Event Manager" value={form.name} onChange={e => setForm(f => ({
              ...f,
              name: e.target.value
            }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input placeholder="Brief description of this role" value={form.description} onChange={e => setForm(f => ({
              ...f,
              description: e.target.value
            }))} /></div>
            <div className="space-y-1.5">
              <Label>Portal Access *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.baseRole} onChange={e => setForm(f => ({
              ...f,
              baseRole: e.target.value
            }))}>
                <option value="hr">HR Portal</option>
                <option value="admin">Admin Portal</option>
              </select>
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              {Object.entries(permissionGroups).map(([group, perms]) => <div key={group} className="p-3 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-foreground mb-2">{group}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {perms.map(p => <div key={p} className="flex items-center gap-2">
                        <Checkbox id={p} checked={form.permissions.includes(p)} onCheckedChange={() => togglePermission(p)} />
                        <Label htmlFor={p} className="text-xs font-normal cursor-pointer">{p}</Label>
                      </div>)}
                  </div>
                </div>)}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selected.description || "No description"}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary text-center">
                  <p className="text-xl font-bold text-foreground">{selected.users}</p>
                  <p className="text-xs text-muted-foreground">Users assigned</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary text-center">
                  <p className="text-xl font-bold text-foreground">{selected.permissions.length}</p>
                  <p className="text-xs text-muted-foreground">Permissions</p>
                </div>
              </div>
              <Button className="w-full td-gradient border-0 text-white" onClick={() => openEdit(selected)}>Edit Role</Button>
            </div>}
        </DialogContent>
      </Dialog>
    </>;
}
