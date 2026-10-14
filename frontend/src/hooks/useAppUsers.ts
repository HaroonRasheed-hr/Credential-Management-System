import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  username: string;
  email: string;
  password_or_token: string;
  role_in_app: string;
  updated_by: { id: string; username: string } | null;
  created_at: string;
  updated_at: string;
}

interface UseAppUsersReturn {
  data: AppUser[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createAppUser: (payload: {
    username: string;
    email: string;
    password_or_token: string;
    role_in_app: AppUser["role_in_app"];
  }) => Promise<AppUser>;
  updateAppUser: (
    id: string,
    payload: Partial<Pick<AppUser, "username" | "email" | "password_or_token" | "role_in_app">>
  ) => Promise<AppUser>;
  deleteAppUser: (id: string) => Promise<void>;
  revealAppUser: (id: string) => Promise<string>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppUsers(projectId: string): UseAppUsersReturn {
  const [data, setData] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchUsers = useCallback(async () => {
    if (!pid) return null;
    const res = await api.get(`/api/v1/projects/${pid}/app-users/`);
    const body = res.data;
    const results = body.data?.results ?? body.data ?? [];
    return Array.isArray(results) ? results : [];
  }, [pid]);

  useEffect(() => {
    let active = true;
    fetchUsers()
      .then((result) => {
        if (!active || !result) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load app users");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchUsers]);

  const refetch = useCallback(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    return fetchUsers()
      .then((result) => {
        if (result) setData(result);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load app users");
      })
      .finally(() => setLoading(false));
  }, [fetchUsers, pid]);

  const createAppUser = async (payload: {
    username: string;
    email: string;
    password_or_token: string;
    role_in_app: AppUser["role_in_app"];
  }): Promise<AppUser> => {
    const res = await api.post(`/api/v1/projects/${pid}/app-users/`, payload);
    const item = res.data.data;
    setData((prev) => [item, ...prev]);
    return item;
  };

  const updateAppUser = async (
    id: string,
    payload: Partial<Pick<AppUser, "username" | "email" | "password_or_token" | "role_in_app">>
  ): Promise<AppUser> => {
    const res = await api.patch(`/api/v1/projects/${pid}/app-users/${id}/`, payload);
    const item = res.data.data;
    setData((prev) => prev.map((u) => (u.id === id ? item : u)));
    return item;
  };

  const deleteAppUser = async (id: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${pid}/app-users/${id}/`);
    setData((prev) => prev.filter((u) => u.id !== id));
  };

  const revealAppUser = async (id: string): Promise<string> => {
    const res = await api.get(`/api/v1/projects/${pid}/app-users/${id}/reveal/`);
    const data = res.data.data ?? res.data;
    const plaintext: string = data?.password_or_token ?? data?.value ?? "";
    setData((prev) =>
      prev.map((u) => (u.id === id ? { ...u, password_or_token: plaintext } : u))
    );
    return plaintext;
  };

  return {
    data,
    loading,
    error,
    refetch,
    createAppUser,
    updateAppUser,
    deleteAppUser,
    revealAppUser,
  };
}
