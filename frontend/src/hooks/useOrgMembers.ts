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
      const res = await api.get("/api/v1/teams/members/");
      const members: OrgMember[] = res.data?.data ?? [];
      setData(Array.isArray(members) ? members : []);
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
