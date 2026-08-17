import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Quote, Star, Image as ImageIcon, Send, CheckCircle, Sparkles, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/current-user-context";
function ShareYourStoryContent() {
  const {
    user,
    loading: userLoading
  } = useCurrentUser();
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState(null);
  const [prePolishQuote, setPrePolishQuote] = useState(null);
  useEffect(() => {
    if (user) setRole(user.designation && user.employer ? `${user.designation}, ${user.employer}` : "");
  }, [user]);
  const loadMine = async () => {
    if (!user) return;
    setLoading(true);
    const res = await fetch(`/api/stories?submittedByEmail=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    setMine(data.stories ?? []);
    setLoading(false);
  };
  useEffect(() => {
    if (user) loadMine();
  }, [user]);
  const handlePolish = async () => {
    if (!quote.trim() || polishing) return;
    setPolishing(true);
    setPolishError(null);
    try {
      const res = await fetch("/api/assistant/polish-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: quote })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not polish this right now.");
      setPrePolishQuote(quote);
      setQuote(data.polished);
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : "Could not polish this right now.");
    } finally {
      setPolishing(false);
    }
  };
  const handleUndoPolish = () => {
    if (prePolishQuote === null) return;
    setQuote(prePolishQuote);
    setPrePolishQuote(null);
  };
  const handlePhotoSelect = e => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };
  const handleSubmit = async () => {
    if (!user) return;
    if (!quote.trim()) {
      setError("Please share a few words about your journey.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("alumniName", user.fullName);
      fd.append("role", role);
      fd.append("quote", quote);
      fd.append("rating", String(rating));
      fd.append("submittedByEmail", user.email);
      if (photoFile) fd.append("avatar", photoFile);
      const res = await fetch("/api/stories", {
        method: "POST",
        body: fd
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setQuote("");
      setRating(5);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPrePolishQuote(null);
      setPolishError(null);
      setJustSubmitted(true);
      await loadMine();
      setTimeout(() => setJustSubmitted(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };
  if (userLoading || !user) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }
  return <>
      <PageHeader title="Share Your Story" description="Inspire fellow alumni by sharing your journey and success since joining the network." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Share Your Story"
    }]} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="border-border lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Quote className="h-4 w-4 text-primary" />Tell Your Story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Current Role / Company</Label>
              <Input placeholder="e.g., Senior Engineer, Microsoft" value={role} onChange={e => setRole(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Your Story *</Label>
                <div className="flex items-center gap-1.5">
                  {prePolishQuote !== null && <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 text-[11px] text-muted-foreground" onClick={handleUndoPolish}>
                      <Undo2 className="h-3 w-3" />Undo
                    </Button>}
                  <Button type="button" size="sm" variant="outline" className="h-6 gap-1 text-[11px]" disabled={!quote.trim() || polishing} onClick={handlePolish}>
                    <Sparkles className="h-3 w-3" />{polishing ? "Polishing..." : "Polish with AI"}
                  </Button>
                </div>
              </div>
              <textarea className="w-full h-32 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Share how the TechDemocracy Alumni Network helped shape your career..." value={quote} onChange={e => setQuote(e.target.value)} />
              {polishError && <p className="text-xs text-destructive">{polishError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Your Rating of the Alumni Network</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} className="p-0.5">
                    <Star className={cn("h-6 w-6 transition-colors", (hoverRating || rating) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                  </button>)}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Photo (optional)</Label>
              <label className="flex items-center gap-4 rounded-xl border-2 border-dashed border-border p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
                <div className="h-14 w-14 rounded-full overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                  {photoPreview ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{photoFile ? photoFile.name : "Click to upload a photo"}</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG or WEBP</p>
                </div>
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {justSubmitted && <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                <CheckCircle className="h-4 w-4" />Story submitted! It'll appear on the site once approved by an admin.
              </div>}

            <Button className="td-gradient border-0 text-white gap-1.5" onClick={handleSubmit} disabled={submitting}>
              <Send className="h-4 w-4" />{submitting ? "Submitting..." : "Submit Story"}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Your Submissions</h3>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && mine.length === 0 && <EmptyState icon={Quote} title="No stories yet" description="Your submitted stories will appear here with their review status." />}
          {mine.map(s => <Card key={s.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < s.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />)}
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-sm text-muted-foreground italic mt-2 line-clamp-3">&quot;{s.quote}&quot;</p>
                {s.status === "approved" && <p className="text-xs text-muted-foreground mt-2">{s.published ? "Live on the public site" : "Approved — pending publish"}</p>}
              </CardContent>
            </Card>)}
        </div>
      </div>
    </>;
}
export default function ShareYourStoryPage() {
  return <>
      <ShareYourStoryContent />
    </>;
}
