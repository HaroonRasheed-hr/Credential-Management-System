"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProjects } from "@/context/ProjectsContext";
import { useActivity } from "@/context/ActivityContext";
import AddProjectForm from "@/components/projects/AddProjectForm";
import ExportReportModal from "@/components/Dashboard/ExportReportModal";
import { isAdmin, type Role } from "@/lib/auth";
import { MODULE_CONFIG } from "@/data/notifications";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useRecentActivities } from "@/hooks/useRecentActivities";
import api from "@/lib/api";
import type { Project } from "@/data/projects";

// ── Shared styling ────────────────────────────────────────────────────────────

const CARD =
  "rounded-2xl border border-white/10 bg-white/5 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]";

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-purple-500/20 text-purple-300",
  ADMIN: "bg-purple-500/20 text-purple-300",
  Developer: "bg-blue-500/20 text-[#03A1FE]",
  DEVELOPER: "bg-blue-500/20 text-[#03A1FE]",
};

const GRADIENT_BG = "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)";
const OUTLINE_BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-[20px] border border-white/20 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-white/5 sm:w-auto sm:px-8 sm:py-4";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.substring(0, 2) ?? "??").toUpperCase();
}

function formatDate(str: string): string {
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

// ── Module badge ──────────────────────────────────────────────────────────────

const MODULE_BADGE: Record<string, string> = {
  "Env Variables": "bg-blue-500/20 text-blue-300",
  "License Keys": "bg-orange-500/20 text-orange-300",
  "Admin Credentials": "bg-purple-500/20 text-purple-300",
  "App Users": "bg-teal-500/20 text-teal-300",
  Team: "bg-pink-500/20 text-pink-300",
  Project: "bg-[#03A1FE]/20 text-[#03A1FE]",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const { visibleProjects, membersByProject, updateProject, deleteProject, refetch } = useProjects();
  const { log } = useActivity();
  const router = useRouter();

  // Backend-sourced data
  const { data: orgMembers, loading: membersLoading } = useOrgMembers();
  const { data: recentActivities, loading: activitiesLoading } = useRecentActivities(20);

  const activeRole: Role = user?.role ?? "Developer";

  // Developers don't have access to the Dashboard — send them to Projects.
  useEffect(() => {
    if (user?.role === "Developer") {
      router.replace("/dashboard/projects");
    }
  }, [user?.role, router]);

  // Refresh projects (and their env/license/member counts) every time the
  // dashboard mounts, so the stat tiles reflect changes made inside projects
  // without requiring a full page reload.
  useEffect(() => {
    refetch();
  }, [refetch]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordVisible, setDeletePasswordVisible] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Password reveal state: projectId → revealed plaintext
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const togglePasswordVisibility = useCallback(
    async (projectId: string) => {
      const isShowing = visiblePasswords.has(projectId);

      if (isShowing) {
        // Hide
        setVisiblePasswords((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
        return;
      }

      // Show — reveal if not yet fetched
      if (!revealedPasswords[projectId]) {
        setRevealingId(projectId);
        try {
          const res = await api.get(`/api/v1/projects/${projectId}/reveal/`);
          const password: string =
            res.data?.data?.password ?? res.data?.password ?? "";
          setRevealedPasswords((prev) => ({ ...prev, [projectId]: password }));
        } catch {
          // If reveal fails, still toggle to show the masked value
        } finally {
          setRevealingId(null);
        }
      }

      setVisiblePasswords((prev) => {
        const next = new Set(prev);
        next.add(projectId);
        return next;
      });
    },
    [visiblePasswords, revealedPasswords]
  );

  const displayProjects: Project[] = visibleProjects;

  // Stats
  const totalEnvVars = useMemo(
    () => displayProjects.reduce((s, p) => s + p.envVariables, 0),
    [displayProjects]
  );
  const totalLicenseKeys = useMemo(
    () => displayProjects.reduce((s, p) => s + p.licenseKeys, 0),
    [displayProjects]
  );

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayProjects;
    return displayProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [displayProjects, searchQuery]);

  // Project count per member (from context memberships)
  const projectCountByMemberId = useMemo(() => {
    const map: Record<string, number> = {};
    Object.values(membersByProject).forEach((members) => {
      members.forEach((m) => {
        const key = String(m.id);
        map[key] = (map[key] ?? 0) + 1;
      });
    });
    return map;
  }, [membersByProject]);

  // ── Role guard ──
  if (!isAdmin(activeRole)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <ShieldOff size={64} className="mb-5 text-gray-500" />
        <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
        <p className="mt-2 max-w-md text-sm text-gray-400">
          This dashboard is only accessible to Admins.
        </p>
      </div>
    );
  }

  return (
    <>
    <ExportReportModal
      isOpen={showExportModal}
      onClose={() => setShowExportModal(false)}
    />

    {editingProject && (
      <AddProjectForm
        key={editingProject.id}
        isOpen={true}
        onClose={() => setEditingProject(null)}
        onAdd={(updated) => { updateProject(updated); setEditingProject(null); }}
        editItem={editingProject}
      />
    )}

    {/* Delete confirmation modal */}
    {deletingProject && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setDeletingProject(null); }}
      >
        <div
          className="relative w-full max-w-md rounded-2xl border border-white/10 p-8"
          style={{ background: "#0b1b2b", boxShadow: "0px 24px 64px 0px rgba(0,0,0,0.6)", fontFamily: "Poppins, sans-serif" }}
        >
          <button
            type="button"
            onClick={() => setDeletingProject(null)}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-all duration-200 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
            <Trash2 size={22} className="text-red-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">Delete Project</h2>
          <p className="mt-1 text-sm text-gray-400">
            Enter the password for{" "}
            <span className="font-semibold text-white">{deletingProject.name}</span>{" "}
            to permanently delete it.
          </p>

          <div className="mt-6">
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Project Password
            </label>
            <div className="relative">
              <input
                type={deletePasswordVisible ? "text" : "password"}
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }}
                placeholder="Enter project password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-2 focus:ring-[#03A1FE]/30"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setDeletePasswordVisible((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-200 hover:text-white/70"
                tabIndex={-1}
                aria-label={deletePasswordVisible ? "Hide password" : "Show password"}
              >
                {deletePasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {deleteError && (
              <p className="mt-1.5 text-xs text-red-400">{deleteError}</p>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setDeletingProject(null)}
              className="w-full rounded-[20px] border border-white/20 bg-transparent px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!deletePassword.trim()) {
                  setDeleteError("Password is required.");
                  return;
                }
                // Reveal the project password from backend to compare
                try {
                  const res = await api.get(`/api/v1/projects/${String(deletingProject.id)}/reveal/`);
                  const actual: string =
                    res.data?.data?.password ?? res.data?.password ?? "";
                  if (deletePassword.trim() !== actual) {
                    setDeleteError("Incorrect password. Please try again.");
                    return;
                  }
                } catch {
                  setDeleteError("Could not verify password. Try again.");
                  return;
                }
                const deletedName = deletingProject.name;
                deleteProject(deletingProject.id);
                setDeletingProject(null);
                log({
                  projectId: deletingProject.id as unknown as number,
                  projectName: deletedName,
                  module: "Project",
                  message: `deleted project "${deletedName}"`,
                });
              }}
              className="w-full rounded-[20px] px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 sm:w-auto"
              style={{ background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
            >
              Delete Project
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8 md:px-12 lg:px-16 lg:space-y-8">
      {/* Page title row */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Complete overview of all projects, credentials, and team activity.
        </p>
      </div>

      {/* ── Section 1: Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {[
          {
            icon: <FolderOpen size={22} className="text-[#03A1FE]" />,
            bg: "bg-[#03A1FE]/10",
            value: displayProjects.length,
            label: "Total Projects",
          },
          {
            icon: <Users size={22} className="text-purple-400" />,
            bg: "bg-purple-500/10",
            value: membersLoading ? "—" : orgMembers.length,
            label: "Team Members",
          },
          {
            icon: <KeyRound size={22} className="text-orange-400" />,
            bg: "bg-orange-500/10",
            value: totalEnvVars,
            label: "Env Variables",
          },
          {
            icon: <ShieldCheck size={22} className="text-green-400" />,
            bg: "bg-green-500/10",
            value: totalLicenseKeys,
            label: "License Keys",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`${CARD} group cursor-default p-4 transition-all duration-200 hover:border-[#03A1FE]/40 sm:p-5`}
          >
            <div
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${s.bg}`}
            >
              {s.icon}
            </div>
            <p className="text-xl font-bold text-white sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
      {/* ── Section 5: Quick Actions (Admin only) ── */}
      {isAdmin(activeRole) && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
            <button
              onClick={() => router.push("/dashboard/projects")}
              className={OUTLINE_BTN}
            >
              <Plus size={18} />
              Add Project
            </button>
            <button
              onClick={() => router.push("/dashboard/teams")}
              className={OUTLINE_BTN}
            >
              <Users size={18} />
              Add Team Member
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className={OUTLINE_BTN}
            >
              <Download size={18} />
              Export Report
            </button>
            <button
              onClick={() => router.push("/dashboard/notifications")}
              className={OUTLINE_BTN}
            >
              <Activity size={18} />
              View Activity Log
            </button>
          </div>
        </section>
      )}

      {/* ── Section 2: Projects Table ── */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-white">All Projects</h2>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-1 focus:ring-[#03A1FE] sm:w-64"
            />
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-white/10 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
          style={{ background: "#0b1b2b" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  {[
                    "Project Name",
                    "Description",
                    "Password",
                    "Status",
                    "Members",
                    "Created By",
                    "Created At",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project, idx) => {
                    const projectId = String(project.id);
                    const memberCount =
                      membersByProject[project.id]?.length ??
                      project.teamMembers;
                    const isRevealing = revealingId === projectId;
                    const isVisible = visiblePasswords.has(projectId);
                    const revealedPw = revealedPasswords[projectId];

                    return (
                      <tr
                        key={project.id}
                        className="border-b border-white/5 transition-all duration-200 hover:bg-white/5"
                        style={{
                          background:
                            idx % 2 === 0
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(255,255,255,0.05)",
                        }}
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                            className="flex items-center gap-2 font-medium text-white transition-colors duration-150 hover:text-[#03A1FE]"
                          >
                            <FolderOpen
                              size={16}
                              className="shrink-0 text-[#03A1FE]"
                            />
                            {project.name}
                          </button>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3">
                          <span
                            title={project.description}
                            className="block max-w-[180px] truncate text-gray-400"
                          >
                            {project.description}
                          </span>
                        </td>

                        {/* Password */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm text-gray-300">
                              {isVisible && revealedPw
                                ? revealedPw
                                : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(projectId)}
                              disabled={isRevealing}
                              className="text-gray-500 transition-colors duration-200 hover:text-[#03A1FE] disabled:opacity-50"
                              aria-label={isVisible ? "Hide password" : "Show password"}
                            >
                              {isRevealing ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : isVisible ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              project.status === "Active"
                                ? "bg-green-500/20 text-green-300"
                                : "bg-white/10 text-gray-400"
                            }`}
                          >
                            {project.status}
                          </span>
                        </td>

                        {/* Members */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Users size={14} />
                            {memberCount}
                          </div>
                        </td>

                        {/* Created By */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ background: GRADIENT_BG }}
                            >
                              {getInitials(project.createdBy)}
                            </div>
                            <span className="text-gray-400">
                              {project.createdBy}
                            </span>
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-3 text-gray-400">
                          {formatDate(project.createdDate)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          {isAdmin(activeRole) ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  router.push(
                                    `/dashboard/projects/${project.id}`
                                  )
                                }
                                aria-label="View project"
                                className="text-gray-400 transition-colors duration-200 hover:text-[#03A1FE]"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => setEditingProject(project)}
                                aria-label="Edit project"
                                className="text-gray-400 transition-colors duration-200 hover:text-[#03A1FE]"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingProject(project);
                                  setDeletePassword("");
                                  setDeletePasswordVisible(false);
                                  setDeleteError("");
                                }}
                                aria-label="Delete project"
                                className="text-gray-400 transition-colors duration-200 hover:text-red-400"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </section>

      {/* ── Section 3 & 4 side-by-side on large screens ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Section 3: Recent Activity Feed */}
        <section className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
            <button
              onClick={() => router.push("/dashboard/notifications")}
              className="text-sm font-medium transition-colors duration-200 hover:opacity-80"
              style={{ color: "#03A1FE" }}
            >
              View All →
            </button>
          </div>

          <div className={`${CARD} p-6`}>
            {activitiesLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                Loading activity…
              </div>
            ) : recentActivities.length === 0 ? (
              <p className="text-center text-sm text-gray-500">
                No activity yet.
              </p>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 h-full w-px bg-white/10" />

                <div className="space-y-5">
                  {recentActivities.slice(0, 6).map((entry) => {
                    const cfg = MODULE_CONFIG[entry.module];
                    return (
                      <div key={entry.id} className="flex items-start gap-4">
                        {/* Avatar */}
                        <div
                          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: GRADIENT_BG }}
                        >
                          {getInitials(entry.userName)}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1 pt-1">
                          <p className="text-sm text-gray-300">
                            <span className="font-semibold text-white">
                              {entry.userName}
                            </span>{" "}
                            {entry.description}
                            {entry.projectName && (
                              <span className="text-gray-500">
                                {" "}in{" "}
                                <span className="text-gray-300">
                                  {entry.projectName}
                                </span>
                              </span>
                            )}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                MODULE_BADGE[entry.module] ??
                                "bg-white/10 text-gray-400"
                              }`}
                            >
                              {cfg && (
                                <cfg.icon
                                  size={11}
                                  aria-hidden="true"
                                />
                              )}
                              {entry.module}
                            </span>
                            <span className="text-xs text-gray-500">
                              {timeAgo(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Team Members */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Team Members</h2>
            <button
              onClick={() => router.push("/dashboard/teams")}
              className="text-sm font-medium transition-colors duration-200 hover:opacity-80"
              style={{ color: "#03A1FE" }}
            >
              View All →
            </button>
          </div>

          {membersLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              Loading members…
            </div>
          ) : orgMembers.length === 0 ? (
            <div className={`${CARD} p-6 text-center text-sm text-gray-500`}>
              No team members yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {orgMembers.slice(0, 4).map((member) => {
                const projectCount = projectCountByMemberId[member.userId] ?? 0;
                const displayRole = member.role === "ADMIN" ? "Admin" : "Developer";
                return (
                  <div
                    key={member.userId}
                    className={`${CARD} group p-4 transition-all duration-200 hover:border-[#03A1FE]/40`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ background: GRADIENT_BG }}
                      >
                        {getInitials(member.username)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">
                          {member.username}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_BADGE[displayRole] ?? "bg-white/10 text-gray-400"
                        }`}
                      >
                        {displayRole}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <FolderOpen size={12} />
                        {projectCount > 0
                          ? `Projects: ${projectCount}`
                          : `Teams: ${member.teams.length}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
    </>
  );
}
