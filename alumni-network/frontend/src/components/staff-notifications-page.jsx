"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-custom";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCheck, UserCheck, ClipboardList, Star } from "lucide-react";
import { broadcastNotificationsChanged, cn, timeAgo } from "@/lib/utils";
const typeIcon = {
  registration: UserCheck,
  service_request: ClipboardList,
  feedback: Star
};
const typeColor = {
  registration: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  service_request: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
  feedback: "text-amber-500 bg-amber-100 dark:bg-amber-900/30"
};
export function StaffNotificationsPage({
  portalLabel
}) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const load = () => {
    setLoading(true);
    fetch("/api/staff-notifications").then(res => res.json()).then(data => setNotifs(data.notifications ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const filtered = filter === "unread" ? notifs.filter(n => !n.read) : notifs;
  const unreadCount = notifs.filter(n => !n.read).length;
  const markAllRead = async () => {
    setNotifs(n => n.map(notif => ({
      ...notif,
      read: true
    })));
    await fetch("/api/staff-notifications", {
      method: "POST"
    }).catch(() => {});
    broadcastNotificationsChanged();
  };
  const markRead = async id => {
    setNotifs(n => n.map(notif => notif.id === id ? {
      ...notif,
      read: true
    } : notif));
    await fetch(`/api/staff-notifications/${id}`, {
      method: "PATCH"
    }).catch(() => {});
    broadcastNotificationsChanged();
  };
  const handleClick = n => {
    if (!n.read) markRead(n.id);
    if (n.link) navigate(n.link);
  };
  return <>
      <PageHeader title="Notifications" description={`Stay up to date with ${portalLabel} activity.`} breadcrumbs={[{
      label: portalLabel
    }, {
      label: "Notifications"
    }]}>
        {unreadCount > 0 && <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />Mark all as read
          </Button>}
      </PageHeader>

      <div className="flex items-center gap-2 mb-6">
        {["all", "unread"].map(f => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className={cn("h-8 capitalize", filter === f && "td-gradient border-0 text-white")}>
            {f} {f === "unread" && unreadCount > 0 && `(${unreadCount})`}
          </Button>)}
      </div>

      <div className="space-y-2 max-w-2xl">
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && filtered.length === 0 && <div className="text-center py-16">
            <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No {filter === "unread" ? "unread " : ""}notifications</p>
          </div>}
        {filtered.map(n => {
        const Icon = typeIcon[n.type] ?? Bell;
        const iconClass = typeColor[n.type] ?? typeColor.registration;
        return <div key={n.id} className={cn("flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-sm", n.link && "cursor-pointer", !n.read ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50" : "border-border bg-card")} onClick={() => handleClick(n)}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconClass)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
              </div>
            </div>;
      })}
      </div>
    </>;
}
