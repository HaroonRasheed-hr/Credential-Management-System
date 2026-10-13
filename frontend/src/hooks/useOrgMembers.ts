import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

export interface OrgMember {
  memberId: string;
  userId: string;
  username: string;
  email: string;
  role: "ADMIN" | "DEVELOPER";
  teams: { id: string; name: string }[];
}

interface UseOrgMembersReturn {
  data: OrgMember[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOrgMembers(): UseOrgMembersReturn {
  const [data, setData] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listRes = await api.get("/api/v1/teams/");
      const teams: { id: string; name: string }[] =
        listRes.data?.data?.results ?? listRes.data?.data ?? [];

      if (!Array.isArray(teams) || teams.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const detailResults = await Promise.allSettled(
        teams.map((t) => api.get(`/api/v1/teams/${t.id}/`))
      );

      // Map: userId → OrgMember (merge team tags for same user)
      const byUser = new Map<string, OrgMember>();

      detailResults.forEach((result, i) => {
        if (result.status !== "fulfilled") return;
        const team = teams[i];
        const members: {
          id: string;
          user: { id: string; username: string; email: string };
          role: "ADMIN" | "DEVELOPER";
        }[] = result.value.data?.data?.members ?? result.value.data?.members ?? [];

        members.forEach((m) => {
          const existing = byUser.get(m.user.id);
          if (existing) {
            if (!existing.teams.find((t) => t.id === team.id)) {
              existing.teams.push({ id: team.id, name: team.name });
            }
          } else {
            byUser.set(m.user.id, {
              memberId: m.id,
              userId: m.user.id,
              username: m.user.username,
              email: m.user.email,
              role: m.role,
              teams: [{ id: team.id, name: team.name }],
            });
          }
        });
      });

      setData(Array.from(byUser.values()));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load org members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
