import { useEffect, useState } from "react";
export function useSystemSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/system-settings/public").then(res => res.json()).then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return {
    settings,
    loading
  };
}
