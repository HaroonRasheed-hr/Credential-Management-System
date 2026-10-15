"use client";
import { useState } from "react";
import {
  ChevronRight,
  Download,
  Paperclip,
  Plus,
  Pencil,
  Trash2,
  User,
  AlertCircle,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useEnvVariables } from "@/hooks/useEnvVariables";
import type { EnvVariable as ApiEnvVar } from "@/hooks/useEnvVariables";
import AddEnvVariableForm from "./AddEnvVariableForm";
import BrandLogo from "@/components/common/BrandLogo";

// ── Types ─────────────────────────────────────────────────────────────────────

type Environment = "Development" | "Staging" | "Production";

/** UI-layer type used by form components */
interface UiEnvVariable {
  id: number;
  key: string;
  value?: string;
  environment: Environment;
  updatedBy: string;
  updatedById?: string;
  updatedAt: string;
  attachedFile?: { name: string; dataUrl: string };
  /** API UUID */
  apiId?: string;
}

// ── Env field mappings ────────────────────────────────────────────────────────

const ENV_DISPLAY: Record<ApiEnvVar["environment"], Environment> = {
  DEV: "Development",
  STAGING: "Staging",
  PROD: "Production",
};

const ENV_API: Record<Environment, ApiEnvVar["environment"]> = {
  Development: "DEV",
  Staging: "STAGING",
  Production: "PROD",
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  "Overview",
  "Environment Variables",
  "License Keys",
  "Admin Credentials",
  "App Users",
  "Team",
  "Activity Log",
];

const ENV_BADGE: Record<Environment, { bg: string; color: string; border: string }> = {
  Production: {
    bg: "rgba(34,197,94,0.15)",
    color: "#4ade80",
    border: "1px solid rgba(34,197,94,0.30)",
  },
  Staging: {
    bg: "rgba(251,146,60,0.15)",
    color: "#fb923c",
    border: "1px solid rgba(251,146,60,0.30)",
  },
  Development: {
    bg: "rgba(3, 161, 254,0.15)",
    color: "#03A1FE",
    border: "1px solid rgba(3, 161, 254,0.30)",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EnvironmentBadge({ env }: { env: Environment }) {
  const s = ENV_BADGE[env];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: s.bg,
        color: s.color,
        border: s.border,
        fontFamily: "Poppins, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {env}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="h-4 w-full animate-pulse rounded-xl bg-white/5" />
        </td>
      ))}
    </tr>
  );
}

// ── Env Variables Tab Content ─────────────────────────────────────────────────

interface EnvironmentVariablesTabContentProps {
  projectId?: number | string;
  projectName?: string;
  readOnly?: boolean;
}

