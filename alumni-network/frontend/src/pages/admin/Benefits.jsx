import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
const categories = ["Career", "Education", "Networking", "Wellness", "Lifestyle", "Financial", "Recognition"];
const emptyForm = {
  title: "",
  description: "",
  category: "Career",
  active: true
};
export default function AdminBenefits() {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const load = () => {
    setLoading(true);
    fetch("/api/benefits").then(res => res.json()).then(data => setBenefits(data.benefits ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      fetch(`/api/benefits${params}`).then(res => res.json()).then(data => setBenefits(data.benefits ?? [])).catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  };
  const openEdit = b => {
    setEditingId(b.id);
    setForm({
      title: b.title,
      description: b.description,
      category: b.category,
      active: b.active
    });
    setError(null);
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetch(`/api/benefits/${editingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        });
      } else {
        await fetch("/api/benefits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        });
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async b => {
    setBenefits(prev => prev.map(x => x.id === b.id ? {
      ...x,
      active: !x.active
    } : x));
    await fetch(`/api/benefits/${b.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        active: !b.active
      })
    }).catch(() => load());
  };
  const handleDelete = async b => {
    if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/benefits/${b.id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not delete this benefit.");
      return;
    }
    load();
  };
  return <>
      <PageHeader title="Benefits" description="System-level management of all alumni benefits." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Benefits"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Add Benefit
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search benefits..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">{loading ? "Loading..." : `${benefits.length} Benefits`}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["#", "Benefit", "Category", "Status", "Active", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {benefits.map((b, i) => <tr key={b.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-muted-foreground">{i + 1}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground max-w-xs truncate">{b.description}</p>
                  </td>
                  <td className="px-6 py-4"><Badge variant="secondary" className="text-xs">{b.category}</Badge></td>
                  <td className="px-6 py-4"><StatusBadge status={b.active ? "active" : "inactive"} /></td>
                  <td className="px-6 py-4">
                    <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(b)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>)}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Benefit" : "Add New Benefit"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Benefit Title *</Label><Input placeholder="e.g., Certification Reimbursement" value={form.title} onChange={e => setForm(f => ({
              ...f,
              title: e.target.value
            }))} /></div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.category} onChange={e => setForm(f => ({
              ...f,
              category: e.target.value
            }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Description *</Label><textarea className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Describe this benefit..." value={form.description} onChange={e => setForm(f => ({
              ...f,
              description: e.target.value
            }))} /></div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Active immediately</Label>
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({
              ...f,
              active: v
            }))} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Benefit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
