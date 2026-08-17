import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
const categories = ["all", "Portal Experience", "Benefits", "Events", "Networking", "HR Support", "Technical Issues", "General"];
const aspectLabels = {
  usability: "Portal Usability",
  benefits: "Benefits & Services",
  events: "Events & Networking",
  hr: "HR Support"
};
function Stars({
  value,
  size = "h-3.5 w-3.5"
}) {
  return <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => <Star key={s} className={cn(size, s <= value ? "text-amber-400 fill-amber-400" : "text-border")} />)}
    </div>;
}
export default function HRFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      all: "true"
    });
    if (category !== "all") params.set("category", category);
    fetch(`/api/feedback?${params.toString()}`).then(res => res.json()).then(data => setFeedback(data.feedback ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [category]);
  const avgRating = feedback.length ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1) : "0";
  return <>
      <PageHeader title="Feedback" description="Review alumni feedback about the portal experience." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Feedback"
    }]} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{feedback.length}</p><p className="text-xs text-muted-foreground mt-1">Total Submissions</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{avgRating}</p><p className="text-xs text-muted-foreground mt-1">Average Rating</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{feedback.filter(f => f.rating <= 2).length}</p><p className="text-xs text-muted-foreground mt-1">Low Ratings (1-2★)</p></CardContent></Card>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(c => <button key={c} onClick={() => setCategory(c)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border", category === c ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-secondary")}>
            {c === "all" ? "All Categories" : c}
          </button>)}
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && feedback.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No feedback submitted yet.</p>}
        {feedback.map(f => <Card key={f.id} className="border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{f.category}</Badge>
                    <Stars value={f.rating} size="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground mt-2">
                    {f.anonymous ? "Anonymous" : f.submitterName}
                    {!f.anonymous && f.submitterEmail && <span className="text-xs text-muted-foreground font-normal"> · {f.submitterEmail}</span>}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(f.createdAt)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{f.message}</p>
              {Object.keys(f.aspectRatings ?? {}).length > 0 && <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(f.aspectRatings).map(([key, value]) => <div key={key}>
                      <p className="text-[11px] text-muted-foreground">{aspectLabels[key] ?? key}</p>
                      <Stars value={value} />
                    </div>)}
                </div>}
            </CardContent>
          </Card>)}
      </div>
    </>;
}