export function EnvironmentVariablesTabContent({
  projectId,
  projectName = "E-Commerce Platform",
  readOnly = false,
}: EnvironmentVariablesTabContentProps = {}) {
  const { user } = useAuth();
  const canDeleteRow = (row: UiEnvVariable): boolean => {
    if (readOnly) return false;
    if (isAdmin(user?.role)) return true;
    if (row.updatedById != null && row.updatedById === user?.id) return true;
    if (row.updatedBy !== "—" && user?.name != null && row.updatedBy === user.name) return true;
    return false;
  };
  const { query } = useSearch();
  const pid = projectId != null ? String(projectId) : "";

  const {
    data: apiVars,
    loading,
    error,
    createEnvVariable,
    updateEnvVariable,
    deleteEnvVariable,
  } = useEnvVariables(pid);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<UiEnvVariable | null>(null);

  const variables: UiEnvVariable[] = apiVars.map((v, index) => ({
    id: index,
    apiId: v.id,
    key: v.key,
    environment: ENV_DISPLAY[v.environment] ?? "Development",
    updatedBy: v.updated_by?.username ?? "—",
    updatedById: v.updated_by?.id,
    updatedAt: new Date(v.updated_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    attachedFile:
      v.file_name && v.file_data
        ? { name: v.file_name, dataUrl: v.file_data }
        : undefined,
  }));

  const filtered = variables.filter((v) =>
    matchesQuery(query, v.key, v.environment, v.updatedBy)
  );

  const { currentPage, setCurrentPage, pageItems, totalItems, itemsPerPage } =
    usePagination(filtered, query);

  const handleDeleteVariable = async (apiId: string) => {
    try {
      await deleteEnvVariable(apiId);
    } catch {
      // silently ignore
    }
  };

  const handleAddVariable = async (uiVar: UiEnvVariable) => {
    await createEnvVariable({
      key: uiVar.key,
      value: uiVar.value ?? "—",
      environment: ENV_API[uiVar.environment],
      file_name: uiVar.attachedFile?.name ?? "",
      file_data: uiVar.attachedFile?.dataUrl ?? "",
    });
  };

  const handleEditVariable = async (uiVar: UiEnvVariable) => {
    if (!uiVar.apiId) return;
    await updateEnvVariable(uiVar.apiId, {
      key: uiVar.key,
      ...(uiVar.value ? { value: uiVar.value } : {}),
      environment: ENV_API[uiVar.environment],
      // Always sent so removing an attachment clears it server-side.
      file_name: uiVar.attachedFile?.name ?? "",
      file_data: uiVar.attachedFile?.dataUrl ?? "",
    });
  };

  return (
    <div className="py-8">
      {/* Section Header Row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2
          className="text-2xl font-semibold text-white"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          Environment Variables
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{
              borderRadius: "20px",
              background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
              boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              fontFamily: "Poppins, sans-serif",
              fontSize: "14px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              padding: "12px 40px",
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Variable
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-300" style={{ fontFamily: "Poppins, sans-serif" }}>
            {error}
          </p>
        </div>
      )}

      {/* Table Card */}
      <div
        className="w-full overflow-hidden rounded-2xl border"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            {/* Table Head */}
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                {["Key", "File", "Environment", "Updated By", "Updated At", "Actions"].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-4 text-left text-xs font-bold uppercase"
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      color: "rgba(255,255,255,0.55)",
                      letterSpacing: "0.08em",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && totalItems === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center"
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      fontSize: "14px",
                      color: "rgba(255,255,255,0.38)",
                    }}
                  >
                    {query.trim() && variables.length > 0
                      ? `No environment variables match "${query.trim()}".`
                      : 'No environment variables yet. Click "Add Variable" to get started.'}
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((row, index) => {
                  const isEven = index % 2 === 0;

                  return (
                    <tr
                      key={row.apiId ?? row.id}
                      className="group transition-all duration-200 hover:bg-white/5"
                      style={{
                        background: isEven
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(255,255,255,0.05)",
                      }}
                    >
                      {/* Key */}
                      <td
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <code
                          style={{
                            fontFamily: "'Courier New', Courier, monospace",
                            fontSize: "12px",
                            background: "rgba(3, 161, 254,0.10)",
                            color: "#03A1FE",
                            padding: "3px 9px",
                            borderRadius: "6px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.key}
                        </code>
                      </td>

                      {/* File */}
                      <td
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        {row.attachedFile ? (
                          <div className="flex items-center gap-2">
                            <Paperclip size={13} style={{ color: "#03A1FE", flexShrink: 0 }} />
                            <span
                              style={{
                                fontFamily: "Poppins, sans-serif",
                                fontSize: "12px",
                                color: "rgba(255,255,255,0.70)",
                                maxWidth: "140px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={row.attachedFile.name}
                            >
                              {row.attachedFile.name}
                            </span>
                            <a
                              href={row.attachedFile.dataUrl}
                              download={row.attachedFile.name}
                              className="inline-flex flex-shrink-0 items-center rounded transition-all duration-200"
                              style={{ color: "rgba(255,255,255,0.35)", padding: "4px", lineHeight: 0 }}
                              aria-label={`Download ${row.attachedFile.name}`}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLAnchorElement).style.color = "#03A1FE";
                                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.35)";
                                (e.currentTarget as HTMLAnchorElement).style.background = "none";
                              }}
                            >
                              <Download size={13} />
                            </a>
                          </div>
                        ) : (
                          <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.22)" }}>—</span>
                        )}
                      </td>

                      {/* Environment */}
                      <td
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <EnvironmentBadge env={row.environment} />
                      </td>

                      {/* Updated By */}
                      <td
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                            style={{
                              background: "linear-gradient(135deg, #03A1FE 0%, #006AB3 100%)",
                            }}
                          >
                            <User size={13} className="text-white" />
                          </div>
                          <span
                            style={{
                              fontFamily: "Poppins, sans-serif",
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.75)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.updatedBy}
                          </span>
                        </div>
                      </td>

                      {/* Updated At */}
                      <td
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <span
                          style={{
                            fontFamily: "Poppins, sans-serif",
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.45)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.updatedAt}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingVar(row)}
                            className="transition-all duration-200"
                            style={{
                              color: "rgba(255,255,255,0.40)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "6px",
                              lineHeight: 0,
                            }}
                            aria-label="Edit variable"
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE";
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)";
                              (e.currentTarget as HTMLButtonElement).style.background = "none";
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          {canDeleteRow(row) && (
                            <button
                              type="button"
                              onClick={() => row.apiId && handleDeleteVariable(row.apiId)}
                              className="transition-all duration-200"
                              style={{
                                color: "rgba(255,255,255,0.40)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                borderRadius: "6px",
                                lineHeight: 0,
                              }}
                              aria-label="Delete variable"
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                                (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)";
                                (e.currentTarget as HTMLButtonElement).style.background = "none";
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <AddEnvVariableForm
        key={editingVar?.id ?? "new"}
        isOpen={isModalOpen || editingVar !== null}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVar(null);
        }}
        onAdd={editingVar ? (ui) => handleEditVariable({ ...ui, apiId: editingVar.apiId }) : handleAddVariable}
        editItem={editingVar ?? undefined}
        projectName={projectName}
      />
    </div>
  );
}

