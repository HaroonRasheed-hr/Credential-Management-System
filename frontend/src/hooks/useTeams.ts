import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamType = "AI_RESEARCH" | "ENGINEERING" | "ADMIN";

export interface ApiTeam {
  id: string;
  name: string;
  description: string;
  team_type: TeamType;
  member_count: number;
  created_at: string;
  created_by: { id: string; username: string; email: string };
}

export interface UseTeamsReturn {
  data: ApiTeam[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createTeam: (payload: { name: string; description?: string; team_type?: TeamType }) => Promise<ApiTeam>;
  updateTeam: (id: string, payload: { name?: string; description?: string }) => Promise<ApiTeam>;
  deleteTeam: (id: string) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeams(): UseTeamsReturn {
  const [data, setData] = useState<ApiTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    const res = await api.get("/api/v1/teams/");
    const body = res.data;
    const results = body.data?.results ?? body.data ?? [];
    return Array.isArray(results) ? results : [];
  }, []);

  useEffect(() => {
    let active = true;
    fetchTeams()
      .then((teams) => {
        if (!active) return;
        setData(teams);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load teams");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchTeams]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchTeams()
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load teams");
      })
      .finally(() => setLoading(false));
  }, [fetchTeams]);

  const createTeam = async (payload: {
    name: string;
    description?: string;
    team_type?: TeamType;
  }): Promise<ApiTeam> => {
    const res = await api.post("/api/v1/teams/", payload);
    const team: ApiTeam = res.data.data ?? res.data;
    setData((prev) => [team, ...prev]);
    return team;
  };

  const updateTeam = async (
    id: string,
    payload: { name?: string; description?: string }
  ): Promise<ApiTeam> => {
    const res = await api.patch(`/api/v1/teams/${id}/`, payload);
    const team: ApiTeam = res.data.data ?? res.data;
    setData((prev) => prev.map((t) => (t.id === id ? team : t)));
    return team;
  };

  const deleteTeam = async (id: string): Promise<void> => {
    await api.delete(`/api/v1/teams/${id}/`);
    setData((prev) => prev.filter((t) => t.id !== id));
  };

  return { data, loading, error,   refetch, createTeam, updateTeam, deleteTeam };
}
