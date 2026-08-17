import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, MessageSquare, Pin, Clock, Send } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
function initialsOf(name) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
export default function ForumPost() {
  const params = useParams();
  const navigate = useNavigate();
  const postId = Number(params.id);
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const load = () => {
    setLoading(true);
    fetch(`/api/forum/posts/${postId}`).then(res => {
      if (!res.ok) {
        setNotFound(true);
        return null;
      }
      return res.json();
    }).then(data => {
      if (data) {
        setPost(data.post);
        setReplies(data.replies ?? []);
      }
    }).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (Number.isInteger(postId)) load();
  }, [postId]);
  const toggleLike = async () => {
    if (!post) return;
    setLiking(true);
    try {
      const res = await fetch(`/api/forum/posts/${postId}/like`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setPost(p => p ? {
          ...p,
          viewer_liked: data.liked,
          like_count: data.likeCount
        } : p);
      }
    } finally {
      setLiking(false);
    }
  };
  const sendReply = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/forum/posts/${postId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          body: draft.trim()
        })
      });
      if (res.ok) {
        setDraft("");
        load();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not post reply.");
      }
    } finally {
      setSending(false);
    }
  };
  if (notFound) {
    return <>
        <p className="text-sm text-muted-foreground">This post doesn&apos;t exist or was removed.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/portal/forum")}>Back to Forum</Button>
      </>;
  }
  return <>
      <PageHeader title={loading ? "Loading..." : post?.title ?? ""} description="Discussion thread" breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Discussion Forum",
      href: "/portal/forum"
    }, {
      label: "Post"
    }]} />

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {post && <div className="max-w-3xl space-y-6">
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarImage src={post.author_photo ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initialsOf(post.author_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.pinned && <Badge className="bg-primary/10 text-primary border-0 text-[10px] gap-1"><Pin className="h-2.5 w-2.5" />Pinned</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{post.category}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(post.created_at)}</span>
                  </div>
                  <h1 className="text-xl font-bold text-foreground mt-2">{post.title}</h1>
                  <p className="text-xs text-muted-foreground mt-1">by {post.author_name}</p>
                  <p className="text-sm text-foreground/90 mt-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  <div className="flex items-center gap-4 mt-5">
                    <button onClick={toggleLike} disabled={liking} className={cn("flex items-center gap-1.5 text-sm transition-colors", post.viewer_liked ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                      <ThumbsUp className={cn("h-4 w-4", post.viewer_liked && "fill-current")} />{post.like_count}
                    </button>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />{replies.length} {replies.length === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">{replies.length} {replies.length === 1 ? "Reply" : "Replies"}</h2>
            {replies.length === 0 && <p className="text-sm text-muted-foreground">No replies yet. Be the first to respond.</p>}
            {replies.map(r => <Card key={r.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={r.author_photo ?? undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">{initialsOf(r.author_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{r.author_name}</p>
                        <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>

          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <Textarea placeholder="Write a reply..." className="h-24 resize-none" value={draft} onChange={e => setDraft(e.target.value)} />
              <div className="flex justify-end">
                <Button className="td-gradient border-0 text-white gap-1.5" onClick={sendReply} disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />{sending ? "Posting..." : "Post Reply"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>}
    </>;
}
