import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2 } from "lucide-react";
import ServiceRequestChat from "@/components/service-request-chat";

export default function HRRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hrNoteDraft, setHrNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/service-requests/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setRequest(data?.request ?? null);
        setHrNoteDraft(data?.request?.hr_notes ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSaveNote = async () => {
    setSaving(true);
    const res = await fetch(`/api/service-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hrNotes: hrNoteDraft })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not save this note.");
      setSaving(false);
      return;
    }
    load();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this service request? This permanently removes the request and its conversation history.")) return;
    const res = await fetch(`/api/service-requests/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Could not delete this request.");
      return;
    }
    navigate("/hr/requests");
  };

  return <>
      <PageHeader
        title={request ? request.benefit_title : "Request Details"}
        description={request ? `Requested by ${request.alumni_name}` : "View this benefit request."}
        breadcrumbs={[{ label: "HR Portal" }, { label: "Service Requests" }, { label: "Details" }]}
      >
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => navigate("/hr/requests")}>
          <ArrowLeft className="h-4 w-4" />Back to Service Requests
        </Button>
      </PageHeader>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {!loading && !request && <p className="text-sm text-muted-foreground">This request could not be found.</p>}

      {!loading && request && <div className="space-y-6">
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Alumni</p><p className="font-medium mt-1">{request.alumni_name}</p><p className="text-xs text-muted-foreground">{request.alumni_email}</p></div>
                <div><p className="text-xs text-muted-foreground">Benefit</p><p className="font-medium mt-1">{request.benefit_title}</p></div>
                <div><p className="text-xs text-muted-foreground">Priority</p><div className="mt-1"><StatusBadge status={request.priority} /></div></div>
              </div>
              {request.notes && <div><p className="text-xs text-muted-foreground">Alumni Notes</p><p className="text-sm mt-1">{request.notes}</p></div>}

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" />Delete Request</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-1.5">
              <Label>HR Notes</Label>
              <textarea className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Add a note visible to the alumni..." value={hrNoteDraft} onChange={e => setHrNoteDraft(e.target.value)} />
              <div className="flex justify-end pt-1">
                <Button size="sm" className="td-gradient border-0 text-white" disabled={saving} onClick={handleSaveNote}>{saving ? "Saving..." : "Save Note"}</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">Conversation</h3>
            <ServiceRequestChat requestId={request.id} viewerType="staff" otherPartyLabel={request.alumni_name} height="h-[480px]" />
          </div>
        </div>}
    </>;
}
