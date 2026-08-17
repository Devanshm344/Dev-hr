import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ServiceRequestChat from "@/components/service-request-chat";

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/service-requests/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setRequest(data?.request ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return <>
      <PageHeader
        title={request ? request.benefit_title : "Request Details"}
        description="Track this request and message HR directly."
        breadcrumbs={[{ label: "Portal" }, { label: "Service Requests" }, { label: "Details" }]}
      >
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => navigate("/portal/requests")}>
          <ArrowLeft className="h-4 w-4" />Back to My Requests
        </Button>
      </PageHeader>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {!loading && !request && <p className="text-sm text-muted-foreground">This request could not be found.</p>}

      {!loading && request && <div className="space-y-6">
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Benefit</p><p className="font-medium mt-1">{request.benefit_title}</p></div>
                <div><p className="text-xs text-muted-foreground">Priority</p><div className="mt-1"><StatusBadge status={request.priority} /></div></div>
                <div><p className="text-xs text-muted-foreground">Requested</p><p className="font-medium mt-1">{new Date(request.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div>
              </div>
              {request.notes && <div className="mt-4"><p className="text-xs text-muted-foreground">Your Notes</p><p className="text-sm mt-1">{request.notes}</p></div>}
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">Conversation</h3>
            <ServiceRequestChat requestId={request.id} viewerType="alumni" otherPartyLabel="HR" height="h-[520px]" />
          </div>
        </div>}
    </>;
}
