import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, FileText, Upload, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
const categories = ["Career", "Education", "Networking", "Wellness", "Lifestyle", "Financial", "Recognition"];

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const emptyForm = {
  title: "",
  description: "",
  category: "Career",
  active: true
};
export default function HRBenefitsManagement() {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resourceBenefit, setResourceBenefit] = useState(null);
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [resourceError, setResourceError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
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
        setOpen(false);
        load();
      } else {
        const res = await fetch("/api/benefits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        setOpen(false);
        load();
        if (data.benefit) openResources(data.benefit);
      }
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
  const loadResources = async benefitId => {
    setResourcesLoading(true);
    try {
      const res = await fetch(`/api/benefits/${benefitId}/resources`);
      const data = await res.json();
      setResources(data.resources ?? []);
    } finally {
      setResourcesLoading(false);
    }
  };
  const openResources = b => {
    setResourceBenefit(b);
    setPendingFiles([]);
    setResourceError(null);
    loadResources(b.id);
  };
  const handleFilesPicked = fileList => {
    setPendingFiles(prev => [...prev, ...Array.from(fileList ?? [])]);
  };
  const handleUploadResources = async () => {
    if (!resourceBenefit || pendingFiles.length === 0) return;
    setUploading(true);
    setResourceError(null);
    try {
      const formData = new FormData();
      pendingFiles.forEach(f => formData.append("files", f));
      const res = await fetch(`/api/benefits/${resourceBenefit.id}/resources`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed.");
      }
      setPendingFiles([]);
      await loadResources(resourceBenefit.id);
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  const handleDeleteResource = async resourceId => {
    if (!confirm("Delete this resource? Alumni will no longer be able to access it.")) return;
    await fetch(`/api/benefits/resources/${resourceId}`, { method: "DELETE" });
    if (resourceBenefit) await loadResources(resourceBenefit.id);
  };
  return <>
      <PageHeader title="Benefits Management" description="Create, edit, and manage alumni benefit programs." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Benefits Management"
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{loading ? "Loading..." : `${benefits.length} Benefits`}</CardTitle>
        </CardHeader>
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
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openResources(b)} title="Manage resources"><FileText className="h-3.5 w-3.5" /></Button>
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

      <Dialog open={!!resourceBenefit} onOpenChange={o => !o && setResourceBenefit(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Resources — {resourceBenefit?.title}</DialogTitle></DialogHeader>
          {resourceBenefit && <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Files uploaded here are immediately available to any logged-in alumni for this benefit. Any file type, any number of files.
              </p>

              {resourcesLoading && <p className="text-xs text-muted-foreground">Loading resources...</p>}
              {!resourcesLoading && resources.length === 0 && <p className="text-xs text-muted-foreground">No resources uploaded yet.</p>}
              {!resourcesLoading && resources.length > 0 && <div className="space-y-2">
                  {resources.map(r => <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{r.original_filename}</p>
                          <p className="text-[11px] text-muted-foreground">{formatFileSize(r.file_size_bytes)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                          <a href={`/api/benefits/resources/${r.id}/download`} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteResource(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>)}
                </div>}

              <div className={cn("border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer", dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")} onClick={() => document.getElementById("benefit-resource-file-input")?.click()} onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }} onDragLeave={() => setDragOver(false)} onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              handleFilesPicked(e.dataTransfer.files);
            }}>
                <input id="benefit-resource-file-input" type="file" multiple className="hidden" onChange={e => handleFilesPicked(e.target.files)} />
                <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Drag and drop files, or <span className="text-primary font-medium">browse</span></p>
              </div>

              {pendingFiles.length > 0 && <div className="space-y-1">
                  {pendingFiles.map((f, i) => <div key={i} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-muted-foreground hover:text-destructive shrink-0 ml-2" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                    </div>)}
                </div>}

              {resourceError && <p className="text-xs text-destructive">{resourceError}</p>}

              <div className="flex justify-end">
                <Button size="sm" className="td-gradient border-0 text-white" disabled={pendingFiles.length === 0 || uploading} onClick={handleUploadResources}>
                  {uploading ? "Uploading..." : `Upload ${pendingFiles.length || ""}`.trim()}
                </Button>
              </div>
            </div>}
        </DialogContent>
      </Dialog>
    </>;
}
