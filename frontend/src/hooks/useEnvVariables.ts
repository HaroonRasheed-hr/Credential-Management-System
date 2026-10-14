import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  environment: "DEV" | "STAGING" | "PROD";
  file_name?: string;
  file_data?: string;
  updated_by: { id: string; username: string } | null;
  created_at: string;
  updated_at: string;
}

interface UseEnvVariablesReturn {
  data: EnvVariable[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createEnvVariable: (payload: {
    key: string;
    value: string;
    environment: "DEV" | "STAGING" | "PROD";
    file_name?: string;
    file_data?: string;
  }) => Promise<EnvVariable>;
  updateEnvVariable: (
    id: string,
    payload: Partial<
      Pick<EnvVariable, "key" | "value" | "environment" | "file_name" | "file_data">
    >
  ) => Promise<EnvVariable>;
  deleteEnvVariable: (id: string) => Promise<void>;
  revealEnvVariable: (id: string) => Promise<string>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEnvVariables(projectId: string): UseEnvVariablesReturn {
  const [data, setData] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchVars = useCallback(async () => {
    if (!pid) return null;
    const res = await api.get(`/api/v1/projects/${pid}/env-variables/`);
    const body = res.data;
    const results = body.data?.results ?? body.results ?? body.data ?? [];
    return Array.isArray(results) ? results : [];
  }, [pid]);

  useEffect(() => {
    let active = true;
    fetchVars()
      .then((result) => {
        if (!active || !result) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load environment variables");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchVars]);

  const refetch = useCallback(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    return fetchVars()
      .then((result) => {
        if (result) setData(result);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load environment variables");
      })
      .finally(() => setLoading(false));
  }, [fetchVars, pid]);

  const createEnvVariable = async (payload: {
    key: string;
    value: string;
    environment: "DEV" | "STAGING" | "PROD";
    file_name?: string;
    file_data?: string;
  }): Promise<EnvVariable> => {
    const res = await api.post(`/api/v1/projects/${pid}/env-variables/`, payload);
    const item = res.data.data;
    setData((prev) => [item, ...prev]);
    return item;
  };

  const updateEnvVariable = async (
    id: string,
    payload: Partial<
      Pick<EnvVariable, "key" | "value" | "environment" | "file_name" | "file_data">
    >
  ): Promise<EnvVariable> => {
    const res = await api.patch(`/api/v1/projects/${pid}/env-variables/${id}/`, payload);
    const item = res.data.data;
    setData((prev) => prev.map((v) => (v.id === id ? item : v)));
    return item;
  };

  const deleteEnvVariable = async (id: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${pid}/env-variables/${id}/`);
    setData((prev) => prev.filter((v) => v.id !== id));
  };

  const revealEnvVariable = async (id: string): Promise<string> => {
    const res = await api.get(`/api/v1/projects/${pid}/env-variables/${id}/reveal/`);
    const plaintext: string = res.data.data?.value ?? res.data.value ?? "";
    setData((prev) =>
      prev.map((v) => (v.id === id ? { ...v, value: plaintext } : v))
    );
    return plaintext;
  };

  return {
    data,
    loading,
    error,
    refetch,
    createEnvVariable,
    updateEnvVariable,
    deleteEnvVariable,
    revealEnvVariable,
  };
}
