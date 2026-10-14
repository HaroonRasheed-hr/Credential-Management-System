import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminCredential {
  id: string;
  admin_panel_url: string;
  username: string;
  password: string;
  notes: string;
  updated_by: { id: string; username: string } | null;
  created_at: string;
  updated_at: string;
}

interface UseAdminCredentialsReturn {
  data: AdminCredential[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createAdminCredential: (payload: {
    admin_panel_url: string;
    username: string;
    password: string;
    notes: string;
  }) => Promise<AdminCredential>;
  updateAdminCredential: (
    id: string,
    payload: Partial<Pick<AdminCredential, "admin_panel_url" | "username" | "password" | "notes">>
  ) => Promise<AdminCredential>;
  deleteAdminCredential: (id: string) => Promise<void>;
  revealAdminCredential: (id: string) => Promise<string>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdminCredentials(projectId: string): UseAdminCredentialsReturn {
  const [data, setData] = useState<AdminCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchCreds = useCallback(async () => {
    if (!pid) return null;
    const res = await api.get(`/api/v1/projects/${pid}/admin-credentials/`);
    const body = res.data;
    const results = body.data?.results ?? body.data ?? [];
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
        setError(e instanceof Error ? e.message : "Failed to load admin credentials");
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
        setError(e instanceof Error ? e.message : "Failed to load admin credentials");
      })
      .finally(() => setLoading(false));
  }, [fetchCreds, pid]);

  const createAdminCredential = async (payload: {
    admin_panel_url: string;
    username: string;
    password: string;
    notes: string;
  }): Promise<AdminCredential> => {
    const res = await api.post(`/api/v1/projects/${pid}/admin-credentials/`, payload);
    const item = res.data.data;
    setData((prev) => [item, ...prev]);
    return item;
  };

  const updateAdminCredential = async (
    id: string,
    payload: Partial<Pick<AdminCredential, "admin_panel_url" | "username" | "password" | "notes">>
  ): Promise<AdminCredential> => {
    const res = await api.patch(`/api/v1/projects/${pid}/admin-credentials/${id}/`, payload);
    const item = res.data.data;
    setData((prev) => prev.map((c) => (c.id === id ? item : c)));
    return item;
  };

  const deleteAdminCredential = async (id: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${pid}/admin-credentials/${id}/`);
    setData((prev) => prev.filter((c) => c.id !== id));
  };

  const revealAdminCredential = async (id: string): Promise<string> => {
    const res = await api.get(`/api/v1/projects/${pid}/admin-credentials/${id}/reveal/`);
    const data = res.data.data ?? res.data;
    const plaintext: string = data?.password ?? data?.value ?? "";
    setData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, password: plaintext } : c))
    );
    return plaintext;
  };

  return {
    data,
    loading,
    error,
    refetch,
    createAdminCredential,
    updateAdminCredential,
    deleteAdminCredential,
    revealAdminCredential,
  };
}
