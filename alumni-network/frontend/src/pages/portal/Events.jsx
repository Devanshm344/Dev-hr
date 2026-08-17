import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Users, Bell, CalendarCheck, List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
function formatEventTimeDisplay(timeStr) {
  const match = (timeStr ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr ?? "";
  const hour = parseInt(match[1], 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${period}`;
}
function EventBanner({
  event,
  className
}) {
  return event.banner_path ? <img src={event.banner_path} alt={event.title} className={cn("w-full h-full object-cover", className)} /> : <div className="w-full h-full td-gradient flex items-center justify-center">
      <Calendar className="h-8 w-8 text-white/70" />
    </div>;
}
export default function EventsPage() {
  const [view, setView] = useState("card");
  const [filter, setFilter] = useState("all");
  const [rsvped, setRsvped] = useState([]);
  const [saved, setSaved] = useState([]);
  const [rsvpBusy, setRsvpBusy] = useState(null);
  const [reminderBusy, setReminderBusy] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/events?published=true").then(res => res.json()).then(data => setEvents(data.events ?? [])).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/events/my-rsvps").then(res => res.json()).then(data => setRsvped(data.eventIds ?? [])).catch(() => {});
    fetch("/api/events/my-reminders").then(res => res.json()).then(data => setSaved(data.eventIds ?? [])).catch(() => {});
  }, []);
  const toggleRsvp = async eventId => {
    setRsvpBusy(eventId);
    try {
      const isRsvped = rsvped.includes(eventId);
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: isRsvped ? "DELETE" : "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setRsvped(prev => data.rsvped ? [...prev, eventId] : prev.filter(id => id !== eventId));
        if (typeof data.attendees === "number") {
          setEvents(prev => prev.map(e => e.id === eventId ? {
            ...e,
            attendees: data.attendees
          } : e));
        }
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not update your RSVP.");
      }
    } finally {
      setRsvpBusy(null);
    }
  };
  const toggleReminder = async eventId => {
    setReminderBusy(eventId);
    try {
      const isSaved = saved.includes(eventId);
      const res = await fetch(`/api/events/${eventId}/reminder`, {
        method: isSaved ? "DELETE" : "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(prev => data.saved ? [...prev, eventId] : prev.filter(id => id !== eventId));
      }
    } finally {
      setReminderBusy(null);
    }
  };
  const filtered = filter === "all" ? events : events.filter(e => e.type.toLowerCase() === filter.toLowerCase() || e.status === filter);
  return <>
      <PageHeader title="Events" description="Discover and RSVP for upcoming alumni events." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Events"
    }]}>
        <div className="flex items-center gap-2 border border-border rounded-lg p-1">
          <Button size="sm" variant={view === "card" ? "default" : "ghost"} className={cn("h-7", view === "card" && "td-gradient border-0 text-white")} onClick={() => setView("card")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant={view === "list" ? "default" : "ghost"} className={cn("h-7", view === "list" && "td-gradient border-0 text-white")} onClick={() => setView("list")}><List className="h-3.5 w-3.5" /></Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "Virtual", "In-Person", "upcoming", "past"].map(f => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className={cn("h-8 capitalize", filter === f && "td-gradient border-0 text-white")}>
            {f}
          </Button>)}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading events...</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No events match this filter.</p>}

      {!loading && view === "card" ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(event => <Card key={event.id} className="border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group flex flex-col">
              <div className="aspect-video overflow-hidden relative">
                <EventBanner event={event} className="group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge className="bg-white/90 text-foreground text-xs">{event.type}</Badge>
                  <StatusBadge status={event.status} />
                </div>
              </div>
              <CardContent className="p-5 flex flex-col flex-1">
                <h3 className="font-semibold text-foreground leading-snug">{event.title}</h3>
                {event.speaker && <p className="text-xs text-muted-foreground mt-1">Speaker: {event.speaker}</p>}
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{formatDate(event.event_date)}</div>
                  {event.event_time && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{formatEventTimeDisplay(event.event_time)}{event.end_time ? ` – ${formatEventTimeDisplay(event.end_time)}` : ""}</div>}
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{event.location}</div>
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{event.attendees} attendees</div>
                </div>
                {event.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{event.description}</p>}
                {event.status === "upcoming" && <div className="flex gap-2 pt-4 mt-auto">
                    <Button size="sm" disabled={rsvpBusy === event.id} className={cn("flex-1 h-8 text-xs", rsvped.includes(event.id) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "td-gradient border-0 text-white")} onClick={() => toggleRsvp(event.id)}>
                      <CalendarCheck className="h-3 w-3 mr-1" />
                      {rsvpBusy === event.id ? "..." : rsvped.includes(event.id) ? "RSVP'd" : "RSVP"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={reminderBusy === event.id} className={cn("h-8 w-8 p-0", saved.includes(event.id) && "border-primary text-primary bg-primary/10")} onClick={() => toggleReminder(event.id)} title={saved.includes(event.id) ? "Remove from saved events" : "Save this event"}>
                      <Bell className={cn("h-3.5 w-3.5", saved.includes(event.id) && "fill-current")} />
                    </Button>
                  </div>}
              </CardContent>
            </Card>)}
        </div> : null}

      {!loading && view === "list" ? <div className="space-y-3">
          {filtered.map(event => <Card key={event.id} className="border-border hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                    <EventBanner event={event} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-foreground">{event.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(event.event_date)}</span>
                          {event.event_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatEventTimeDisplay(event.event_time)}</span>}
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{event.type}</Badge>
                        <StatusBadge status={event.status} />
                        {event.status === "upcoming" && <Button size="sm" disabled={rsvpBusy === event.id} className={cn("h-7 text-xs", rsvped.includes(event.id) ? "bg-emerald-600 text-white hover:bg-emerald-700" : "td-gradient border-0 text-white")} onClick={() => toggleRsvp(event.id)}>
                            {rsvpBusy === event.id ? "..." : rsvped.includes(event.id) ? "RSVP'd" : "RSVP"}
                          </Button>}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>)}
        </div> : null}
    </>;
}
