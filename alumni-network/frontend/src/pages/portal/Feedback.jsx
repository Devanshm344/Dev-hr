import { useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
const categories = ["Portal Experience", "Benefits", "Events", "Networking", "HR Support", "Technical Issues", "General"];
const aspects = [{
  label: "Portal Usability",
  key: "usability"
}, {
  label: "Benefits & Services",
  key: "benefits"
}, {
  label: "Events & Networking",
  key: "events"
}, {
  label: "HR Support",
  key: "hr"
}];
export default function FeedbackPage() {
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [aspectRatings, setAspectRatings] = useState({});
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const reset = () => {
    setCategory("");
    setRating(0);
    setMessage("");
    setAspectRatings({});
    setAnonymous(false);
    setSubmitted(false);
    setError(null);
  };
  const handleSubmit = async () => {
    if (!category || rating === 0 || !message.trim()) {
      setError("Please select a category, give an overall rating, and share your feedback.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          category,
          rating,
          message: message.trim(),
          anonymous,
          aspectRatings
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };
  if (submitted) {
    return <>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Thank you for your feedback!</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">Your feedback helps us improve the alumni portal and community experience.</p>
          <Button className="mt-6 td-gradient border-0 text-white" onClick={reset}>Submit Another</Button>
        </div>
      </>;
  }
  return <>
      <PageHeader title="Feedback" description="Help us improve your alumni portal experience." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Feedback"
    }]} />

      <div className="max-w-2xl mx-auto">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Share Your Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select feedback category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Overall Rating *</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => <button key={star} onClick={() => setRating(star)} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} className="transition-transform hover:scale-110">
                    <Star className={cn("h-8 w-8 transition-colors", (hover || rating) >= star ? "fill-amber-400 text-amber-400" : "text-border")} />
                  </button>)}
                {rating > 0 && <span className="text-sm text-muted-foreground ml-2">
                    {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                  </span>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Your Feedback *</Label>
              <Textarea placeholder="Share your thoughts, suggestions, or concerns in detail..." className="h-36 resize-none" value={message} onChange={e => setMessage(e.target.value)} />
            </div>

            <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
              <p className="text-sm font-medium text-foreground">Rate specific aspects (optional)</p>
              {aspects.map(item => <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => <button key={s} type="button" onClick={() => setAspectRatings(prev => ({
                  ...prev,
                  [item.key]: prev[item.key] === s ? 0 : s
                }))}>
                        <Star className={cn("h-4 w-4 cursor-pointer transition-colors", (aspectRatings[item.key] ?? 0) >= s ? "text-amber-400 fill-amber-400" : "text-border hover:text-amber-400 hover:fill-amber-400")} />
                      </button>)}
                  </div>
                </div>)}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="anon" checked={anonymous} onCheckedChange={c => setAnonymous(c)} />
              <Label htmlFor="anon" className="font-normal text-sm cursor-pointer text-muted-foreground">
                Submit anonymously (your name will not be shown)
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full td-gradient border-0 text-white h-10 gap-2" onClick={handleSubmit} disabled={submitting}>
              <Send className="h-4 w-4" />{submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>;
}
