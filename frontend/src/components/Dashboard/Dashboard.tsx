"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  KeyRound,
  FileLock,
  ShieldCheck,
  Users,
  AlertCircle,
} from "lucide-react";
import { type Project } from "@/data/projects";
import AddProjectForm from "@/components/projects/AddProjectForm";
import { useProjects } from "@/context/ProjectsContext";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import api from "@/lib/api";
import type { ApiProject } from "@/hooks/useProjects";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ModuleStat {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count: number;
}

function getModuleStats(project: Project): ModuleStat[] {
  return [
    { icon: KeyRound, label: "Env Variables", count: project.envVariables },
    { icon: FileLock, label: "License Keys", count: project.licenseKeys },
    { icon: ShieldCheck, label: "Admin Credentials", count: project.adminCredentials },
    { icon: Users, label: "Team Members", count: project.teamMembers },
  ];
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ProjectCardSkeleton() {
  return (
    <div
      className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b1b2b] p-4 md:p-6"
      style={{ boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
    >
      <div className="h-5 w-3/4 animate-pulse rounded-xl bg-white/5" />
      <div className="h-4 w-full animate-pulse rounded-xl bg-white/5" />
      <div className="h-4 w-2/3 animate-pulse rounded-xl bg-white/5" />
      <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-12 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectsDashboard() {
  const { visibleProjects, addProject, loading, error } = useProjects();
  const { user } = useAuth();
  const { query } = useSearch();
  const canCreateProject = isAdmin(user?.role);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredProjects = visibleProjects.filter((p) =>
    matchesQuery(query, p.name, p.description, p.longDescription)
  );

  const {
    currentPage,
    setCurrentPage,
    pageItems: paginatedProjects,
    totalItems,
    itemsPerPage,
  } = usePagination(filteredProjects, query, 6);

  async function handleAddProject(project: Project) {
    // Throws on network/API error — AddProjectForm's catch block will show the error banner.
    const res = await api.post("/api/v1/projects/", {
      name: project.name,
      description: project.description,
      status: project.status === "Active" ? "ACTIVE" : "ARCHIVED",
      password: project.password,
    });
    const created: ApiProject = res.data.data;
    addProject({
      id: created.id as unknown as number,
      name: created.name,
      description: created.description,
      longDescription: created.description,
      status: created.status === "ACTIVE" ? "Active" : "Archived",
      envVariables: created.env_count ?? 0,
      licenseKeys: created.license_count ?? 0,
      adminCredentials: created.admin_cred_count ?? 0,
      teamMembers: created.member_count ?? 0,
      createdDate: new Date(created.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      createdBy: created.created_by.username,
      createdById: created.created_by.id,
      password: created.password,
    });
  }

  return (
    <>
      {/* Page Title Row */}
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8 md:flex-row md:items-center md:justify-between md:px-12 lg:px-16 lg:py-8">
        <h1 className="text-3xl font-semibold text-white md:text-4xl">
          My Projects
        </h1>
        {canCreateProject && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex h-[35px] w-full cursor-pointer items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:brightness-110 sm:h-[55px] sm:max-w-[230px] sm:text-lg"
            style={{
              borderRadius: "20px",
              background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
              boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
            }}
          >
            <Plus size={15} strokeWidth={3} />
            Add Project
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 sm:mx-8 md:mx-12 lg:mx-16">
          <AlertCircle size={18} className="flex-shrink-0 text-red-400" />
          <p
            className="text-sm text-red-300"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <main className="grid grid-cols-1 gap-4 px-4 pb-4 sm:gap-6 sm:px-8 md:grid-cols-2 md:px-12 lg:grid-cols-3 lg:px-16">
          {[0, 1, 2].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </main>
      )}

      {/* Empty state */}
      {!loading && filteredProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center px-4 py-24 text-center sm:px-8 md:px-12 lg:px-16">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <KeyRound size={26} className="text-[#03A1FE]" />
          </div>
          {query.trim() && visibleProjects.length > 0 ? (
            <>
              <p className="text-base font-medium text-white">
                No projects match &quot;{query.trim()}&quot;
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Try a different name or description.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-white">No projects yet</p>
              <p className="mt-1 text-sm text-gray-400">
                {canCreateProject
                  ? 'Click "Add Project" to create your first project.'
                  : "You don't have access to any projects yet. Ask an admin to add you."}
              </p>
            </>
          )}
        </div>
      )}

      {/* Project Cards Grid */}
      {!loading && paginatedProjects.length > 0 && (
        <main className="grid grid-cols-1 gap-4 px-4 pb-4 sm:gap-6 sm:px-8 md:grid-cols-2 md:px-12 lg:grid-cols-3 lg:px-16">
          {paginatedProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b1b2b] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#03A1FE]/60 hover:shadow-[0px_8px_25px_0px_rgba(3, 161, 254,0.2)] cursor-pointer md:p-6"
              style={{ boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", textDecoration: "none" }}
            >
              <span
                className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium text-white"
                style={{
                  background:
                    project.status === "Archived"
                      ? "transparent"
                      : "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                  color: "#ffffff",
                }}
              >
                {project.status}
              </span>

              <h2 className="pr-16 text-xl font-bold text-white">
                {project.name}
              </h2>
              <p className="text-sm font-light text-gray-400">
                {project.description}
              </p>

              <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
                {getModuleStats(project).map(({ icon: Icon, label, count }) => (
                  <div
                    key={label}
                    title={label}
                    className="flex items-center gap-1.5 text-gray-300"
                  >
                    <Icon size={18} className="text-[#03A1FE]" />
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </main>
      )}

      <div className="px-4 pb-16 sm:px-8 md:px-12 lg:px-16">
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <AddProjectForm
        key="new"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddProject}
      />
    </>
  );
}
