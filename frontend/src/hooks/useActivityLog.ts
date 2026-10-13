import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  user: { id: string; username: string } | null;
  action: "CREATED" | "ADDED" | "UPDATED" | "DELETED" | "REVEALED";
  module_name: string;
  object_id: string;
  description: string;
  timestamp: string;
}

interface UseActivityLogReturn {
  data: ActivityLogEntry[];
  count: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useActivityLog(
  projectId: string,
  page: number = 1
): UseActivityLogReturn {
  const [data, setData] = useState<ActivityLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchLog = useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/api/v1/projects/${pid}/activity-log/?page=${page}`
      );
      const body = res.data;
      const results = body.data?.results ?? body.results ?? body.data ?? [];
      setData(Array.isArray(results) ? results : []);
      setCount(body.data?.count ?? body.count ?? results.length);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [pid, page]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  return { data, count, loading, error, refetch: fetchLog };
}
