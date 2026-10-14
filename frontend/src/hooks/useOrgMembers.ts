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
    const res = await api.get("/api/v1/teams/members/");
    const members: OrgMember[] = res.data?.data ?? [];
    return Array.isArray(members) ? members : [];
  }, []);

  useEffect(() => {
    let active = true;
    fetch()
      .then((members) => {
        if (!active) return;
        setData(members);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load org members");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetch]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch()
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load org members");
      })
      .finally(() => setLoading(false));
  }, [fetch]);

  return { data, loading, error, refetch };
}
