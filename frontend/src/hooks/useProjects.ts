import { useState, useEffect, useCallback } from "react";
import api, { isCancel } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  password: string;
  status: "ACTIVE" | "ARCHIVED";
  created_by: { id: string; username: string; email: string };
  created_at: string;
  updated_at: string;
  member_count: number;
  env_count: number;
  license_count: number;
  admin_cred_count: number;
  app_user_count: number;
}

interface UseApiProjectsReturn {
  data: ApiProject[];
  loading: boolean;
  error: string | null;
  // Optionally accepts an AbortSignal so a caller can cancel an in-flight fetch.
  refetch: (signal?: AbortSignal) => void;
  createProject: (payload: Partial<ApiProject>) => Promise<ApiProject>;
  updateProject: (id: string, payload: Partial<ApiProject>) => Promise<ApiProject>;
  deleteProject: (id: string) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useApiProjects(): UseApiProjectsReturn {
  const [data, setData] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get("/api/v1/projects/", { signal });
      setError(null);
      const body = res.data;
      const results = body.data?.results ?? body.results ?? body.data ?? [];
      setData(Array.isArray(results) ? results : []);
    } catch (e: unknown) {
      // Request was cancelled (component unmounting) — ignore, not a real error.
      if (isCancel(e)) return;
      if (e instanceof Error) setError(e.message);
      else setError("Failed to load projects");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) fetchProjects(controller.signal);
    });
    return () => controller.abort();
  }, [fetchProjects]);

  const refetch = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    return fetchProjects(signal);
  }, [fetchProjects]);

  const createProject = async (payload: Partial<ApiProject>): Promise<ApiProject> => {
    const res = await api.post("/api/v1/projects/", payload);
    const project = res.data.data;
    setData((prev) => [project, ...prev]);
    return project;
  };

  const updateProject = async (id: string, payload: Partial<ApiProject>): Promise<ApiProject> => {
    const res = await api.patch(`/api/v1/projects/${id}/`, payload);
    const project = res.data.data;
    setData((prev) => prev.map((p) => (p.id === id ? project : p)));
    return project;
  };

  const deleteProject = async (id: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${id}/`);
    setData((prev) => prev.filter((p) => p.id !== id));
  };

  return { data, loading, error,   refetch, createProject, updateProject, deleteProject };
}
