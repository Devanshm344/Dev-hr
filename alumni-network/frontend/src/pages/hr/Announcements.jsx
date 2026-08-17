import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
const emptyForm = {
  title: "",
  content: "",
  author: "HR Team",
  priority: "medium",
  published: true
};
export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const load = () => {
    setLoading(true);
    fetch("/api/announcements").then(res => res.json()).then(data => setAnnouncements(data.announcements ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = a => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      author: a.author,
      priority: a.priority,
      published: a.published
    });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.author.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/announcements/${editingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        });
      } else {
        await fetch("/api/announcements", {
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
  const togglePublished = async a => {
    setAnnouncements(prev => prev.map(x => x.id === a.id ? {
      ...x,
      published: !x.published
    } : x));
    await fetch(`/api/announcements/${a.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        published: !a.published
      })
    }).catch(() => load());
  };
  const handleDelete = async id => {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    await fetch(`/api/announcements/${id}`, {
      method: "DELETE"
    });
    load();
  };
  return <>
      <PageHeader title="Announcements" description="Create and manage community announcements." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Announcements"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />New Announcement
        </Button>
      </PageHeader>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!loading && announcements.length === 0 && <EmptyState icon={Megaphone} title="No announcements yet" description="Create your first announcement to notify alumni." />}

      <div className="space-y-4">
        {announcements.map(a => <Card key={a.id} className={cn("border-border border-l-4", a.priority === "high" ? "border-l-red-500" : a.priority === "medium" ? "border-l-amber-500" : "border-l-slate-400")}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", a.priority === "high" ? "bg-red-100 text-red-600 dark:bg-red-900/30" : a.priority === "medium" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground">{a.title}</h3>
                      <Badge variant={a.priority === "high" ? "destructive" : "secondary"} className="text-[10px]">{a.priority}</Badge>
                      {!a.published && <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(a.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })} · Posted by {a.author}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Switch checked={a.published} onCheckedChange={() => togglePublished(a)} />
                    <span className="text-xs text-muted-foreground">{a.published ? "Published" : "Unpublished"}</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(a)}><Edit className="h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title *</Label><Input placeholder="Announcement title" value={form.title} onChange={e => setForm(f => ({
              ...f,
              title: e.target.value
            }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.priority} onChange={e => setForm(f => ({
                ...f,
                priority: e.target.value
              }))}>
                  <option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>Posted By *</Label><Input placeholder="e.g., HR Team" value={form.author} onChange={e => setForm(f => ({
                ...f,
                author: e.target.value
              }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Content *</Label><textarea className="w-full h-32 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Write your announcement content..." value={form.content} onChange={e => setForm(f => ({
              ...f,
              content: e.target.value
            }))} /></div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Publish immediately</Label>
              <Switch checked={form.published} onCheckedChange={v => setForm(f => ({
              ...f,
              published: v
            }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
