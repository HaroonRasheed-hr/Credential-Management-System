"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  User,
  Pencil,
  ArchiveRestore,
} from "lucide-react";
import type { Project } from "@/data/projects";
import { useProjects } from "@/context/ProjectsContext";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/auth";
import EditProjectForm from "./EditProjectForm";
import CredentialsOverviewTab from "./CredentialsOverviewTab";
import { EnvironmentVariablesTabContent } from "./EnvironmentVariablesPage";
import { LicenseKeysTabContent } from "./LicenseKeysPage";
import { AdminCredentialsTabContent } from "./AdminCredentialsPage";
import { AppUsersTabContent } from "./AppUsersPage";
import { TeamTabContent } from "./TeamPage";
import { ActivityLogTabContent } from "./ActivityLogPage";

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  "Overview",
  "Credentials Overview",
  "Environment Variables",
  "License Keys",
  "Admin Credentials",
  "App Users",
  "Team",
  "Activity Log",
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  project: Project;
}

export default function ProjectDetailOverview({ project: initialProject }: Props) {
  const { updateProject } = useProjects();
  const { user } = useAuth();
  const router = useRouter();
  const canManageProject = isAdmin(user?.role);
  const [currentProject, setCurrentProject] = useState<Project>(initialProject);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isEditOpen, setIsEditOpen] = useState(false);

  function handleSave(updated: Project) {
    setCurrentProject(updated);
    updateProject(updated);
  }

  const project = currentProject;
  const isArchived = project.status === "Archived";

  function toggleStatus() {
    const updated = {
      ...project,
      status: isArchived ? ("Active" as const) : ("Archived" as const),
    };
    handleSave(updated);
  }

  // The project.id is a UUID string stored as a number type for backward compat.
  // Always pass String(project.id) to tab components.
  const projectIdStr = String(project.id);

  return (
    <>
      {/* ── Page Body ──────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16">

        {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
        <div className="pt-8 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 flex items-center gap-2 text-sm transition-all duration-200"
            style={{
              fontFamily: "Poppins, sans-serif",
              color: "rgba(255,255,255,0.50)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.50)";
            }}
          >
            <ArrowLeft size={16} />
            Back to Projects
          </button>
        </div>

        {/* ── Project Title Row ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 pb-6">
          <h1
            className="text-3xl font-bold text-white md:text-4xl"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            {project.name}
          </h1>
          <span
            className="rounded-full px-3 py-1 text-sm font-semibold text-white"
            style={{
              background: isArchived
                ? "transparent"
                : "linear-gradient(180deg, #03A9F4 0%, #086FB7 100%)",
              color: "#ffffff",
            }}
          >
            {project.status}
          </span>
        </div>

        {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
        <div
          className="border-b"
          style={{ borderColor: "rgba(255,255,255,0.10)" }}
        >
          <div className="flex items-end gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative flex-shrink-0 min-h-[44px] px-3 pb-2 pt-1.5 text-xs font-medium transition-all duration-200 sm:px-4 sm:pb-3 sm:pt-2 sm:text-sm"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    color: isActive ? "#03A9F4" : "rgba(255,255,255,0.45)",
                    fontWeight: isActive ? 600 : 500,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderBottom: isActive
                      ? "2px solid #03A9F4"
                      : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgba(255,255,255,0.85)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgba(255,255,255,0.45)";
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content: Overview ─────────────────────────────────────────── */}
        {activeTab === "Overview" && (
          <div className="py-8">
            {/* Overview Card */}
            <div
              className="w-full rounded-2xl border p-4 sm:p-6 md:p-8"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              }}
            >
              {/* Project Description */}
              <h2
                className="mb-3 text-lg font-semibold text-white"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Project Description
              </h2>
              <p
                className="leading-relaxed"
                style={{
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.60)",
                  lineHeight: "1.75",
                }}
              >
                {project.longDescription}
              </p>

              <div className="my-8" style={{ height: "1px", background: "rgba(255,255,255,0.08)" }} />

              {/* Info Row 1: Created Date + Created By */}
              <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
                <div className="flex flex-col gap-1.5">
                  <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Created Date
                  </span>
                  <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.90)", fontWeight: 500 }}>
                    {project.createdDate}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Created By
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #03A9F4 0%, #086FB7 100%)" }}>
                      <User size={14} className="text-white" />
                    </div>
                    <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.90)", fontWeight: 500 }}>
                      {project.createdBy}
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-8" style={{ height: "1px", background: "rgba(255,255,255,0.08)" }} />

              {/* Info Row 2: Project Status + Total Team Members */}
              <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
                <div className="flex flex-col gap-1.5">
                  <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Project Status
                  </span>
                  <span
                    className="inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold text-white"
                    style={{
                      background: isArchived
                        ? "transparent"
                        : "linear-gradient(180deg, #03A9F4 0%, #086FB7 100%)",
                      color: "#ffffff",
                    }}
                  >
                    {project.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Total Team Members
                  </span>
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-[#03A9F4]" />
                    <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.90)", fontWeight: 500 }}>
                      {project.teamMembers} members
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Action Buttons ───────────────────────────────────────────── */}
            {canManageProject && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
                {isArchived && (
                  <button
                    type="button"
                    onClick={toggleStatus}
                    className="flex w-full items-center justify-center gap-2 font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:brightness-110 sm:w-auto"
                    style={{
                      minWidth: "180px",
                      height: "52px",
                      borderRadius: "20px",
                      background: "linear-gradient(180deg, #03A9F4 0%, #086FB7 100%)",
                      boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                      fontFamily: "Poppins, sans-serif",
                      fontSize: "16px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <ArchiveRestore size={20} strokeWidth={2.5} />
                    Activate Project
                  </button>
                )}

                {!isArchived && (
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="flex w-full items-center justify-center gap-2 font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:brightness-110 sm:w-auto"
                    style={{
                      minWidth: "180px",
                      height: "52px",
                      borderRadius: "20px",
                      background: "linear-gradient(180deg, #03A9F4 0%, #086FB7 100%)",
                      boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                      fontFamily: "Poppins, sans-serif",
                      fontSize: "16px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Pencil size={20} strokeWidth={2.5} />
                    Edit Project
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Credentials Overview tab */}
        {activeTab === "Credentials Overview" && (
          <CredentialsOverviewTab
            projectId={projectIdStr}
            readOnly={isArchived || !canManageProject}
          />
        )}

        {/* Environment Variables tab */}
        {activeTab === "Environment Variables" && (
          <EnvironmentVariablesTabContent
            projectId={projectIdStr}
            projectName={project.name}
            readOnly={isArchived}
          />
        )}

        {/* License Keys tab */}
        {activeTab === "License Keys" && (
          <LicenseKeysTabContent
            projectId={projectIdStr}
            projectName={project.name}
            readOnly={isArchived}
          />
        )}

        {/* Admin Credentials tab */}
        {activeTab === "Admin Credentials" && (
          <AdminCredentialsTabContent
            projectId={projectIdStr}
            projectName={project.name}
            readOnly={isArchived}
          />
        )}

        {/* App Users tab */}
        {activeTab === "App Users" && (
          <AppUsersTabContent
            projectId={projectIdStr}
            projectName={project.name}
            readOnly={isArchived}
          />
        )}

        {/* Team tab */}
        {activeTab === "Team" && (
          <TeamTabContent
            projectId={projectIdStr}
            projectName={project.name}
            readOnly={isArchived}
          />
        )}

        {/* Activity Log tab */}
        {activeTab === "Activity Log" && (
          <ActivityLogTabContent projectId={projectIdStr} />
        )}
      </div>

      <EditProjectForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSave}
        project={currentProject}
      />
    </>
  );
}
