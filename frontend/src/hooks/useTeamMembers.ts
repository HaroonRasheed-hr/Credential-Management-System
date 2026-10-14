import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectMemberApi {
  id: string;
  user: { id: string; username: string; email: string; role: string };
  role: "ADMIN" | "DEVELOPER";
  added_by: { id: string; username: string } | null;
  added_at: string;
}

interface UseTeamMembersReturn {
  data: ProjectMemberApi[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addMember: (userId: string, role: "ADMIN" | "DEVELOPER") => Promise<ProjectMemberApi>;
  removeMember: (userId: string) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeamMembers(projectId: string): UseTeamMembersReturn {
  const [data, setData] = useState<ProjectMemberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchMembers = useCallback(async () => {
    if (!pid) return null;
    const res = await api.get(`/api/v1/projects/${pid}/team/`);
    const body = res.data;
    const results = body.data?.results ?? body.data ?? [];
    return Array.isArray(results) ? results : [];
  }, [pid]);

  useEffect(() => {
    let active = true;
    fetchMembers()
      .then((members) => {
        if (!active || !members) return;
        setData(members);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load team members");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchMembers]);

  const refetch = useCallback(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    return fetchMembers()
      .then((members) => {
        if (members) setData(members);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load team members");
      })
      .finally(() => setLoading(false));
  }, [fetchMembers, pid]);

  const addMember = async (
    userId: string,
    role: "ADMIN" | "DEVELOPER"
  ): Promise<ProjectMemberApi> => {
    const res = await api.post(`/api/v1/projects/${pid}/team/`, {
      user_id: userId,
      role,
    });
    const item = res.data.data;
    setData((prev) => [...prev, item]);
    return item;
  };

  const removeMember = async (userId: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${pid}/team/${userId}/`);
    setData((prev) => prev.filter((m) => m.user.id !== userId));
  };

  return {
    data,
    loading,
    error,
    refetch,
    addMember,
    removeMember,
  };
}
