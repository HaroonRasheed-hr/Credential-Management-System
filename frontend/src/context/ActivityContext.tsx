"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/auth";
import { canReceiveNotification } from "@/lib/permissions";
import type { NotificationModule } from "@/data/notifications";
import { useStorageSnapshot } from "@/hooks/useStorageSnapshot";

// Activities are persisted so the notification feed / unread counts survive a
// role switch in the same browser — letting a higher role log in afterwards and
// still find the history + counts for actions a lower role took. (Frontend-only
// demo: this sessionStorage feed is the stand-in for a server notification store.)
const ACTIVITY_KEY = "pcmp_activities";

// An activity entry is the single source of truth behind BOTH the per-project
// Activity Log and the global notification feed / toasts. Every create / update
// / delete action in a project calls `log()`.

export type ActivityModule = NotificationModule;

export interface ActivityEntry {
  id: number;
  projectId: number | null;
  projectName: string;
  userName: string;
  module: ActivityModule;
  /** Action phrase, e.g. `added environment variable "API_KEY"`. */
  message: string;
  /**
   * Role of the user who performed the action. Drives notification propagation
   * up the hierarchy: an entry is only surfaced to viewers whose role may see
   * the actor's role (see lib/permissions `canReceiveNotification`). e.g. a
   * Developer's action notifies Developer + Admin.
   * Admin's action notifies Admin only.
   */
  actorRole: Role | null;
  createdAt: number;
  read: boolean;
}

function parseActivitySnapshot(
  snapshot: string | null | undefined
): ActivityEntry[] {
  if (!snapshot) return [];
  try {
    const parsed = JSON.parse(snapshot) as ActivityEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface LogInput {
  projectId: number | null;
  projectName: string;
  module: ActivityModule;
  message: string;
}

interface ActivityContextValue {
  activities: ActivityEntry[];
  unreadCount: number;
  toasts: ActivityEntry[];
  log: (input: LogInput) => void;
  markAllRead: () => void;
  markRead: (id: number) => void;
  dismissToast: (id: number) => void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

/** Human-friendly relative timestamp. */
export function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const activitiesSnapshot = useStorageSnapshot(ACTIVITY_KEY, "session");
  const [activitiesState, setActivitiesState] = useState<{
    snapshot: string | null | undefined;
    value: ActivityEntry[];
  }>({ snapshot: undefined, value: [] });
  const activities =
    activitiesState.snapshot === activitiesSnapshot
      ? activitiesState.value
      : parseActivitySnapshot(activitiesSnapshot);
  const setActivities = useCallback<Dispatch<SetStateAction<ActivityEntry[]>>>(
    (action) => {
      setActivitiesState((current) => {
        const currentActivities =
          current.snapshot === activitiesSnapshot
            ? current.value
            : parseActivitySnapshot(activitiesSnapshot);
        return {
          snapshot: activitiesSnapshot,
          value:
            typeof action === "function"
              ? action(currentActivities)
              : action,
        };
      });
    },
    [activitiesSnapshot]
  );
  const [toasts, setToasts] = useState<ActivityEntry[]>([]);
  const nextId = useRef(1);
  const hydrated = activitiesSnapshot !== undefined;

  // Persist after hydration so we never clobber the stored feed with defaults.
  // Only write when the value actually changed, so syncing from another tab's
  // `storage` event can't bounce back and cause a write/event ping-pong loop.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const serialized = JSON.stringify(activities);
      if (window.sessionStorage.getItem(ACTIVITY_KEY) !== serialized) {
        window.sessionStorage.setItem(ACTIVITY_KEY, serialized);
      }
    } catch {
      // ignore
    }
  }, [activities, hydrated]);

  // Keep the latest feed in a ref so the cross-tab `storage` handler can diff
  // against it without being recreated on every change.
  const activitiesRef = useRef<ActivityEntry[]>([]);
  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  const log = useCallback(
    (input: LogInput) => {
      nextId.current = Math.max(
        nextId.current,
        activities.reduce((max, activity) => Math.max(max, activity.id), 0) + 1
      );
      const entry: ActivityEntry = {
        id: nextId.current++,
        projectId: input.projectId,
        projectName: input.projectName,
        module: input.module,
        message: input.message,
        userName: user?.name ?? "Someone",
        actorRole: user?.role ?? null,
        createdAt: Date.now(),
        read: false,
      };
      setActivities((prev) => [entry, ...prev]);
      setToasts((prev) => [entry, ...prev]);
    },
    [activities, setActivities, user]
  );

  // Notification hierarchy: an entry is visible to the current viewer when the
  // viewer's role is allowed to receive notifications from the actor's role
  // (Admin > Developer; actions flow upward). Centralized in
  // lib/permissions so every notification surface uses identical rules.
  const role = user?.role ?? null;
  const canSee = useCallback(
    (entry: ActivityEntry) => canReceiveNotification(role, entry.actorRole),
    [role]
  );

  // Real-time cross-tab sync (frontend stand-in for a websocket). When another
  // tab/role records an action, mirror it into this tab's feed and pop a toast
  // for any newly-arrived entries this role is allowed to receive — so the bell,
  // dropdown, unread count, history and popup all update without a refresh.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY) return;
      let parsed: ActivityEntry[];
      try {
        parsed = e.newValue ? (JSON.parse(e.newValue) as ActivityEntry[]) : [];
      } catch {
        return;
      }
      if (!Array.isArray(parsed)) return;
      const knownIds = new Set(activitiesRef.current.map((a) => a.id));
      const incomingVisible = parsed.filter(
        (a) => !knownIds.has(a.id) && canSee(a)
      );
      nextId.current = Math.max(
        nextId.current,
        parsed.reduce((max, a) => Math.max(max, a.id), 0) + 1
      );
      setActivities(parsed);
      if (incomingVisible.length > 0) {
        setToasts((prev) => [...incomingVisible, ...prev]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [canSee, setActivities]);

  const markAllRead = useCallback(
    () =>
      setActivities((prev) =>
        prev.map((a) => (canSee(a) ? { ...a, read: true } : a))
      ),
    [canSee, setActivities]
  );

  const markRead = useCallback(
    (id: number) =>
      setActivities((prev) =>
        prev.map((a) => (a.id === id && canSee(a) ? { ...a, read: true } : a))
      ),
    [canSee, setActivities]
  );

  const dismissToast = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    []
  );

  // Everything exposed to consumers is pre-filtered to the viewer's role, so
  // notification lists, popups, toasts and unread badges only ever surface
  // actions the current role is allowed to receive.
  const visibleActivities = useMemo(
    () => activities.filter(canSee),
    [activities, canSee]
  );
  const visibleToasts = useMemo(
    () => toasts.filter(canSee),
    [toasts, canSee]
  );
  const unreadCount = visibleActivities.filter((a) => !a.read).length;

  const value = useMemo<ActivityContextValue>(
    () => ({
      activities: visibleActivities,
      unreadCount,
      toasts: visibleToasts,
      log,
      markAllRead,
      markRead,
      dismissToast,
    }),
    [
      visibleActivities,
      unreadCount,
      visibleToasts,
      log,
      markAllRead,
      markRead,
      dismissToast,
    ]
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used inside ActivityProvider");
  return ctx;
}
