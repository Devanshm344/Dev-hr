import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2, UserPlus, MessageSquare, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
const PAGE_SIZE = 12;
export default function NetworkingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [industry, setIndustry] = useState("all");
  const [industries, setIndustries] = useState([]);
  const [alumni, setAlumni] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAlumni, setTotalAlumni] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const loadConnections = () => {
    fetch("/api/connections").then(res => res.json()).then(data => setConnections(data.connections ?? [])).catch(() => {});
  };
  useEffect(() => {
    fetch("/api/alumni-directory?pageSize=1").then(res => res.json()).then(data => setTotalAlumni(data.total ?? 0)).catch(() => {});
    loadConnections();
  }, []);
  useEffect(() => {
    setPage(1);
  }, [search, industry]);
  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });
      if (search) params.set("search", search);
      if (industry !== "all") params.set("industry", industry);
      fetch(`/api/alumni-directory?${params.toString()}`).then(res => res.json()).then(data => {
        setAlumni(prev => page === 1 ? data.alumni : [...prev, ...data.alumni]);
        setTotal(data.total ?? 0);
        setIndustries(data.industries ?? []);
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, industry, page]);
  const hasMore = alumni.length < total;
  const connectionFor = alumniId => connections.find(c => c.counterpart.id === alumniId);
  const sendRequest = async alumniId => {
    setBusyId(alumniId);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recipientId: alumniId
        })
      });
      if (res.ok) {
        loadConnections();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not send connection request.");
      }
    } finally {
      setBusyId(null);
    }
  };
  const respond = async (connectionId, status) => {
    setBusyId(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status
        })
      });
      if (res.ok) loadConnections();
    } finally {
      setBusyId(null);
    }
  };
  return <>
      <PageHeader title="Networking" description="Connect with TechDemocracy alumni worldwide." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Networking"
    }]} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{totalAlumni ?? "—"}</p><p className="text-xs text-muted-foreground">Total Alumni</p></CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-orange-500">{industries.length}</p><p className="text-xs text-muted-foreground">Industries Represented</p></CardContent></Card>
      </div>

      {connections.some(c => c.direction === "incoming" && c.status === "pending") && <Card className="border-border mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Pending Connection Requests</h3>
            <div className="space-y-2">
              {connections.filter(c => c.direction === "incoming" && c.status === "pending").map(c => <div key={c.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-secondary/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={c.counterpart.profilePhotoPath ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {c.counterpart.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.counterpart.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.counterpart.designation || "Alumni"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" disabled={busyId === c.id} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => respond(c.id, "accepted")}>
                      <Check className="h-3 w-3" />Accept
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === c.id} className="h-7 text-xs gap-1" onClick={() => respond(c.id, "declined")}>
                      <X className="h-3 w-3" />Decline
                    </Button>
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, employer, or role..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Industry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{total} alumni found</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {alumni.map(a => {
        const connection = connectionFor(a.id);
        const initials = a.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
        const isAccepted = connection?.status === "accepted";
        const isPendingOutgoing = connection?.status === "pending" && connection.direction === "outgoing";
        const isPendingIncoming = connection?.status === "pending" && connection.direction === "incoming";
        return <Card key={a.id} className="border-border hover:shadow-md transition-all duration-200 group flex flex-col">
              <CardContent className="p-5 flex flex-col flex-1">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-border">
                      <AvatarImage src={a.profilePhotoPath ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{a.fullName}</h3>
                    <p className="text-sm text-muted-foreground truncate">{a.designation || "Alumni"}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{a.employer || "Not provided"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge variant="secondary" className="text-[11px] h-5">{a.industry}</Badge>
                  <Badge variant="secondary" className="text-[11px] h-5">Since {a.joiningYear}</Badge>
                </div>
                <div className="flex gap-2 pt-4 mt-auto">
                  {isPendingIncoming && connection ? <>
                      <Button size="sm" disabled={busyId === connection.id} className="flex-1 h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => respond(connection.id, "accepted")}>
                        <Check className="h-3 w-3" />Accept
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === connection.id} className="flex-1 h-8 text-xs gap-1" onClick={() => respond(connection.id, "declined")}>
                        <X className="h-3 w-3" />Decline
                      </Button>
                    </> : <>
                      <Button size="sm" disabled={isAccepted || isPendingOutgoing || busyId === a.id} className={cn("flex-1 h-8 text-xs gap-1", isAccepted ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0" : "td-gradient border-0 text-white")} onClick={() => sendRequest(a.id)}>
                        {isAccepted ? <><Check className="h-3 w-3" />Connected</> : isPendingOutgoing ? <><Clock className="h-3 w-3" />Requested</> : <><UserPlus className="h-3 w-3" />Connect</>}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!isAccepted} title={isAccepted ? undefined : "Connect first to message"} className="flex-1 h-8 text-xs gap-1" onClick={() => navigate(`/portal/messages?with=${a.id}`)}>
                        <MessageSquare className="h-3 w-3" />Message
                      </Button>
                    </>}
                </div>
              </CardContent>
            </Card>;
      })}
      </div>

      {!loading && alumni.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No alumni match your search.</p>}

      {hasMore && <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>}
    </>;
}
