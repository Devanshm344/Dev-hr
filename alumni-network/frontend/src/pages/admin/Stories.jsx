import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Check, X, Trash2, Star, Quote, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
export default function AdminStoriesManagement() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const loadStories = async () => {
    setLoading(true);
    const res = await fetch("/api/stories");
    const data = await res.json();
    setStories(data.stories ?? []);
    setLoading(false);
  };
  useEffect(() => {
    loadStories();
  }, []);
  const filtered = stories.filter(s => {
    const matchesSearch = s.alumni_name.toLowerCase().includes(search.toLowerCase()) || s.quote.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || s.status === filter;
    return matchesSearch && matchesFilter;
  });
  const counts = {
    pending: stories.filter(s => s.status === "pending").length,
    approved: stories.filter(s => s.status === "approved").length,
    rejected: stories.filter(s => s.status === "rejected").length
  };
  const patchStory = async (id, fields) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    await fetch(`/api/stories/${id}`, {
      method: "PATCH",
      body: fd
    });
    await loadStories();
    setSelected(null);
  };
  const handleApprove = id => patchStory(id, {
    status: "approved"
  });
  const handleReject = id => patchStory(id, {
    status: "rejected",
    published: "false"
  });
  const handleTogglePublish = (id, checked) => patchStory(id, {
    published: String(checked)
  });
  const handleDelete = async id => {
    if (!confirm("Delete this story? This cannot be undone.")) return;
    await fetch(`/api/stories/${id}`, {
      method: "DELETE"
    });
    await loadStories();
  };
  return <>
      <PageHeader title="Stories Management" description="Review, approve, and publish alumni success stories submitted from the portal." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Stories Management"
    }]} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{counts.pending}</p><p className="text-xs text-muted-foreground">Pending Review</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{counts.approved}</p><p className="text-xs text-muted-foreground">Approved</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{counts.rejected}</p><p className="text-xs text-muted-foreground">Rejected</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or story..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map(f => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className={cn("h-8 capitalize", filter === f && "td-gradient border-0 text-white")}>
              {f}
            </Button>)}
        </div>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading stories...</p>}
        {!loading && filtered.length === 0 && <EmptyState icon={Quote} title="No stories found" description="Submissions from the Alumni Portal will show up here for review." />}
        {filtered.map(s => <Card key={s.id} className="border-border hover:shadow-sm transition-all">
            <CardContent className="p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                  {s.avatar_path ? <img src={s.avatar_path} alt={s.alumni_name} className="w-full h-full object-cover" /> : <Quote className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-foreground">{s.alumni_name}</h3>
                      {s.role && <p className="text-xs text-muted-foreground">{s.role}</p>}
                      <div className="flex gap-0.5 mt-1">
                        {[...Array(5)].map((_, i) => <Star key={i} className={cn("h-3 w-3", i < s.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      {s.status === "approved" && <Badge variant="outline" className={cn("text-xs gap-1", s.published ? "border-emerald-200 text-emerald-600" : "border-border text-muted-foreground")}>
                          {s.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {s.published ? "Published" : "Draft"}
                        </Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground italic mt-2 line-clamp-2">&quot;{s.quote}&quot;</p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {s.status === "pending" && <>
                      <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-2 text-xs gap-1" onClick={() => handleApprove(s.id)}><Check className="h-3.5 w-3.5" />Approve</Button>
                      <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 text-xs gap-1" onClick={() => handleReject(s.id)}><X className="h-3.5 w-3.5" />Reject</Button>
                    </>}
                  {s.status === "approved" && <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Publish</span>
                      <Switch checked={s.published} onCheckedChange={checked => handleTogglePublish(s.id, checked === true)} />
                    </div>}
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setSelected(s)}>View</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>)}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Story Details</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-secondary flex items-center justify-center border-2 border-border">
                  {selected.avatar_path ? <img src={selected.avatar_path} alt={selected.alumni_name} className="w-full h-full object-cover" /> : <Quote className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selected.alumni_name}</h3>
                  {selected.role && <p className="text-sm text-muted-foreground">{selected.role}</p>}
                  <div className="flex gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < selected.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />)}
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground italic bg-secondary/50 rounded-lg p-4">&quot;{selected.quote}&quot;</p>
              {selected.submitted_by_email && <p className="text-xs text-muted-foreground">Submitted by {selected.submitted_by_email}</p>}
              {selected.status === "pending" && <div className="flex gap-2 pt-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => handleApprove(selected.id)}>
                    <Check className="h-4 w-4 mr-2" />Approve
                  </Button>
                  <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleReject(selected.id)}>
                    <X className="h-4 w-4 mr-2" />Reject
                  </Button>
                </div>}
            </div>}
        </DialogContent>
      </Dialog>
    </>;
}
