import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
export default function RequestsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [benefitOptions, setBenefitOptions] = useState([]);
  const [selectedBenefit, setSelectedBenefit] = useState("");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const load = () => {
    setLoading(true);
    fetch("/api/service-requests").then(res => res.json()).then(data => setRequests(data.requests ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const openDialog = () => {
    setSelectedBenefit("");
    setPriority("medium");
    setNotes("");
    setFormError(null);
    fetch("/api/benefits?active=true").then(res => res.json()).then(data => setBenefitOptions(data.benefits ?? [])).catch(() => {});
    setOpen(true);
  };
  const handleSubmit = async () => {
    if (!selectedBenefit) {
      setFormError("Please select a benefit.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          benefitId: Number(selectedBenefit),
          priority,
          notes
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not submit this request.");
      }
      setOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };
  const filtered = requests.filter(r => r.benefit_title.toLowerCase().includes(search.toLowerCase()));
  return <>
      <PageHeader title="Service Requests" description="Track and manage your benefit requests." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Service Requests"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openDialog}>
          <Plus className="h-4 w-4" />New Request
        </Button>
      </PageHeader>

      <Card className="border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">My Requests</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requests..." className="pl-9 h-9 w-48" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">Benefit</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">Priority</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">HR Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">No requests yet.</td></tr>}
                {filtered.map(r => <tr key={r.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => navigate(`/portal/requests/${r.id}`)}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{r.benefit_title}</p>
                      {r.notes && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{r.notes}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={r.priority} /></td>
                    <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs truncate">{r.hr_notes || "—"}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Request Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Benefit *</Label>
              <Select value={selectedBenefit} onValueChange={setSelectedBenefit}>
                <SelectTrigger><SelectValue placeholder="Choose a benefit..." /></SelectTrigger>
                <SelectContent>
                  {benefitOptions.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority *</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <textarea className="w-full h-28 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Describe your request in detail..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
