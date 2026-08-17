import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Search, Send, Paperclip, FileText, X, Pencil, Trash2, SmilePlus, Check, Sparkles, Reply, MoreVertical, Ban, Flag, Users, Plus, UserPlus, LogOut, BadgeCheck } from "lucide-react";
import { cn, formatChatListTimestamp, formatDayDivider, formatLastSeen, formatMessageTime } from "@/lib/utils";
import { useCurrentUser } from "@/lib/current-user-context";
function initialsOf(name) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
const TYPING_SEND_INTERVAL_MS = 2000;
const TYPING_EXPIRE_MS = 3000;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp"];
function isImageFilename(name) {
  const ext = name?.split(".").pop()?.toLowerCase();
  return IMAGE_EXT.includes(ext);
}
function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function GroupAvatar({
  className
}) {
  return <div className={cn("rounded-full bg-primary/15 flex items-center justify-center shrink-0", className)}>
      <Users className="h-4 w-4 text-primary" />
    </div>;
}
export default function MessagesPage() {
  const [searchParams] = useSearchParams();
  const {
    user
  } = useCurrentUser();
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState(searchParams.get("group") ? "group" : "dm");
  const [activeId, setActiveId] = useState(searchParams.get("group") ? Number(searchParams.get("group")) : searchParams.get("with") ? Number(searchParams.get("with")) : null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [typingFromId, setTypingFromId] = useState(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMembers, setAddMembers] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [addSearchLoading, setAddSearchLoading] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeIdRef = useRef(activeId);
  const activeTypeRef = useRef(activeType);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  activeIdRef.current = activeId;
  activeTypeRef.current = activeType;
  const loadConversations = () => {
    fetch("/api/messages/conversations").then(res => res.json()).then(data => {
      const list = data.conversations ?? [];
      setConversations(list);
      setActiveId(prev => prev ?? list[0]?.userId ?? null);
    }).catch(() => {});
  };
  const loadGroups = () => {
    fetch("/api/groups").then(res => res.json()).then(data => {
      setGroups(data.groups ?? []);
    }).catch(() => {});
  };
  useEffect(() => {
    loadConversations();
    loadGroups();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadConversations();
        loadGroups();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!createGroupOpen) return;
    setGroupSearchLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/alumni-directory?search=${encodeURIComponent(groupSearchQuery)}&pageSize=20`)
        .then(res => res.json())
        .then(data => setGroupSearchResults(data.alumni ?? []))
        .catch(() => {})
        .finally(() => setGroupSearchLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [createGroupOpen, groupSearchQuery]);
  useEffect(() => {
    if (!addMemberOpen) return;
    setAddSearchLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/alumni-directory?search=${encodeURIComponent(addSearchQuery)}&pageSize=20`)
        .then(res => res.json())
        .then(data => setAddSearchResults(data.alumni ?? []))
        .catch(() => {})
        .finally(() => setAddSearchLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [addMemberOpen, addSearchQuery]);
  useEffect(() => {
    let cancelled = false;
    let retryTimeout = null;
    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/messages/ws`);
      wsRef.current = ws;
      ws.onmessage = event => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        const inActiveDm = activeTypeRef.current === "dm" && data.groupId === undefined;
        const inActiveGroup = activeTypeRef.current === "group" && data.groupId === activeIdRef.current;
        if (data.type === "message") {
          const msg = data.message;
          if (inActiveDm && msg.sender_id === activeIdRef.current) {
            setHistory(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
            setPartnerTyping(false);
            fetch(`/api/messages?withUserId=${msg.sender_id}`).catch(() => {});
            fetchSuggestions(msg.sender_id);
          }
          loadConversations();
        } else if (data.type === "seen") {
          if (inActiveDm && data.byUserId === activeIdRef.current) {
            setHistory(prev => prev.map(m => m.sender_id === user?.id ? {
              ...m,
              read: true
            } : m));
          }
        } else if (data.type === "typing") {
          if (inActiveDm && data.fromUserId === activeIdRef.current) {
            setPartnerTyping(true);
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), TYPING_EXPIRE_MS);
          }
        } else if (data.type === "edited") {
          if (inActiveDm && data.message.sender_id === activeIdRef.current) {
            setHistory(prev => prev.map(m => m.id === data.message.id ? data.message : m));
          }
          loadConversations();
        } else if (data.type === "deleted") {
          if (inActiveDm && data.fromUserId === activeIdRef.current) {
            setHistory(prev => prev.map(m => m.id === data.messageId ? {
              ...m,
              deleted_at: new Date().toISOString(),
              body: null,
              attachment_filename: null
            } : m));
          }
          loadConversations();
        } else if (data.type === "restored") {
          if (inActiveDm && data.message.sender_id === activeIdRef.current) {
            setHistory(prev => prev.map(m => m.id === data.message.id ? data.message : m));
          }
          loadConversations();
        } else if (data.type === "reaction") {
          if (inActiveDm) {
            setHistory(prev => prev.map(m => m.id === data.messageId ? {
              ...m,
              reactions: data.reactions
            } : m));
          }
        } else if (data.type === "group_message") {
          if (inActiveGroup) {
            setHistory(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
            setPartnerTyping(false);
            fetch(`/api/groups/${data.groupId}`).catch(() => {});
          }
          loadGroups();
        } else if (data.type === "group_typing") {
          if (inActiveGroup) {
            setTypingFromId(data.fromUserId);
            setPartnerTyping(true);
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), TYPING_EXPIRE_MS);
          }
        } else if (data.type === "group_edited") {
          if (inActiveGroup) {
            setHistory(prev => prev.map(m => m.id === data.message.id ? data.message : m));
          }
          loadGroups();
        } else if (data.type === "group_deleted") {
          if (inActiveGroup) {
            setHistory(prev => prev.map(m => m.id === data.messageId ? {
              ...m,
              deleted_at: new Date().toISOString(),
              body: null,
              attachment_filename: null
            } : m));
          }
          loadGroups();
        } else if (data.type === "group_restored") {
          if (inActiveGroup) {
            setHistory(prev => prev.map(m => m.id === data.message.id ? data.message : m));
          }
          loadGroups();
        } else if (data.type === "group_reaction") {
          if (inActiveGroup) {
            setHistory(prev => prev.map(m => m.id === data.messageId ? {
              ...m,
              reactions: data.reactions
            } : m));
          }
        } else if (data.type === "group_created") {
          loadGroups();
        } else if (data.type === "group_members_updated" || data.type === "group_member_left") {
          loadGroups();
          if (activeTypeRef.current === "group" && data.groupId === activeIdRef.current && data.members) {
            setGroupMembers(data.members);
          }
        }
      };
      ws.onclose = () => {
        if (!cancelled) retryTimeout = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      clearTimeout(typingTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [user?.id]);
  const fetchSuggestions = async withUserId => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/assistant/dm-suggest-replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          withUserId
        })
      });
      const data = await res.json().catch(() => ({}));
      setSuggestions(res.ok ? data.suggestions ?? [] : []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  };
  const loadThread = async () => {
    if (!activeId) return;
    setLoadingThread(true);
    setPartnerTyping(false);
    setSummary(null);
    setSummaryError(null);
    setSuggestions([]);
    setReplyTo(null);
    try {
      if (activeType === "group") {
        const res = await fetch(`/api/groups/${activeId}`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.messages ?? []);
          setGroupMembers(data.members ?? []);
          loadGroups();
        } else {
          setHistory([]);
          setGroupMembers([]);
        }
      } else {
        const res = await fetch(`/api/messages?withUserId=${activeId}`);
        if (res.ok) {
          const data = await res.json();
          const messages = data.messages ?? [];
          setHistory(messages);
          loadConversations();
          const last = messages[messages.length - 1];
          if (last && last.sender_id === activeId) fetchSuggestions(activeId);
        } else {
          setHistory([]);
        }
      }
    } finally {
      setLoadingThread(false);
    }
  };
  useEffect(() => {
    if (activeId) loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeType]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end"
    });
  }, [history]);
  const active = activeType === "group" ? groups.find(g => g.id === activeId) : conversations.find(c => c.userId === activeId);
  const filteredConversations = conversations.filter(c => c.fullName.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const displayedHistory = threadSearch.trim() ? history.filter(m => m.body?.toLowerCase().includes(threadSearch.trim().toLowerCase()) || m.attachment_filename?.toLowerCase().includes(threadSearch.trim().toLowerCase())) : history;
  const lastMineIdx = (() => {
    for (let i = displayedHistory.length - 1; i >= 0; i--) {
      if (displayedHistory[i].sender_id === user?.id) return i;
    }
    return -1;
  })();
  const nameFor = userId => {
    if (userId === user?.id) return "You";
    if (activeType === "group") return groupMembers.find(m => m.userId === userId)?.fullName ?? "Someone";
    return active?.fullName ?? "Someone";
  };
  const selectDm = userId => {
    setActiveType("dm");
    setActiveId(userId);
  };
  const selectGroup = groupId => {
    setActiveType("group");
    setActiveId(groupId);
  };
  const handleDraftChange = value => {
    setDraft(value);
    if (!activeId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_SEND_INTERVAL_MS) {
      lastTypingSentRef.current = now;
      wsRef.current.send(JSON.stringify(activeType === "group" ? {
        type: "group_typing",
        groupId: activeId
      } : {
        type: "typing",
        withUserId: activeId
      }));
    }
  };
  const handleFilePicked = file => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert(`"${file.name}" exceeds the 20MB limit.`);
      return;
    }
    setPendingFile(file);
  };
  const startEdit = msg => {
    setEditingId(msg.id);
    setEditDraft(msg.body ?? "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };
  const messageUrl = messageId => activeType === "group" ? `/api/groups/${activeId}/messages/${messageId}` : `/api/messages/${messageId}`;
  const attachmentUrl = msg => activeType === "group" ? `/api/groups/${activeId}/messages/${msg.id}/attachment` : `/api/messages/${msg.id}/attachment`;
  const refreshList = () => activeType === "group" ? loadGroups() : loadConversations();
  const saveEdit = async messageId => {
    if (!editDraft.trim()) return;
    const res = await fetch(messageUrl(messageId), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        body: editDraft.trim()
      })
    });
    if (res.ok) {
      const data = await res.json();
      setHistory(prev => prev.map(m => m.id === messageId ? data.message : m));
      cancelEdit();
      refreshList();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not edit this message.");
    }
  };
  const handleDelete = async messageId => {
    const res = await fetch(messageUrl(messageId), {
      method: "DELETE"
    });
    if (res.ok) {
      setHistory(prev => prev.map(m => m.id === messageId ? {
        ...m,
        deleted_at: new Date().toISOString(),
        body: null,
        attachment_filename: null
      } : m));
      refreshList();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not delete this message.");
    }
  };
  const handleUndoDelete = async messageId => {
    const res = await fetch(`${messageUrl(messageId)}/restore`, {
      method: "POST"
    });
    if (res.ok) {
      const data = await res.json();
      setHistory(prev => prev.map(m => m.id === messageId ? data.message : m));
      refreshList();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not restore this message.");
    }
  };
  const scrollToMessage = messageId => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId(prev => prev === messageId ? null : prev), 1500);
  };
  const handleBlock = async () => {
    if (!active || !confirm(`Block ${active.fullName}? They won't be able to message you, and you won't be able to message them.`)) return;
    setBlocking(true);
    try {
      const res = await fetch(`/api/messages/block/${activeId}`, {
        method: "POST"
      });
      if (res.ok) loadConversations();else alert("Could not block this user.");
    } finally {
      setBlocking(false);
    }
  };
  const handleUnblock = async () => {
    setBlocking(true);
    try {
      const res = await fetch(`/api/messages/block/${activeId}`, {
        method: "DELETE"
      });
      if (res.ok) loadConversations();else alert("Could not unblock this user.");
    } finally {
      setBlocking(false);
    }
  };
  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setReporting(true);
    try {
      const res = await fetch("/api/messages/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: activeId,
          reason: reportReason.trim()
        })
      });
      if (res.ok) {
        setReportOpen(false);
        setReportReason("");
        alert("Report submitted. Our team will review it.");
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not submit report.");
      }
    } finally {
      setReporting(false);
    }
  };
  const toggleReaction = async (messageId, emoji) => {
    setReactionPickerFor(null);
    const res = await fetch(`${messageUrl(messageId)}/reactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        emoji
      })
    });
    if (res.ok) {
      const data = await res.json();
      setHistory(prev => prev.map(m => m.id === messageId ? {
        ...m,
        reactions: data.reactions
      } : m));
    }
  };
  const handleSummarize = async () => {
    if (!activeId || summarizing || activeType !== "dm") return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/assistant/dm-summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          withUserId: activeId
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not summarize this conversation.");
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Could not summarize this conversation.");
    } finally {
      setSummarizing(false);
    }
  };
  const send = async () => {
    if ((!draft.trim() && !pendingFile) || !activeId) return;
    setSending(true);
    setSuggestions([]);
    try {
      const fd = new FormData();
      if (activeType === "dm") fd.append("recipientId", String(activeId));
      if (draft.trim()) fd.append("body", draft.trim());
      if (pendingFile) fd.append("file", pendingFile);
      if (replyTo) fd.append("replyToMessageId", String(replyTo.id));
      const url = activeType === "group" ? `/api/groups/${activeId}/messages` : "/api/messages";
      const res = await fetch(url, {
        method: "POST",
        body: fd
      });
      if (res.ok) {
        setDraft("");
        setPendingFile(null);
        setReplyTo(null);
        await loadThread();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not send message.");
      }
    } finally {
      setSending(false);
    }
  };
  const toggleNewGroupMember = alum => {
    setNewGroupMembers(prev => prev.some(m => m.id === alum.id) ? prev.filter(m => m.id !== alum.id) : [...prev, alum]);
  };
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          memberIds: newGroupMembers.map(m => m.id)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCreateGroupOpen(false);
        setNewGroupName("");
        setNewGroupMembers([]);
        setGroupSearchQuery("");
        loadGroups();
        selectGroup(data.group.id);
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not create this group.");
      }
    } finally {
      setCreatingGroup(false);
    }
  };
  const toggleAddMember = alum => {
    setAddMembers(prev => prev.some(m => m.id === alum.id) ? prev.filter(m => m.id !== alum.id) : [...prev, alum]);
  };
  const handleAddMembers = async () => {
    if (addMembers.length === 0) return;
    setAddingMembers(true);
    try {
      const res = await fetch(`/api/groups/${activeId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          memberIds: addMembers.map(m => m.id)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGroupMembers(data.members);
        setAddMemberOpen(false);
        setAddMembers([]);
        setAddSearchQuery("");
        loadGroups();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not add members.");
      }
    } finally {
      setAddingMembers(false);
    }
  };
  const handleLeaveGroup = async () => {
    if (!active || !confirm(`Leave "${active.name}"? You won't be able to see this group's messages anymore.`)) return;
    setLeavingGroup(true);
    try {
      const res = await fetch(`/api/groups/${activeId}/members/me`, {
        method: "DELETE"
      });
      if (res.ok) {
        setActiveId(null);
        loadConversations();
        loadGroups();
      } else {
        alert("Could not leave this group.");
      }
    } finally {
      setLeavingGroup(false);
    }
  };
  const addSearchOptions = addSearchResults.filter(a => !groupMembers.some(m => m.userId === a.id));
  return <>
      <div className="h-[calc(100vh-8rem)] flex border border-border rounded-xl overflow-hidden bg-card">
        {/* Sidebar */}
        <div className={cn("w-full md:w-72 shrink-0 border-r border-border flex-col", active ? "hidden md:flex" : "flex")}>
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground mb-3">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="min-w-0">
            {filteredConversations.length === 0 && filteredGroups.length === 0 && <p className="text-xs text-muted-foreground p-4 text-center">
                No conversations yet. Connect with alumni on the Networking page to start messaging.
              </p>}
            {filteredConversations.map(c => <div key={c.userId} onClick={() => selectDm(c.userId)} className={cn("flex items-start gap-3 p-4 cursor-pointer hover:bg-secondary/50 transition-colors border-b border-border/50", activeType === "dm" && activeId === c.userId && "bg-secondary/80")}>
                <div className="relative shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={c.profilePhotoPath ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initialsOf(c.fullName)}</AvatarFallback>
                  </Avatar>
                  {c.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1 min-w-0">
                      <span className="truncate">{c.fullName}</span>
                      {c.fullName === "HR Communications" && <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </p>
                    {c.lastMessageAt && <p className="text-xs text-muted-foreground shrink-0">{formatChatListTimestamp(c.lastMessageAt)}</p>}
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", c.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>{c.lastMessage ?? "Say hello!"}</p>
                </div>
                {c.unread > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] h-4 w-4 p-0 flex items-center justify-center rounded-full shrink-0">{c.unread}</Badge>}
              </div>)}

            <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Groups</p>
              <button type="button" className="h-5 w-5 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground" title="New group" onClick={() => setCreateGroupOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {filteredGroups.length === 0 && <p className="text-xs text-muted-foreground px-4 pb-3">No groups yet.</p>}
            {filteredGroups.map(g => <div key={g.id} onClick={() => selectGroup(g.id)} className={cn("flex items-start gap-3 p-4 cursor-pointer hover:bg-secondary/50 transition-colors border-b border-border/50", activeType === "group" && activeId === g.id && "bg-secondary/80")}>
                <GroupAvatar className="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                    {g.lastMessageAt && <p className="text-xs text-muted-foreground shrink-0">{formatChatListTimestamp(g.lastMessageAt)}</p>}
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", g.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>{g.lastMessage ?? `${g.members.length} members`}</p>
                </div>
                {g.unread > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] h-4 w-4 p-0 flex items-center justify-center rounded-full shrink-0">{g.unread}</Badge>}
              </div>)}
            </div>
          </ScrollArea>
        </div>

        {/* Chat */}
        <div className={cn("flex-1 flex-col min-w-0", active ? "flex" : "hidden md:flex")}>
          {active ? <>
              <div className="h-16 border-b border-border px-4 flex items-center gap-3">
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 md:hidden" onClick={() => setActiveId(null)} title="Back to conversations">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {activeType === "group" ? <GroupAvatar className="w-9 h-9" /> : <div className="relative shrink-0">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={active.profilePhotoPath ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initialsOf(active.fullName)}</AvatarFallback>
                    </Avatar>
                    {active.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />}
                  </div>}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground flex items-center gap-1 min-w-0">
                    <span className="truncate">{activeType === "group" ? active.name : active.fullName}</span>
                    {activeType === "dm" && active.fullName === "HR Communications" && <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </p>
                  {partnerTyping ? <p className="text-xs text-primary">{activeType === "group" ? `${nameFor(typingFromId)} is typing...` : "typing..."}</p> : activeType === "group" ? <p className="text-xs text-muted-foreground">{active.members.length} members</p> : active.online ? <p className="text-xs text-green-600">Online</p> : active.lastActiveAt ? <p className="text-xs text-muted-foreground">{formatLastSeen(active.lastActiveAt)}</p> : null}
                </div>
                {activeType === "dm" && <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" disabled={summarizing || history.length === 0} onClick={handleSummarize}>
                    <Sparkles className="h-3 w-3" />{summarizing ? "Summarizing..." : "Summarize"}
                  </Button>}
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => {
                setSearchOpen(o => !o);
                setThreadSearch("");
              }} title="Search in conversation">
                  <Search className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="More options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {activeType === "group" ? <>
                        <DropdownMenuItem onClick={() => setAddMemberOpen(true)}>
                          <UserPlus className="h-3.5 w-3.5 mr-2" />Add members
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={leavingGroup} onClick={handleLeaveGroup} className="text-destructive focus:text-destructive">
                          <LogOut className="h-3.5 w-3.5 mr-2" />Leave group
                        </DropdownMenuItem>
                      </> : <>
                        <DropdownMenuItem onClick={() => setReportOpen(true)}>
                          <Flag className="h-3.5 w-3.5 mr-2" />Report {active.fullName}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {active.blockedByMe ? <DropdownMenuItem disabled={blocking} onClick={handleUnblock}>
                            <Ban className="h-3.5 w-3.5 mr-2" />Unblock {active.fullName}
                          </DropdownMenuItem> : <DropdownMenuItem disabled={blocking} onClick={handleBlock} className="text-destructive focus:text-destructive">
                            <Ban className="h-3.5 w-3.5 mr-2" />Block {active.fullName}
                          </DropdownMenuItem>}
                      </>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {searchOpen && <div className="px-4 py-2 border-b border-border">
                  <Input autoFocus placeholder="Search this conversation..." className="h-8 text-sm" value={threadSearch} onChange={e => setThreadSearch(e.target.value)} />
                </div>}
              {(summary || summaryError) && <div className="px-4 py-2.5 border-b border-border bg-primary/5">
                  {summaryError ? <p className="text-xs text-destructive">{summaryError}</p> : <div className="relative">
                      <p className="text-xs font-medium mb-1 flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />AI Summary</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap pr-5">{summary}</p>
                      <button type="button" className="absolute top-0 right-0 text-muted-foreground hover:text-foreground" onClick={() => setSummary(null)}><X className="h-3.5 w-3.5" /></button>
                    </div>}
                </div>}

              <ScrollArea className="flex-1 p-4" style={{
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 20px)",
              maskImage: "linear-gradient(to bottom, transparent 0, black 20px)"
            }}>
                <div className="space-y-4">
                  {loadingThread && <p className="text-sm text-muted-foreground text-center">Loading...</p>}
                  {!loadingThread && history.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Say hello!</p>}
                  {!loadingThread && history.length > 0 && threadSearch.trim() && displayedHistory.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No messages match &quot;{threadSearch.trim()}&quot;.</p>}
                  {displayedHistory.map((msg, idx) => {
                const mine = msg.sender_id === user?.id;
                const deleted = !!msg.deleted_at;
                const isImage = msg.attachment_filename && isImageFilename(msg.attachment_filename);
                const showDivider = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(displayedHistory[idx - 1].created_at).toDateString();
                return <div key={msg.id} id={`msg-${msg.id}`} className={cn("group rounded-lg transition-colors", highlightedId === msg.id && "bg-primary/10")}>
                        {showDivider && <div className="flex justify-center mb-4">
                            <span className="text-[11px] font-medium bg-secondary text-muted-foreground px-3 py-1 rounded-full">
                              {formatDayDivider(msg.created_at)}
                            </span>
                          </div>}
                        <div className={cn("flex gap-2 items-end", mine && "flex-row-reverse")}>
                          <div className={cn("max-w-xs lg:max-w-md min-w-0", mine && "items-end")}>
                            {activeType === "group" && !mine && <p className="text-[10px] font-medium text-muted-foreground mb-0.5 px-1">{nameFor(msg.sender_id)}</p>}
                            {editingId === msg.id ? <div className="flex items-center gap-1.5">
                                <Input autoFocus value={editDraft} onChange={e => setEditDraft(e.target.value)} onKeyDown={e => {
                            if (e.key === "Enter") saveEdit(msg.id);
                            if (e.key === "Escape") cancelEdit();
                          }} className="h-8 text-sm" />
                                <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => saveEdit(msg.id)}><Check className="h-3.5 w-3.5" /></Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                              </div> : <div className={cn("rounded-2xl text-sm", deleted ? "px-4 py-2.5 italic text-muted-foreground bg-secondary/50" : isImage ? "p-1.5" : "px-4 py-2.5", !deleted && (mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-foreground rounded-tl-sm"))}>
                                {!deleted && msg.reply_to && <button type="button" onClick={() => scrollToMessage(msg.reply_to.id)} className={cn("block w-full text-left rounded-lg px-2 py-1 mb-1.5 border-l-2 text-xs", mine ? "bg-primary-foreground/10 border-primary-foreground/40 hover:bg-primary-foreground/15" : "bg-background/70 border-primary/40 hover:bg-background")}>
                                    <span className={cn("block font-medium", mine ? "text-primary-foreground/80" : "text-primary")}>
                                      {nameFor(msg.reply_to.senderId)}
                                    </span>
                                    <span className={cn("block truncate", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                      {msg.reply_to.deleted ? "This message was deleted" : msg.reply_to.body || (msg.reply_to.attachmentFilename ? `📎 ${msg.reply_to.attachmentFilename}` : "")}
                                    </span>
                                  </button>}
                                {deleted ? <>This message has been deleted.{mine && <> <button type="button" className="underline hover:no-underline" onClick={() => handleUndoDelete(msg.id)}>Undo</button></>}</> : <>
                                    {msg.attachment_filename && (isImage ? <a href={attachmentUrl(msg)} target="_blank" rel="noreferrer">
                                        <img src={attachmentUrl(msg)} alt={msg.attachment_filename} className="rounded-xl max-w-full max-h-64 object-cover" />
                                      </a> : <a href={attachmentUrl(msg)} target="_blank" rel="noreferrer" className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2", msg.body && "mb-1.5", mine ? "bg-primary-foreground/10 hover:bg-primary-foreground/15" : "bg-background hover:bg-background/70")}>
                                        <FileText className="h-4 w-4 shrink-0" />
                                        <span className="truncate text-xs font-medium">{msg.attachment_filename}</span>
                                        {msg.attachment_size_bytes ? <span className="text-[10px] opacity-70 shrink-0">{formatFileSize(msg.attachment_size_bytes)}</span> : null}
                                      </a>)}
                                    {msg.body && <span className={isImage ? "block px-2.5 pt-1.5 pb-1" : ""}>{msg.body}</span>}
                                  </>}
                              </div>}

                            {!deleted && msg.reactions?.length > 0 && <div className={cn("flex flex-wrap gap-1 mt-1", mine && "justify-end")}>
                                {msg.reactions.map(r => <button key={r.emoji} type="button" onClick={() => toggleReaction(msg.id, r.emoji)} className={cn("text-xs rounded-full border px-1.5 py-0.5 flex items-center gap-1", r.reactedByMe ? "border-primary bg-primary/10" : "border-border bg-secondary/50")}>
                                    <span>{r.emoji}</span><span className="text-[10px] text-muted-foreground">{r.count}</span>
                                  </button>)}
                              </div>}

                            {!deleted && editingId !== msg.id && <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                {formatMessageTime(msg.created_at)}
                                {msg.edited_at && " (edited)"}
                                {mine && idx === lastMineIdx && msg.read && " · Seen"}
                              </p>}
                          </div>

                          {!deleted && editingId !== msg.id && <div className="hidden group-hover:flex items-center gap-0.5 mb-1 shrink-0 relative">
                              <button type="button" className="h-6 w-6 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground" onClick={() => setReplyTo({
                            id: msg.id,
                            senderId: msg.sender_id,
                            body: msg.body,
                            attachmentFilename: msg.attachment_filename
                          })} title="Reply">
                                <Reply className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" className="h-6 w-6 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground" onClick={() => setReactionPickerFor(p => p === msg.id ? null : msg.id)} title="React">
                                <SmilePlus className="h-3.5 w-3.5" />
                              </button>
                              {mine && <>
                                  <button type="button" className="h-6 w-6 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground" onClick={() => startEdit(msg)} title="Edit">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" className="h-6 w-6 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive" onClick={() => handleDelete(msg.id)} title="Delete">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>}
                              {reactionPickerFor === msg.id && <div className={cn("absolute bottom-7 z-10 flex gap-0.5 bg-card border border-border rounded-full shadow-md px-1.5 py-1", mine ? "right-0" : "left-0")}>
                                  {QUICK_EMOJIS.map(emoji => <button key={emoji} type="button" className="hover:scale-125 transition-transform text-base leading-none px-0.5" onClick={() => toggleReaction(msg.id, emoji)}>{emoji}</button>)}
                                </div>}
                            </div>}
                        </div>
                      </div>;
              })}
                  {partnerTyping && <div className="flex gap-3">
                      <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-muted-foreground">···</div>
                    </div>}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border">
                {activeType === "dm" && (active.blockedByMe || active.blockedMe) ? <p className="text-sm text-muted-foreground text-center py-1.5">
                    {active.blockedByMe ? `You blocked ${active.fullName}.` : "You can't reply to this conversation."}
                  </p> : <>
                    {replyTo && <div className="flex items-center justify-between gap-2 bg-secondary/60 rounded-lg pl-3 pr-2 py-1.5 mb-2 text-xs border-l-2 border-primary">
                        <span className="min-w-0">
                          <span className="block font-medium text-primary">
                            Replying to {nameFor(replyTo.senderId)}
                          </span>
                          <span className="block truncate text-muted-foreground">
                            {replyTo.body || (replyTo.attachmentFilename ? `📎 ${replyTo.attachmentFilename}` : "")}
                          </span>
                        </span>
                        <button type="button" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setReplyTo(null)}><X className="h-3.5 w-3.5" /></button>
                      </div>}
                    {activeType === "dm" && suggesting && <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Sparkles className="h-3 w-3" />Thinking of replies...</p>}
                    {activeType === "dm" && !suggesting && suggestions.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">
                        {suggestions.map((s, i) => <button key={i} type="button" className="text-xs rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1 flex items-center gap-1" onClick={() => setDraft(s)}>
                            <Sparkles className="h-3 w-3" />{s}
                          </button>)}
                      </div>}
                    {pendingFile && <div className="flex items-center justify-between gap-2 bg-secondary/60 rounded-lg px-3 py-1.5 mb-2 text-xs">
                        <span className="flex items-center gap-1.5 min-w-0"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-medium">{pendingFile.name}</span><span className="text-muted-foreground shrink-0">{formatFileSize(pendingFile.size)}</span></span>
                        <button type="button" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setPendingFile(null)}><X className="h-3.5 w-3.5" /></button>
                      </div>}
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
                      handleFilePicked(e.target.files?.[0]);
                      e.target.value = "";
                    }} />
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sending} title="Attach a file">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input placeholder="Type a message..." value={draft} onChange={e => handleDraftChange(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} className="flex-1 h-9" disabled={sending} />
                      <Button size="icon" className="h-9 w-9 td-gradient border-0 text-white shrink-0" onClick={send} disabled={sending || (!draft.trim() && !pendingFile)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>}
              </div>
            </> : <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {conversations.length === 0 && groups.length === 0 ? "Connect with alumni to start messaging." : "Select a conversation."}
              </p>
            </div>}
        </div>
      </div>
      <Dialog open={reportOpen} onOpenChange={open => {
      setReportOpen(open);
      if (!open) setReportReason("");
    }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {active?.fullName}</DialogTitle>
          </DialogHeader>
          <Textarea autoFocus placeholder="What's happening? Describe the issue..." value={reportReason} onChange={e => setReportReason(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={handleReport} disabled={reporting || !reportReason.trim()}>
              {reporting ? "Submitting..." : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createGroupOpen} onOpenChange={open => {
      setCreateGroupOpen(open);
      if (!open) {
        setNewGroupName("");
        setNewGroupMembers([]);
        setGroupSearchQuery("");
      }
    }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="Group name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
          {newGroupMembers.length > 0 && <div className="flex flex-wrap gap-1.5">
              {newGroupMembers.map(m => <span key={m.id} className="inline-flex items-center gap-1 pl-1 pr-2 py-1 rounded-full bg-primary/10 text-xs">
                  <Avatar className="w-4 h-4"><AvatarImage src={m.profilePhotoPath ?? undefined} /><AvatarFallback className="text-[8px]">{initialsOf(m.fullName)}</AvatarFallback></Avatar>
                  {m.fullName}
                  <button type="button" onClick={() => toggleNewGroupMember(m)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>)}
            </div>}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search alumni by name..." value={groupSearchQuery} onChange={e => setGroupSearchQuery(e.target.value)} />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {groupSearchLoading && <p className="text-xs text-muted-foreground p-2">Searching...</p>}
            {!groupSearchLoading && groupSearchResults.length === 0 && <p className="text-xs text-muted-foreground p-2">No alumni found.</p>}
            {!groupSearchLoading && groupSearchResults.map(a => {
            const selected = newGroupMembers.some(m => m.id === a.id);
            return <div key={a.id} onClick={() => toggleNewGroupMember(a)} className={cn("flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-secondary", selected && "bg-primary/10")}>
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={a.profilePhotoPath ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initialsOf(a.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{a.fullName}</p>
                    {(a.designation || a.employer) && <p className="text-xs text-muted-foreground truncate">{[a.designation, a.employer].filter(Boolean).join(" · ")}</p>}
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>;
          })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim() || newGroupMembers.length === 0}>
              {creatingGroup ? "Creating..." : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addMemberOpen} onOpenChange={open => {
      setAddMemberOpen(open);
      if (!open) {
        setAddMembers([]);
        setAddSearchQuery("");
      }
    }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add members to {active?.name}</DialogTitle>
          </DialogHeader>
          {addMembers.length > 0 && <div className="flex flex-wrap gap-1.5">
              {addMembers.map(m => <span key={m.id} className="inline-flex items-center gap-1 pl-1 pr-2 py-1 rounded-full bg-primary/10 text-xs">
                  <Avatar className="w-4 h-4"><AvatarImage src={m.profilePhotoPath ?? undefined} /><AvatarFallback className="text-[8px]">{initialsOf(m.fullName)}</AvatarFallback></Avatar>
                  {m.fullName}
                  <button type="button" onClick={() => toggleAddMember(m)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>)}
            </div>}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search alumni by name..." value={addSearchQuery} onChange={e => setAddSearchQuery(e.target.value)} />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {addSearchLoading && <p className="text-xs text-muted-foreground p-2">Searching...</p>}
            {!addSearchLoading && addSearchOptions.length === 0 && <p className="text-xs text-muted-foreground p-2">No alumni found.</p>}
            {!addSearchLoading && addSearchOptions.map(a => {
            const selected = addMembers.some(m => m.id === a.id);
            return <div key={a.id} onClick={() => toggleAddMember(a)} className={cn("flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-secondary", selected && "bg-primary/10")}>
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={a.profilePhotoPath ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initialsOf(a.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{a.fullName}</p>
                    {(a.designation || a.employer) && <p className="text-xs text-muted-foreground truncate">{[a.designation, a.employer].filter(Boolean).join(" · ")}</p>}
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>;
          })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMembers} disabled={addingMembers || addMembers.length === 0}>
              {addingMembers ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
