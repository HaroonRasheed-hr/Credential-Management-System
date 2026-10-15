"use client";

import { useState, useEffect, useCallback } from "react";
import api, { isCancel } from "@/lib/api";
import type { NotificationModule } from "@/data/notifications";

// Map backend module_name → frontend display label
const MODULE_NAME_MAP: Record<string, NotificationModule> = {
  EnvVariable: "Env Variables",
  LicenseKey: "License Keys",
  AdminCredential: "Admin Credentials",
  AppUser: "App Users",
  Project: "Project",
  Team: "Team",
};

export interface RecentActivity {
  id: string;
  projectId: string;
  projectName: string;
  userName: string;
  userRole: "ADMIN" | "DEVELOPER" | null;
  module: NotificationModule;
  description: string;
  action: "CREATED" | "ADDED" | "UPDATED" | "DELETED" | "REVEALED";
  timestamp: string; // ISO string
  createdAt: number; // ms for timeAgo
}

interface UseRecentActivitiesReturn {
  data: RecentActivity[];
  loading: boolean;
  error: string | null;
  // Optionally accepts an AbortSignal so callers polling/refetching (e.g. the
  // notifications page) can cancel an in-flight request on unmount.
  refetch: (signal?: AbortSignal) => void;
}

export function useRecentActivities(limit = 20): UseRecentActivitiesReturn {
  const [data, setData] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get(`/api/v1/reports/recent-activity/?limit=${limit}`, {
        signal,
      }      );
      setError(null);
      const raw: Array<{
        id: string;
        project: { id: string; name: string };
        user: { id: string; username: string; role: string } | null;
        action: string;
        module_name: string;
        description: string;
        timestamp: string;
      }> = res.data?.data ?? [];

      setData(
        raw.map((item) => ({
          id: item.id,
          projectId: item.project.id,
          projectName: item.project.name,
          userName: item.user?.username ?? "Deleted User",
          userRole: (item.user?.role as "ADMIN" | "DEVELOPER" | null) ?? null,
          module:
            MODULE_NAME_MAP[item.module_name] ??
            (item.module_name as NotificationModule),
          description: item.description,
          action: item.action as RecentActivity["action"],
          timestamp: item.timestamp,
          createdAt: new Date(item.timestamp).getTime(),
        }))
      );
    } catch (e: unknown) {
      // Request was cancelled (component unmounting / new poll superseding it) —
      // not a real error, so don't surface it or touch state.
      if (isCancel(e)) return;
      setError(e instanceof Error ? e.message : "Failed to load activities");
    } finally {
      // Skip the state update if the request was aborted; the component is
      // likely gone and there's nothing to render.
      if (!signal?.aborted) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) fetchActivities(controller.signal);
    });
    return () => controller.abort();
  }, [fetchActivities]);

  const refetch = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    return fetchActivities(signal);
  }, [fetchActivities]);

  return { data, loading, error, refetch };
}
