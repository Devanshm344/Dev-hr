import axios, { AxiosError } from "axios";

// Auth is dev-hr's, not this module's: there is one login (dev-hr's own) and
// one session, persisted by dev-hr's Zustand store under the "hrms-auth" key
// (see src/store/authStore.js). Reading it straight from localStorage here —
// same pattern as src/services/api.js — avoids importing the store from a
// plain .ts file.
export const api = axios.create({ baseURL: "/api/engagement" });

api.interceptors.request.use((config) => {
  const auth = JSON.parse(localStorage.getItem("hrms-auth") || "{}");
  const token = auth?.state?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("hrms-auth");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      // Request never got a response — dropped connection, timeout, dev server restart, etc.
      // Distinct from a real server-side rejection so this isn't confused with a validation error.
      return "Could not reach the server. Check your connection and try again.";
    }
    const data = err.response.data as { error?: { message?: string }; detail?: unknown } | undefined;
    if (data?.error?.message) return data.error.message;
    // Response came back but not in the {error:{message}} shape we expect (e.g. FastAPI's
    // own validation-error body) — still surface the status code instead of a silent fallback.
    return `${fallback} (server responded with ${err.response.status})`;
  }
  return fallback;
}
