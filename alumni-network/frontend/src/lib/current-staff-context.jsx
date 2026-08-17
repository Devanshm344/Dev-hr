"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
const CurrentStaffContext = createContext(null);
export function StaffUserProvider({
  children
}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff-me");
      if (res.ok) {
        const body = await res.json();
        setUser(body.user);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <CurrentStaffContext.Provider value={{
    user,
    loading,
    refresh
  }}>
      {children}
    </CurrentStaffContext.Provider>;
}
export function useCurrentStaff() {
  const ctx = useContext(CurrentStaffContext);
  if (!ctx) {
    throw new Error("useCurrentStaff must be used within a StaffUserProvider");
  }
  return ctx;
}
