import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnvironmentCredential {
  id: string;
  environment_type: "DEVELOPMENT" | "DEPLOYMENT";
  system_name: string;
  system_ip: string;
  admin_password: string;
  rustdesk_ip: string;
  rustdesk_password: string;
  updated_by: { id: string; username: string; email: string; first_name: string; last_name: string } | null;
  created_at: string;
  updated_at: string;
}

interface UseEnvironmentCredentialsReturn {
  data: EnvironmentCredential[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateEnvironmentCredential: (
    id: string,
    payload: Partial<Pick<EnvironmentCredential, "system_name" | "system_ip" | "admin_password" | "rustdesk_ip" | "rustdesk_password">>
  ) => Promise<EnvironmentCredential>;
  revealEnvironmentCredential: (id: string) => Promise<EnvironmentCredential>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEnvironmentCredentials(projectId: string): UseEnvironmentCredentialsReturn {
  const [data, setData] = useState<EnvironmentCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchCreds = useCallback(async () => {
    if (!pid) return null;
    const res = await api.get(`/api/v1/projects/${pid}/environment-credentials/`);
    const body = res.data;
    const results = body.data ?? [];
    return Array.isArray(results) ? results : [];
  }, [pid]);

  useEffect(() => {
    let active = true;
    fetchCreds()
      .then((result) => {
        if (!active || !result) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load environment credentials");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchCreds]);

  const refetch = useCallback(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    return fetchCreds()
      .then((result) => {
        if (result) setData(result);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load environment credentials");
      })
      .finally(() => setLoading(false));
  }, [fetchCreds, pid]);

  const updateEnvironmentCredential = async (
    id: string,
    payload: Partial<Pick<EnvironmentCredential, "system_name" | "system_ip" | "admin_password" | "rustdesk_ip" | "rustdesk_password">>
  ): Promise<EnvironmentCredential> => {
    const res = await api.patch(`/api/v1/projects/${pid}/environment-credentials/${id}/`, payload);
    const item = res.data.data;
    setData((prev) => prev.map((c) => (c.id === id ? item : c)));
    return item;
  };

  const revealEnvironmentCredential = async (id: string): Promise<EnvironmentCredential> => {
    const res = await api.get(`/api/v1/projects/${pid}/environment-credentials/${id}/reveal/`);
    const revealedData = res.data.data;
    
    // Update the local state with revealed passwords
    setData((prev) =>
      prev.map((c) => 
        c.id === id 
          ? {
              ...c,
              admin_password: revealedData.admin_password,
              rustdesk_password: revealedData.rustdesk_password,
            }
          : c
      )
    );
    
    return revealedData;
  };

  return {
    data,
    loading,
    error,
    refetch,
    updateEnvironmentCredential,
    revealEnvironmentCredential,
  };
}
