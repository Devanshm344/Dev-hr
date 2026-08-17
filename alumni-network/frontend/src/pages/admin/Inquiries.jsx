import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Mail, MailOpen, Trash2, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
export default function AdminInquiriesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(null);
  const loadMessages = async () => {
    setLoading(true);
    const res = await fetch("/api/contact-messages");
    const data = await res.json();
    setMessages(data.messages ?? []);
    setLoading(false);
  };
  useEffect(() => {
    loadMessages();
  }, []);
  const filtered = messages.filter(m => {
    const name = `${m.first_name} ${m.last_name}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) || m.message.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || m.status === filter;
    return matchesSearch && matchesFilter;
  });
  const unreadCount = messages.filter(m => m.status === "unread").length;
  const markStatus = async (id, status) => {
    await fetch(`/api/contact-messages/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status
      })
    });
    await loadMessages();
  };
  const openMessage = async m => {
    setSelected(m);
    setSuggestion(null);
    setSuggestError(null);
    if (m.status === "unread") await markStatus(m.id, "read");
  };
  const handleSuggest = async () => {
    if (!selected) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await fetch("/api/assistant/triage-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selected.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not get a suggestion.");
      setSuggestion(data.suggestion);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Could not get a suggestion.");
    } finally {
      setSuggesting(false);
    }
  };
  const handleDelete = async id => {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    await fetch(`/api/contact-messages/${id}`, {
      method: "DELETE"
    });
    await loadMessages();
    setSelected(null);
  };
  return <>
      <PageHeader title="Inquiries" description="Messages submitted through the public site's Contact form." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Inquiries"
    }]} />

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{unreadCount}</p><p className="text-xs text-muted-foreground">Unread</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{messages.length}</p><p className="text-xs text-muted-foreground">Total Messages</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or message..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "unread", "read"].map(f => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className={cn("h-8 capitalize", filter === f && "td-gradient border-0 text-white")}>
              {f}
            </Button>)}
        </div>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading messages...</p>}
        {!loading && filtered.length === 0 && <EmptyState icon={Mail} title="No messages found" description="Submissions from the public Contact form will show up here." />}
        {filtered.map(m => <Card key={m.id} className={cn("border-border hover:shadow-sm transition-all cursor-pointer", m.status === "unread" && "border-l-4 border-l-primary")} onClick={() => openMessage(m)}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className={cn("text-sm", m.status === "unread" ? "font-bold text-foreground" : "font-medium text-foreground")}>{m.first_name} {m.last_name}</h3>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs gap-1", m.status === "unread" ? "border-primary/40 text-primary" : "border-border text-muted-foreground")}>
                        {m.status === "unread" ? <Mail className="h-3 w-3" /> : <MailOpen className="h-3 w-3" />}
                        {m.status === "unread" ? "Unread" : "Read"}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{m.message}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0" onClick={e => {
              e.stopPropagation();
              handleDelete(m.id);
            }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>)}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Message from {selected?.first_name} {selected?.last_name}</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{selected.first_name} {selected.last_name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(selected.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}</p>
                </div>
              </div>
              <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-4 leading-relaxed">{selected.message}</p>

              <div>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={suggesting} onClick={handleSuggest}>
                  <Sparkles className="h-3.5 w-3.5" />{suggesting ? "Analyzing..." : "Suggest with AI"}
                </Button>
                {suggestError && <p className="text-xs text-destructive mt-1.5">{suggestError}</p>}
                {suggestion && <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                    <p className="font-medium mb-1 flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />AI Suggestion</p>
                    <p className="whitespace-pre-wrap">{suggestion}</p>
                  </div>}
              </div>
            </div>}
          <DialogFooter>
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => selected && handleDelete(selected.id)}>
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
            <Button className="td-gradient border-0 text-white" asChild>
              <a href={`mailto:${selected?.email}`}>Reply via Email</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
