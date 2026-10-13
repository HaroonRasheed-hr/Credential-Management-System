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
    if (!projectId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/projects/${projectId}/`);
      const body = res.data;
      setData(body.data ?? body);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? (e instanceof Error ? e.message : "Failed to load project."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
}
