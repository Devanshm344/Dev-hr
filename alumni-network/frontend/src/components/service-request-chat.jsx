import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, FileText, X, Sparkles } from "lucide-react";

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ServiceRequestChat({ requestId, viewerType, otherPartyLabel, height = "h-80" }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/service-requests/${requestId}/messages`)
        .then(res => res.json())
        .then(data => {
          if (!cancelled) setMessages(data.messages ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    setLoading(true);
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requestId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    if (!body.trim() && !file) return;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      if (body.trim()) formData.append("body", body.trim());
      if (file) formData.append("file", file);
      const res = await fetch(`/api/service-requests/${requestId}/messages`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send message.");
      }
      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      setBody("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/service-requests/${requestId}/messages/summarize`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not summarize this conversation.");
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Could not summarize this conversation.");
    } finally {
      setSummarizing(false);
    }
  };

  return <div className={`flex flex-col ${height} border border-border rounded-lg overflow-hidden`}>
      {viewerType === "staff" && <div className="border-b border-border px-3 py-2 bg-background">
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={summarizing || messages.length === 0} onClick={handleSummarize}>
            <Sparkles className="h-3 w-3" />{summarizing ? "Summarizing..." : "Summarize with AI"}
          </Button>
          {summaryError && <p className="text-xs text-destructive mt-1.5">{summaryError}</p>}
          {summary && <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground relative">
              <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground" onClick={() => setSummary(null)}><X className="h-3 w-3" /></button>
              <p className="font-medium mb-1 flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />AI Summary</p>
              <p className="whitespace-pre-wrap pr-4">{summary}</p>
            </div>}
        </div>}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-secondary/20">
        {loading && <p className="text-xs text-muted-foreground text-center">Loading messages...</p>}
        {!loading && messages.length === 0 && <p className="text-xs text-muted-foreground text-center">No messages yet. Say hello or send a file.</p>}
        {messages.map(m => {
          const mine = m.sender_type === viewerType;
          return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "td-gradient text-white" : "bg-background border border-border text-foreground"}`}>
                <p className={`text-[10px] mb-0.5 ${mine ? "text-white/70" : "text-muted-foreground"}`}>{mine ? "You" : otherPartyLabel}</p>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.attachment_filename && <a href={`/api/service-requests/${requestId}/messages/${m.id}/attachment`} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 mt-1 text-xs underline ${mine ? "text-white" : "text-primary"}`}>
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{m.attachment_filename}</span>
                    {m.attachment_size_bytes ? <span className="opacity-70 shrink-0">({formatFileSize(m.attachment_size_bytes)})</span> : null}
                  </a>}
                <p className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>{formatTime(m.created_at)}</p>
              </div>
            </div>;
        })}
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
    </div>;
}
