import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, ThumbsUp, MessageSquare, Pin, Flame, Clock, BookOpen, Briefcase, Calendar, GraduationCap } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
const categories = [{
  label: "All",
  value: "all",
  icon: Flame
}, {
  label: "Technology",
  value: "Technology",
  icon: BookOpen
}, {
  label: "Career",
  value: "Career",
  icon: Briefcase
}, {
  label: "Events",
  value: "Events",
  icon: Calendar
}, {
  label: "Education",
  value: "Education",
  icon: GraduationCap
}];
function initialsOf(name) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
export default function ForumIndex() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    category: "Technology",
    title: "",
    content: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const loadPosts = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    fetch(`/api/forum/posts?${params.toString()}`).then(res => res.json()).then(data => setPosts(data.posts ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  const loadStats = () => {
    fetch("/api/forum/stats").then(res => res.json()).then(data => setStats(data)).catch(() => {});
  };
  useEffect(() => {
    const timeout = setTimeout(loadPosts, 250);
    return () => clearTimeout(timeout);
  }, [category, search]);
  useEffect(() => {
    loadStats();
  }, []);
  const toggleLike = async postId => {
    setBusyId(postId);
    try {
      const res = await fetch(`/api/forum/posts/${postId}/like`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          viewer_liked: data.liked,
          like_count: data.likeCount
        } : p));
      }
    } finally {
      setBusyId(null);
    }
  };
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setForm({
        category: "Technology",
        title: "",
        content: ""
      });
      setOpenNew(false);
      loadPosts();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };
  return <>
      <PageHeader title="Discussion Forum" description="Join conversations with the alumni community." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Discussion Forum"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" />New Post
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Categories</CardTitle></CardHeader>
            <CardContent className="space-y-1 p-3">
              {categories.map(cat => <button key={cat.value} onClick={() => setCategory(cat.value)} className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors", category === cat.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                  <cat.icon className="h-4 w-4" />{cat.label}
                </button>)}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Forum Stats</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm p-4">
              {[["Posts", stats?.posts ?? "—"], ["Members", stats?.members ?? "—"], ["Replies", stats?.replies ?? "—"]].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-semibold text-foreground">{v}</span></div>)}
            </CardContent>
          </Card>
        </div>

        {/* Posts */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search discussions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && posts.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">{search.trim() ? "No discussions match your search." : "No discussions yet — be the first to post."}</p>}

          {posts.map(post => <Card key={post.id} className={cn("border-border hover:shadow-sm transition-all cursor-pointer", post.pinned && "border-l-4 border-l-primary")} onClick={() => navigate(`/portal/forum/${post.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="w-9 h-9 shrink-0 mt-0.5">
                    <AvatarImage src={post.author_photo ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initialsOf(post.author_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.pinned && <Badge className="bg-primary/10 text-primary border-0 text-[10px] gap-1"><Pin className="h-2.5 w-2.5" />Pinned</Badge>}
                        <Badge variant="secondary" className="text-[10px]">{post.category}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(post.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-foreground mt-2 leading-snug hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{post.content}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs font-medium text-foreground">{post.author_name}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={e => {
                      e.stopPropagation();
                      toggleLike(post.id);
                    }} disabled={busyId === post.id} className={cn("flex items-center gap-1.5 text-xs transition-colors", post.viewer_liked ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                          <ThumbsUp className={cn("h-3.5 w-3.5", post.viewer_liked && "fill-current")} />{post.like_count}
                        </button>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />{post.reply_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>)}
        </div>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create New Post</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Category</label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.category} onChange={e => setForm(f => ({
              ...f,
              category: e.target.value
            }))}>
                {categories.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Title *</label>
              <Input placeholder="Enter a descriptive title..." value={form.title} onChange={e => setForm(f => ({
              ...f,
              title: e.target.value
            }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Content *</label>
              <Textarea placeholder="Share your thoughts, questions, or insights..." className="h-32 resize-none" value={form.content} onChange={e => setForm(f => ({
              ...f,
              content: e.target.value
            }))} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Publishing..." : "Publish Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
