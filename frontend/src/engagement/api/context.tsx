import { createContext, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { api } from "./client";
import type { User } from "./types";
import { EngagementNav } from "../components/EngagementNav";

// The timesheet pages need a "who am I" shaped like { id, role: "admin" |
// "manager" | "employee", ... } — dev-hr's own auth store carries a
// differently-shaped user (role "Admin"/"Employee"/"Super Admin", no
// "manager" tier). Rather than duplicate that role-derivation logic in the
// frontend, this fetches it once from the engagement backend itself (GET
// /me, which reuses the same get_current_user dependency every other
// engagement route already authorizes through) and gates rendering of the
// engagement subtree until it's loaded — same shape as App.jsx's own
// PrivateRoute gate.
const EngagementUserContext = createContext<User | null>(null);

export function useEngagementUser(): User {
  const user = useContext(EngagementUserContext);
  if (!user) throw new Error("useEngagementUser must be used within EngagementGate");
  return user;
}

export function EngagementGate() {
  const [user, setUser] = useState<User | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get("/me")
      .then((r) => setUser(r.data.data))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="p-6 text-sm text-engagement-bad">
        Could not load your Associate Engagement profile.
      </div>
    );
  }
  if (!user) {
    return <div className="p-6 text-sm text-engagement-ink-faint">Loading…</div>;
  }

  return (
    <EngagementUserContext.Provider value={user}>
      <EngagementNav />
      <Outlet />
    </EngagementUserContext.Provider>
  );
}