// ── Full Standalone Page ──────────────────────────────────────────────────────

export default function EnvironmentVariablesPage() {
  const [activeTab, setActiveTab] = useState<string>("Environment Variables");

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{
        background: "linear-gradient(180deg, #0D2238 0%, #06111F 100%)",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      <header
        className="sticky top-0 z-50 flex w-full items-center justify-between bg-[#071421] px-8 md:px-16"
        style={{ height: "100px", boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)" }}
      >
        <BrandLogo />
        <button
          type="button"
          aria-label="User profile"
          className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10"
          style={{
            width: "42px",
            height: "42px",
            background: "rgba(255,255,255,0.10)",
            border: "1.5px solid rgba(255,255,255,0.15)",
          }}
        >
          <User size={20} className="text-white" />
        </button>
      </header>

      <div className="px-8 md:px-16">
        <nav className="flex items-center gap-1 pt-8 pb-4" aria-label="Breadcrumb">
          <span className="text-sm text-gray-400" style={{ fontFamily: "Poppins, sans-serif" }}>
            Projects
          </span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            E-Commerce Platform
          </span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            Environment Variables
          </span>
        </nav>

        <div className="flex flex-wrap items-center gap-3 pb-6">
          <h1 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: "Poppins, sans-serif" }}>
            E-Commerce Platform
          </h1>
          <span
            className="rounded-full px-3 py-1 text-sm font-semibold text-white"
            style={{ background: "rgba(34,197,94,0.85)", fontFamily: "Poppins, sans-serif" }}
          >
            Active
          </span>
        </div>

        <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="flex items-end gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative flex-shrink-0 px-4 pb-3 pt-2 text-sm transition-all duration-200"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    color: isActive ? "#03A1FE" : "rgba(255,255,255,0.45)",
                    fontWeight: isActive ? 600 : 500,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderBottom: isActive ? "2px solid #03A1FE" : "2px solid transparent",
                    marginBottom: "-1px",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)";
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "Environment Variables" ? (
          <EnvironmentVariablesTabContent />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <Plus size={28} className="text-[#03A1FE]" style={{ transform: "rotate(45deg)" }} />
            </div>
            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.40)" }}>
              {activeTab} coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
