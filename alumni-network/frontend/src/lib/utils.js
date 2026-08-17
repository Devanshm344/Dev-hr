import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
export const NOTIFICATIONS_CHANGED_EVENT = "notifications-changed";
export function broadcastNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
export function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dayDiffFromToday(date) {
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
}
export function formatMessageTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

// WhatsApp-style timestamp for conversation list previews.
export function formatChatListTimestamp(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = dayDiffFromToday(date);
  const time = formatMessageTime(dateStr);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  if (diff > 1 && diff < 7) return `${date.toLocaleDateString("en-US", {
    weekday: "long"
  })}, ${time}`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
}

// WhatsApp-style day divider label for grouping messages within a thread.
export function formatDayDivider(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = dayDiffFromToday(date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return date.toLocaleDateString("en-US", {
    weekday: "long"
  });
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
}

// WhatsApp-style "last seen" phrasing for a chat header subtitle.
export function formatLastSeen(dateStr) {
  const date = new Date(dateStr);
  const diff = dayDiffFromToday(date);
  const time = formatMessageTime(dateStr);
  if (diff === 0) return `last seen today at ${time}`;
  if (diff === 1) return `last seen yesterday at ${time}`;
  if (diff > 1 && diff < 7) return `last seen ${date.toLocaleDateString("en-US", {
    weekday: "long"
  })} at ${time}`;
  return `last seen ${formatDayDivider(dateStr)}`;
}
