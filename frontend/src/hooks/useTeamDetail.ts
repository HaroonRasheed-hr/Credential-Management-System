import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiOrgMember {
  id: string;
  user: { id: string; username: string; email: string; role: string };
  role: "ADMIN" | "DEVELOPER";
  added_by: { id: string; username: string } | null;
  added_at: string;
}

export interface ApiTeamDetail {
  id: string;
  name: string;
  description: string;
  team_type: "AI_RESEARCH" | "ENGINEERING" | "ADMIN";
  member_count: number;
  members: ApiOrgMember[];
  created_at: string;
  created_by: { id: string; username: string; email: string };
}

export interface NewMemberInput {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "DEVELOPER";
}

export interface UpdateMemberInput {
  role?: "ADMIN" | "DEVELOPER";
  email?: string;
  password?: string;
}

export interface UseTeamDetailReturn {
  data: ApiTeamDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createAndAddMember: (input: NewMemberInput) => Promise<ApiOrgMember>;
  addMember: (userId: string, role: "ADMIN" | "DEVELOPER") => Promise<ApiOrgMember>;
  updateMember: (memberId: string, input: UpdateMemberInput) => Promise<ApiOrgMember>;
  removeMember: (memberId: string) => Promise<void>;
  revealPassword: (memberId: string) => Promise<string>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeamDetail(teamId: string): UseTeamDetailReturn {
  const [data, setData] = useState<ApiTeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/teams/${teamId}/`);
      const body = res.data;
      setData(body.data ?? body);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const createAndAddMember = async (input: NewMemberInput): Promise<ApiOrgMember> => {
    const res = await api.post(`/api/v1/teams/${teamId}/members/create-user/`, {
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
    });
    const member: ApiOrgMember = res.data.data ?? res.data;
    setData((prev) =>
      prev
        ? {
            ...prev,
            members: [...prev.members, member],
            member_count: prev.member_count + 1,
          }
        : prev
    );
    return member;
  };

  const addMember = async (
    userId: string,
    role: "ADMIN" | "DEVELOPER"
  ): Promise<ApiOrgMember> => {
    const res = await api.post(`/api/v1/teams/${teamId}/members/`, {
      user_id: userId,
      role,
    });
    const member: ApiOrgMember = res.data.data ?? res.data;
    setData((prev) =>
      prev
        ? {
            ...prev,
            members: [...prev.members, member],
            member_count: prev.member_count + 1,
          }
        : prev
    );
    return member;
  };

  const updateMember = async (
    memberId: string,
    input: UpdateMemberInput
  ): Promise<ApiOrgMember> => {
    const res = await api.patch(`/api/v1/teams/${teamId}/members/${memberId}/`, input);
    const member: ApiOrgMember = res.data.data ?? res.data;
    setData((prev) =>
      prev
        ? {
            ...prev,
            members: prev.members.map((m) => (m.id === memberId ? member : m)),
          }
        : prev
    );
    return member;
  };

  const removeMember = async (memberId: string): Promise<void> => {
    await api.delete(`/api/v1/teams/${teamId}/members/${memberId}/`);
    setData((prev) =>
      prev
        ? {
            ...prev,
            members: prev.members.filter((m) => m.id !== memberId),
            member_count: Math.max(0, prev.member_count - 1),
          }
        : prev
    );
  };

  const revealPassword = async (memberId: string): Promise<string> => {
    const res = await api.get(
      `/api/v1/teams/${teamId}/members/${memberId}/reveal/`
    );
    const d = res.data.data ?? res.data;
    return (d?.password ?? "") as string;
  };

  return {
    data,
    loading,
    error,
    refetch: fetchTeam,
    createAndAddMember,
    addMember,
    updateMember,
    removeMember,
    revealPassword,
  };
}
