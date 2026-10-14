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
    if (!pid) return null;
    const res = await api.get(
      `/api/v1/projects/${pid}/activity-log/?page=${page}`
    );
    const body = res.data;
    const results = body.data?.results ?? body.results ?? body.data ?? [];
    return {
      data: Array.isArray(results) ? results : [],
      count: body.data?.count ?? body.count ?? results.length,
    };
  }, [pid, page]);

  useEffect(() => {
    let active = true;
    fetchLog()
      .then((result) => {
        if (!active) return;
        if (result) {
          setData(result.data);
          setCount(result.count);
        }
        setError(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load activity log");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchLog]);

  const refetch = useCallback(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    return fetchLog()
      .then((result) => {
        if (result) {
          setData(result.data);
          setCount(result.count);
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load activity log");
      })
      .finally(() => setLoading(false));
  }, [fetchLog, pid]);

  return { data, count, loading, error, refetch };
}
