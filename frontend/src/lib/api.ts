import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { loadAccessToken, loadRefreshToken, saveTokens, clearTokens } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ── Request interceptor — attach Bearer token ──────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = loadAccessToken();
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — auto-refresh on 401 ────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = loadRefreshToken();

      if (!refresh) {
        clearTokens();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers["Authorization"] = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const res = await axios.post(`${API_BASE}/api/v1/auth/refresh/`, { refresh });
        const { access, refresh: newRefresh } = res.data.data ?? res.data;
        saveTokens(access, newRefresh ?? refresh);
        refreshQueue.forEach((cb) => cb(access));
        refreshQueue = [];
        original.headers["Authorization"] = `Bearer ${access}`;
        return api(original);
      } catch {
        clearTokens();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Callers pass an AbortController's `signal` per request (e.g. `api.get(url,
// { signal })`); axios forwards it alongside the instance-level 15s `timeout`
// and rejects with a cancel error when the controller aborts. `isCancel` lets
// callers distinguish that user-initiated cancellation from a real failure
// without importing axios directly.
export const isCancel = axios.isCancel;

export default api;
