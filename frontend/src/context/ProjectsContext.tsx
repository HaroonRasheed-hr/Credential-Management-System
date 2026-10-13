"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { Project } from "@/data/projects";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import type { ApiProject } from "@/hooks/useProjects";

/** True when the given path is the projects list/dashboard route. */
const isProjectsListPath = (p: string | null | undefined) =>
  /^\/dashboard\/projects\/?$/.test(p ?? "");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map API project (ACTIVE/ARCHIVED, UUID id) → legacy frontend Project shape */
function mapApiProject(p: ApiProject): Project {
  return {
    id: p.id as unknown as number, // stored as string UUID; downstream uses String() when calling API
    name: p.name,
    description: p.description,
    longDescription: p.description,
    status: p.status === "ACTIVE" ? "Active" : "Archived",
    envVariables: p.env_count,
    licenseKeys: p.license_count,
    adminCredentials: p.admin_cred_count,
    teamMembers: p.member_count,
    createdDate: new Date(p.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    createdBy: p.created_by.username,
    createdById: p.created_by.id,
    password: p.password,
  };
}

// ── Legacy role for members ───────────────────────────────────────────────────

export type ProjectRole = "Admin" | "Developer";

export interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: ProjectRole;
}

// ── Context value shape ───────────────────────────────────────────────────────

interface ProjectsContextValue {
  projects: Project[];
  visibleProjects: Project[];
  canViewProject: (project: Project) => boolean;
  addProject: (project: Project) => void;
  updateProject: (updated: Project) => void;
  deleteProject: (projectId: number | string) => void;
  membersByProject: Record<number, ProjectMember[]>;
  getMembers: (projectId: number) => ProjectMember[];
  assignMember: (projectId: number, member: ProjectMember) => void;
  unassignMember: (projectId: number, memberId: number) => void;
  refetch: () => void;
  loading: boolean;
  error: string | null;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [membersByProject, setMembersByProject] = useState<
    Record<number, ProjectMember[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch projects from backend ──────────────────────────────────────────
  // `silent` skips the loading flag so a background re-sync (e.g. when the user
  // returns to the projects list) refreshes the data in place without a
  // skeleton flash. `inFlightRef` dedupes overlapping syncs.
  const inFlightRef = useRef(false);
  const refetch = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        // Cache-bust + no-cache so a re-sync after a mutation (e.g. archiving a
        // project on its detail page) never reads a stale list from the browser
        // HTTP cache — otherwise the dashboard status wouldn't update live.
        const res = await api.get("/api/v1/projects/", {
          params: { _t: Date.now() },
          headers: { "Cache-Control": "no-cache" },
        });
        const body = res.data;
        const results: ApiProject[] = body.data?.results ?? body.results ?? body.data ?? [];
        setProjects(Array.isArray(results) ? results.map(mapApiProject) : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load projects");
      } finally {
        if (!opts?.silent) setLoading(false);
        inFlightRef.current = false;
      }
    },
    [user]
  );

  // Load on mount / user change. Counts (env, license, members) are refreshed
  // by callers via refetch() when returning to list/dashboard views.
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Keep the projects list live. In the static-export build, navigating back
  // from a project detail page can restore a cached render, so a status change
  // (Active ↔ Archived) made on the detail page wouldn't show on the dashboard
  // until a manual reload. Silently re-sync whenever the user lands back on the
  // list — both via client navigation (pathname) and browser back/forward
  // (popstate, which "Back to Projects" triggers). The shared-state update
  // forces the list to reflect the latest data immediately.
  const pathname = usePathname();
  const skipInitialSync = useRef(true);
  useEffect(() => {
    if (!user) return;
    if (skipInitialSync.current) {
      skipInitialSync.current = false;
      return;
    }
    if (isProjectsListPath(pathname)) refetch({ silent: true });
  }, [pathname, user, refetch]);

  useEffect(() => {
    const onPopState = () => {
      if (user && isProjectsListPath(window.location.pathname)) {
        refetch({ silent: true });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [user, refetch]);

  // ── Mutators ─────────────────────────────────────────────────────────────

  const addProject = useCallback(
    async (project: Project) => {
      // project has already been inserted by Dashboard via createProject API call;
      // this callback just keeps local state in sync.
      setProjects((prev) => {
        const exists = prev.some((p) => String(p.id) === String(project.id));
        if (exists) return prev;
        return [project, ...prev];
      });
    },
    []
  );

  const updateProject = useCallback(async (updated: Project) => {
    // Optimistic update; caller is responsible for the PATCH call.
    setProjects((prev) =>
      prev.map((p) => (String(p.id) === String(updated.id) ? updated : p))
    );
    try {
      await api.patch(`/api/v1/projects/${String(updated.id)}/`, {
        name: updated.name,
        description: updated.description,
        status: updated.status === "Active" ? "ACTIVE" : "ARCHIVED",
      });
    } catch {
      // Revert if API call fails — re-fetch
    }
  }, []);

  const deleteProject = useCallback(async (projectId: number | string) => {
    const id = String(projectId);
    setProjects((prev) => prev.filter((p) => String(p.id) !== id));
    setMembersByProject((prev) => {
      const next = { ...prev };
      delete next[projectId as number];
      return next;
    });
    try {
      await api.delete(`/api/v1/projects/${id}/`);
    } catch {
      // silently ignore — UI already removed it
    }
  }, []);

  // ── Member helpers (kept for TeamPage which still uses legacy pattern) ───
  const getMembers = useCallback(
    (projectId: number) => membersByProject[projectId] ?? [],
    [membersByProject]
  );

  const assignMember = useCallback(
    (projectId: number, member: ProjectMember) => {
      setMembersByProject((prev) => {
        const existing = prev[projectId] ?? [];
        if (existing.some((m) => m.id === member.id)) return prev;
        return { ...prev, [projectId]: [...existing, member] };
      });
    },
    []
  );

  const unassignMember = useCallback((projectId: number, memberId: number) => {
    setMembersByProject((prev) => {
      const existing = prev[projectId] ?? [];
      return {
        ...prev,
        [projectId]: existing.filter((m) => m.id !== memberId),
      };
    });
  }, []);

  // ── Visibility — all fetched projects are already scoped to the user ─────
  const canViewProject = useCallback((_project: Project): boolean => {
    // Backend already returns only visible projects; always true for fetched ones.
    return true;
  }, []);

  const visibleProjects = useMemo(() => projects, [projects]);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      visibleProjects,
      canViewProject,
      addProject,
      updateProject,
      deleteProject,
      membersByProject,
      getMembers,
      assignMember,
      unassignMember,
      refetch,
      loading,
      error,
    }),
    [
      projects,
      visibleProjects,
      canViewProject,
      addProject,
      updateProject,
      deleteProject,
      membersByProject,
      getMembers,
      assignMember,
      unassignMember,
      refetch,
      loading,
      error,
    ]
  );

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside ProjectsProvider");
  return ctx;
}
