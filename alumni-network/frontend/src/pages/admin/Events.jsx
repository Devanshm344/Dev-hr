import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Calendar, MapPin, Users, XCircle, CalendarPlus, Type, Mic2, Image as ImageIcon, UploadCloud, Eye, EyeOff, Loader2, Check } from "lucide-react";
function to24HourTime(timeStr) {
  const match = (timeStr ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeStr ?? "";
  let hour = parseInt(match[1], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
const emptyForm = {
  title: "",
  eventDate: "",
  eventTime: "",
  location: "",
  type: "In-Person",
  speaker: "",
  description: "",
  published: true
};
export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const handleBannerSelect = e => {
    const file = e.target.files?.[0] ?? null;
    setBannerFile(file);
    setBannerPreview(file ? URL.createObjectURL(file) : null);
  };
  const loadEvents = async () => {
    setLoading(true);
    const res = await fetch("/api/events");
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  };
  useEffect(() => {
    loadEvents();
  }, []);
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setBannerFile(null);
    setBannerPreview(null);
    setError(null);
    setOpen(true);
  };
  const openEdit = e => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      eventDate: e.event_date?.slice(0, 10) ?? "",
      eventTime: to24HourTime(e.event_time),
      location: e.location,
      type: e.type,
      speaker: e.speaker ?? "",
      description: e.description ?? "",
      published: e.published
    });
    setBannerFile(null);
    setBannerPreview(e.banner_path ?? null);
    setError(null);
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.title.trim() || !form.eventDate || !form.location.trim()) {
      setError("Title, date, and location are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("eventDate", form.eventDate);
      fd.append("eventTime", form.eventTime);
      fd.append("location", form.location);
      fd.append("type", form.type);
      fd.append("speaker", form.speaker);
      fd.append("description", form.description);
      fd.append("published", String(form.published));
      if (bannerFile) fd.append("banner", bannerFile);
      const res = await fetch(editingId ? `/api/events/${editingId}` : "/api/events", {
        method: editingId ? "PATCH" : "POST",
        body: fd
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      await loadEvents();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async id => {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    await fetch(`/api/events/${id}`, {
      method: "DELETE"
    });
    await loadEvents();
  };
  const handleCancelEvent = async id => {
    const fd = new FormData();
    fd.append("status", "cancelled");
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      body: fd
    });
    await loadEvents();
  };
  return <>
      <PageHeader title="Events" description="System-level management of all alumni events." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "Events"
    }]}>
        <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Create Event
        </Button>
      </PageHeader>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading events...</p>}
        {!loading && events.length === 0 && <p className="text-sm text-muted-foreground">No events found.</p>}
        {events.map(e => <Card key={e.id} className="border-border hover:shadow-sm transition-all">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                    {e.banner_path ? <img src={e.banner_path} alt={e.title} className="w-full h-full object-cover" /> : <Calendar className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-foreground">{e.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(e.event_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                          </span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.attendees} RSVP</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{e.type}</Badge>
                        <StatusBadge status={e.status} />
                        {!e.published && <Badge variant="outline" className="text-xs">Draft</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(e)}><Edit className="h-3.5 w-3.5" />Edit</Button>
                  {e.status === "upcoming" && <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleCancelEvent(e.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
                    </Button>}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-primary/10 via-blue-50/60 to-transparent dark:from-primary/15 dark:via-slate-800/40 border-b border-border/60">
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl td-gradient flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                  <CalendarPlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{editingId ? "Edit Event" : "Create New Event"}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {editingId ? "Update the details for this event." : "Fill in the details to publish a new alumni event."}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Details</h4>
              </div>
              <div className="space-y-1.5"><Label>Event Title *</Label><Input placeholder="e.g., Annual Alumni Summit 2026" value={form.title} onChange={e => setForm(f => ({
                ...f,
                title: e.target.value
              }))} /></div>
              <div className="space-y-1.5">
                <Label>Event Type *</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.type} onChange={e => setForm(f => ({
                ...f,
                type: e.target.value
              }))}>
                  <option>In-Person</option><option>Virtual</option><option>Hybrid</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule &amp; Location</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.eventDate} onChange={e => setForm(f => ({
                  ...f,
                  eventDate: e.target.value
                }))} /></div>
                <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={form.eventTime} onChange={e => setForm(f => ({
                  ...f,
                  eventTime: e.target.value
                }))} /></div>
              </div>
              <div className="space-y-1.5"><Label>Location / Link *</Label><Input placeholder="Venue address or virtual meeting link" value={form.location} onChange={e => setForm(f => ({
                ...f,
                location: e.target.value
              }))} /></div>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-5">
              <div className="flex items-center gap-2">
                <Mic2 className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional Info</h4>
              </div>
              <div className="space-y-1.5"><Label>Speaker (optional)</Label><Input placeholder="Speaker name and title" value={form.speaker} onChange={e => setForm(f => ({
                ...f,
                speaker: e.target.value
              }))} /></div>
              <div className="space-y-1.5"><Label>Description</Label><textarea className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Event description..." value={form.description} onChange={e => setForm(f => ({
                ...f,
                description: e.target.value
              }))} /></div>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-5">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Banner Image</h4>
              </div>
              <label className="flex items-center gap-4 rounded-xl border-2 border-dashed border-border p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerSelect} className="hidden" />
                <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                  {bannerPreview ? <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bannerFile ? bannerFile.name : "Click to upload a banner image"}</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG or WEBP</p>
                </div>
                <UploadCloud className="h-5 w-5 text-muted-foreground shrink-0" />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", form.published ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-secondary text-muted-foreground")}>
                  {form.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
                <div>
                  <Label className="font-medium">Publish event</Label>
                  <p className="text-xs text-muted-foreground">{form.published ? "Visible on the public site" : "Saved as a private draft"}</p>
                </div>
              </div>
              <Switch checked={form.published} onCheckedChange={checked => setForm(f => ({
              ...f,
              published: checked === true
            }))} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white gap-1.5 shadow-md shadow-primary/25" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : editingId ? <><Check className="h-4 w-4" />Save Changes</> : <><Plus className="h-4 w-4" />Create Event</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
