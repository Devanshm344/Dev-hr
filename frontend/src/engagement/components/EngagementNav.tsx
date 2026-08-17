import { NavLink } from "react-router-dom";
import { Home, Briefcase, Clock3, ClipboardCheck, CalendarRange, BarChart3, CheckSquare, Users } from "lucide-react";
import { clsx } from "clsx";
import { useEngagementUser } from "../api/context";

// Associate Engagement's own in-module navigation. time_sheet-main used to
// render this as a full left sidebar (components/Layout.tsx, not carried
// over here — dev-hr's own sidebar/header is the outer chrome now), but that
// was the *only* way to reach Portfolio, Auditing, Reports, or Expenses —
// Home.tsx only links to a few of its own cards. This reproduces the same
// links and the same manager/admin gating for Approvals and Allocations, as
// a tab strip instead of a second competing sidebar.
const TABS = [
  { to: "/engagement", label: "Home", icon: Home, end: true },
  { to: "/engagement/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/engagement/time/entries", label: "Time Entries", icon: Clock3 },
  { to: "/engagement/time/auditing", label: "Auditing", icon: ClipboardCheck },
  { to: "/engagement/time/timesheets", label: "Timesheets", icon: CalendarRange },
] as const;

const MANAGERISH_TABS = [
  { to: "/engagement/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/engagement/allocations", label: "Allocations", icon: Users },
] as const;

const REPORTS_TAB = { to: "/engagement/reports", label: "Reports", icon: BarChart3 } as const;

export function EngagementNav() {
  const user = useEngagementUser();
  const isManagerish = user.role === "manager" || user.role === "admin";
  const tabs = [...TABS, ...(isManagerish ? MANAGERISH_TABS : []), REPORTS_TAB];

  return (
    <nav
      aria-label="Associate Engagement navigation"
      className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-engagement-line/70 bg-engagement-canvas p-1"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-engagement-accent text-white shadow-sm shadow-engagement-accent/30"
                : "text-engagement-ink-faint hover:bg-white hover:text-engagement-ink",
            )
          }
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
