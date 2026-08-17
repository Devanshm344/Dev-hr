import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { clsx } from "clsx";
import { api } from "../api/client";
import type { AppNotification } from "../api/types";

const POLL_MS = 30000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadCount = useCallback(() => {
    api
      .get<{ data: { count: number } }>("/notifications/unread-count")
      .then((r) => setCount(r.data.data.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const id = setInterval(loadCount, POLL_MS);
    return () => clearInterval(id);
  }, [loadCount]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      api
        .get<{ data: AppNotification[] }>("/notifications")
        .then((r) => setItems(r.data.data))
        .catch(() => setItems([]));
    }
  };

  const openItem = async (n: AppNotification) => {
    if (!n.read_at) {
      try {
        await api.post(`/notifications/${n.id}/read`);
        setItems((prev) => prev && prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
        setCount((c) => Math.max(0, c - 1));
      } catch {
        // best-effort — still navigate even if the read-marker fails
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setItems((prev) => prev && prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
      setCount(0);
    } catch {
      // best-effort
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-engagement-line bg-white text-engagement-ink-soft shadow-sm transition-colors hover:border-engagement-ink-faint hover:text-engagement-ink"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-engagement-bad px-1 text-[10px] font-semibold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-md border border-engagement-line bg-white text-left shadow-lg">
          <div className="flex items-center justify-between border-b border-engagement-line px-3 py-2">
            <p className="text-sm font-medium text-engagement-ink">Notifications</p>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-engagement-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-3 py-6 text-center text-sm text-engagement-ink-faint">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-engagement-ink-faint">You're all caught up</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={clsx(
                    "flex w-full flex-col gap-0.5 border-b border-engagement-line px-3 py-2.5 text-left last:border-b-0 hover:bg-engagement-line/30",
                    !n.read_at && "bg-engagement-accent-soft/60",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-engagement-ink">
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-engagement-accent" aria-hidden />}
                    {n.title}
                  </span>
                  {n.body && <span className="text-xs text-engagement-ink-faint">{n.body}</span>}
                  <span className="text-[11px] text-engagement-ink-faint/80">
                    {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
