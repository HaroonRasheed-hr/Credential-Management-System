import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import type { ApiProject } from "@/hooks/useProjects";

interface UseProjectDetailReturn {
  data: ApiProject | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectDetail(projectId: string): UseProjectDetailReturn {
  const [data, setData] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!projectId) return null;
    const res = await api.get(`/api/v1/projects/${projectId}/`);
    const body = res.data;
    return body.data ?? body;
  }, [projectId]);

  useEffect(() => {
    let active = true;
    fetchDetail()
      .then((project) => {
        if (!active || !project) return;
        setData(project);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? (e instanceof Error ? e.message : "Failed to load project."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchDetail]);

  const refetch = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    return fetchDetail()
      .then((project) => {
        if (project) setData(project);
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? (e instanceof Error ? e.message : "Failed to load project."));
      })
      .finally(() => setLoading(false));
  }, [fetchDetail, projectId]);

  return { data, loading, error, refetch };
}
