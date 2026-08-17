import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-custom";
import { Search, Send, Paperclip, FileText, X, MessageSquare } from "lucide-react";
import { formatChatListTimestamp, formatMessageTime } from "@/lib/utils";

function initialsOf(name) {
  return (name ?? "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HRCommunicationsPanel() {
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

  const loadConversations = () => {
    fetch("/api/hr/hr-communications")
      .then(res => res.json())
      .then(data => setConversations(data.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoadingConversations(false));
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeId == null) return;
    let cancelled = false;
    const loadThread = () => {
      fetch(`/api/hr/hr-communications/${activeId}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          setMessages(data.messages ?? []);
          setActiveName(data.alumniName ?? "");
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingThread(false);
        });
    };
    setLoadingThread(true);
    loadThread();
    const interval = setInterval(loadThread, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const openConversation = c => {
    setActiveId(c.alumniId);
    setActiveName(c.fullName);
    setMessages([]);
    setError(null);
  };

  const handleSend = async () => {
    if (!body.trim() && !file) return;
    const targetId = activeId;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      if (body.trim()) formData.append("body", body.trim());
      if (file) formData.append("file", file);
      const res = await fetch(`/api/hr/hr-communications/${targetId}`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send message.");
      }
      const data = await res.json();
      if (activeIdRef.current === targetId) {
        setMessages(prev => [...prev, data.message]);
        setBody("");
        setFile(null);
      }
      loadConversations();
    } catch (err) {
      if (activeIdRef.current === targetId) {
        setError(err instanceof Error ? err.message : "Could not send message.");
      }
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c => c.fullName.toLowerCase().includes(search.toLowerCase()));

  return <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] border border-border rounded-lg overflow-hidden h-[calc(100vh-220px)] min-h-[480px]">
      <div className="border-r border-border flex flex-col min-h-0">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search alumni..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations && <p className="text-xs text-muted-foreground text-center p-4">Loading...</p>}
          {!loadingConversations && filteredConversations.length === 0 && <p className="text-xs text-muted-foreground text-center p-4">No conversations yet.</p>}
          {filteredConversations.map(c => <button
              key={c.alumniId}
              type="button"
              onClick={() => openConversation(c)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors border-b border-border/50 ${activeId === c.alumniId ? "bg-secondary/70" : ""}`}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={c.profilePhotoPath ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initialsOf(c.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{c.fullName}</p>
                  {c.lastMessageAt && <span className="text-[10px] text-muted-foreground shrink-0">{formatChatListTimestamp(c.lastMessageAt)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate">{c.lastMessage || "No messages yet"}</p>
                  {c.unread > 0 && <span className="shrink-0 h-[18px] min-w-[18px] px-1 rounded-full td-gradient text-white text-[10px] font-semibold flex items-center justify-center">{c.unread}</span>}
                </div>
              </div>
            </button>)}
        </div>
      </div>

      <div className="flex flex-col min-h-0">
        {activeId == null && <EmptyState icon={MessageSquare} title="Select a conversation" description="Pick an alumnus from the list to view and reply to their messages." />}
        {activeId != null && <>
            <div className="border-b border-border px-4 py-3 flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initialsOf(activeName)}</AvatarFallback>
              </Avatar>
              <p className="text-sm font-semibold text-foreground">{activeName}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-secondary/20">
              {loadingThread && <p className="text-xs text-muted-foreground text-center">Loading messages...</p>}
              {!loadingThread && messages.length === 0 && <p className="text-xs text-muted-foreground text-center">No messages yet. Say hello.</p>}
              {messages.map(m => {
              const mine = m.sender_id !== activeId;
              return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "td-gradient text-white" : "bg-background border border-border text-foreground"}`}>
                      <p className={`text-[10px] mb-0.5 ${mine ? "text-white/70" : "text-muted-foreground"}`}>{mine ? "HR Communications" : activeName}</p>
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      {m.attachment_filename && <a href={`/api/hr/hr-communications/${activeId}/attachments/${m.id}`} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 mt-1 text-xs underline ${mine ? "text-white" : "text-primary"}`}>
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.attachment_filename}</span>
                          {m.attachment_size_bytes ? <span className="opacity-70 shrink-0">({formatFileSize(m.attachment_size_bytes)})</span> : null}
                        </a>}
                      <p className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>{formatMessageTime(m.created_at)}</p>
                    </div>
                  </div>;
            })}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-border p-2 bg-background space-y-1.5">
              {file && <div className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1">
                  <span className="truncate">{file.name}</span>
                  <button type="button" className="text-muted-foreground hover:text-destructive shrink-0 ml-2" onClick={() => setFile(null)}><X className="h-3 w-3" /></button>
                </div>}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex items-center gap-1.5">
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 shrink-0" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></Button>
                <input
                  className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Type a message..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                />
                <Button type="button" size="sm" className="h-9 w-9 p-0 shrink-0 td-gradient border-0 text-white" disabled={sending || (!body.trim() && !file)} onClick={handleSend}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>}
      </div>
    </div>;
}
