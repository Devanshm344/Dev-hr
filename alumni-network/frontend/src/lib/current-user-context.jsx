"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
const CurrentUserContext = createContext(null);
export function CurrentUserProvider({
  children
}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me");
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
  const updateUser = useCallback(async updates => {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) return null;
    const body = await res.json();
    setUser(body.user);
    return body.user;
  }, []);
  const updatePhoto = useCallback(async file => {
    const fd = new FormData();
    fd.append("photo", file);
    const res = await fetch("/api/auth/me/photo", {
      method: "POST",
      body: fd
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return {
      user: null,
      error: body.error || "Something went wrong."
    };
    setUser(body.user);
    return {
      user: body.user,
      error: null
    };
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetch("/api/presence/heartbeat", {
          method: "POST"
        }).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  return <CurrentUserContext.Provider value={{
    user,
    loading,
    refresh,
    updateUser,
    updatePhoto
  }}>
      {children}
    </CurrentUserContext.Provider>;
}
export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }
  return ctx;
}
