"use client";
import { useState } from "react";
import {
  ChevronRight,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  User,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import AddAppUserForm from "./AddAppUserForm";
import BrandLogo from "@/components/common/BrandLogo";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useAppUsers } from "@/hooks/useAppUsers";
import type { AppUser as ApiAppUser } from "@/hooks/useAppUsers";

// ── UI-layer type ─────────────────────────────────────────────────────────────

type AppRole = "Superadmin" | "Admin" | "Superuser" | "Staff" | "Customer";

interface UiAppUser {
  id: number;
  apiId?: string;
  username: string;
  email: string;
  password: string;
  role: string;
  updatedBy: string;
  updatedById?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_MAP: Record<ApiAppUser["role_in_app"], AppRole> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  SUPERUSER: "Superuser",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

const ROLE_API: Record<AppRole, ApiAppUser["role_in_app"]> = {
  Superadmin: "SUPERADMIN",
  Admin: "ADMIN",
  Superuser: "SUPERUSER",
  Staff: "STAFF",
  Customer: "CUSTOMER",
};

function mapApiUser(u: ApiAppUser, index: number): UiAppUser {
  return {
    id: index,
    apiId: u.id,
    username: u.username,
    email: u.email,
    password: u.password_or_token,
    // Known role codes get a friendly label; anything else is shown verbatim.
    role: ROLE_MAP[u.role_in_app] ?? u.role_in_app,
    updatedBy: u.updated_by?.username ?? "—",
    updatedById: u.updated_by?.id,
  };
}

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

const TABLE_COLS = ["Username", "Email", "Password / Token", "Role in App", "Updated By", "Actions"];

const ROLE_STYLES: Record<AppRole, { bg: string; color: string; border: string }> = {
  Superadmin: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.30)" },
  Admin: { bg: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.30)" },
  Superuser: { bg: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.30)" },
  Staff: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.30)" },
  Customer: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.60)", border: "1px solid rgba(255,255,255,0.14)" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const DEFAULT_ROLE_STYLE = { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.60)", border: "1px solid rgba(255,255,255,0.14)" };

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLES[role as AppRole] ?? DEFAULT_ROLE_STYLE;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: s.border, fontFamily: "Poppins, sans-serif", whiteSpace: "nowrap" }}
    >
      {role}
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

// ── App Users Table ───────────────────────────────────────────────────────────

interface AppUsersTabContentProps {
  projectId?: number | string;
  projectName?: string;
  readOnly?: boolean;
}

export function AppUsersTabContent({
  projectId,
  projectName = "E-Commerce Platform",
  readOnly = false,
}: AppUsersTabContentProps) {
  const { user: currentUser } = useAuth();
  const canDeleteRow = (row: UiAppUser): boolean => {
    if (readOnly) return false;
    if (isAdmin(currentUser?.role)) return true;
    if (row.updatedById != null && row.updatedById === currentUser?.id) return true;
    if (row.updatedBy !== "—" && currentUser?.name != null && row.updatedBy === currentUser.name) return true;
    return false;
  };
  const { query } = useSearch();
  const pid = projectId != null ? String(projectId) : "";

  const {
    data: apiUsers,
    loading,
    error,
    createAppUser,
    updateAppUser,
    deleteAppUser,
    revealAppUser,
  } = useAppUsers(pid);

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UiAppUser | null>(null);

  const users: UiAppUser[] = apiUsers.map(mapApiUser);

  const filtered = users.filter((u) =>
    matchesQuery(query, u.username, u.email, u.role, u.updatedBy)
  );

  const { currentPage, setCurrentPage, pageItems, totalItems, itemsPerPage } =
    usePagination(filtered, query);

  const handleDelete = async (apiId: string) => {
    try {
      await deleteAppUser(apiId);
    } catch {
      // silently ignore
    }
  };

  const handleReveal = async (apiId: string) => {
    if (revealedIds.has(apiId)) {
      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.delete(apiId);
        return next;
      });
      return;
    }
    try {
      await revealAppUser(apiId);
      setRevealedIds((prev) => new Set(prev).add(apiId));
    } catch {
      // silently ignore
    }
  };

  const handleCopy = async (apiId: string, value: string) => {
    const fallbackCopy = (text: string): boolean => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    };

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch {
        copied = fallbackCopy(value);
      }
    } else {
      copied = fallbackCopy(value);
    }

    if (copied) {
      setCopiedId(apiId);
      setTimeout(() => setCopiedId((curr) => (curr === apiId ? null : curr)), 1500);
    }
  };

  const handleAddUser = async (ui: UiAppUser) => {
    try {
      await createAppUser({
        username: ui.username,
        email: ui.email,
        password_or_token: ui.password,
        role_in_app: ROLE_API[ui.role as AppRole] ?? ui.role,
      });
    } catch {
      // silently ignore
    }
  };

  const handleEditUser = async (ui: UiAppUser) => {
    if (!ui.apiId) return;
    try {
      await updateAppUser(ui.apiId, {
        username: ui.username,
        email: ui.email,
        // Masked placeholder (a run of bullets) means the user didn't retype it — keep existing.
        password_or_token: /^•+$/.test(ui.password) ? undefined : ui.password,
        role_in_app: ROLE_API[ui.role as AppRole] ?? ui.role,
      } as Parameters<typeof updateAppUser>[1]);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="py-8">
      {/* Section Header Row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
          App Users
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
            Add App User
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-300" style={{ fontFamily: "Poppins, sans-serif" }}>{error}</p>
        </div>
      )}

      {/* Table Card */}
      <div
        className="w-full overflow-hidden rounded-2xl border"
        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                {TABLE_COLS.map((col) => (
                  <th key={col} className="px-6 py-4 text-left text-xs font-bold uppercase"
                    style={{ fontFamily: "Poppins, sans-serif", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (<><SkeletonRow /><SkeletonRow /><SkeletonRow /></>)}

              {!loading && totalItems === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center"
                    style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.38)" }}>
                    {query.trim() && users.length > 0
                      ? `No app users match "${query.trim()}".`
                      : 'No app users yet. Click "Add App User" to get started.'}
                  </td>
                </tr>
              )}

              {!loading && pageItems.map((row, index) => {
                const apiRow = apiUsers.find((u) => u.id === row.apiId);
                const isRevealed = row.apiId ? revealedIds.has(row.apiId) : false;
                const displayToken = isRevealed ? (apiRow?.password_or_token ?? row.password) : "••••••••••••";
                const isEven = index % 2 === 0;

                return (
                  <tr key={row.apiId ?? row.id} className="transition-all duration-200 hover:bg-white/5"
                    style={{ background: isEven ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)" }}>
                    {/* Username */}
                    <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #03A1FE 0%, #006AB3 100%)" }}>
                          <User size={14} className="text-white" />
                        </div>
                        <code style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: "12px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.90)", padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.10)", whiteSpace: "nowrap" }}>
                          {row.username}
                        </code>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
                        {row.email}
                      </span>
                    </td>

                    {/* Password / Token */}
                    <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: isRevealed ? "'Courier New', Courier, monospace" : "Poppins, sans-serif", fontSize: "13px", color: isRevealed ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.35)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {displayToken}
                        </span>
                        <button type="button" onClick={() => row.apiId && handleReveal(row.apiId)}
                          className="transition-all duration-200"
                          style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                          aria-label={isRevealed ? "Hide password" : "Show password"}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        {isRevealed && (
                          <button type="button" onClick={() => row.apiId && handleCopy(row.apiId, displayToken)}
                            style={{ color: copiedId === row.apiId ? "#4ade80" : "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: "2px", lineHeight: 0 }}
                            aria-label={copiedId === row.apiId ? "Copied" : "Copy password"}>
                            {copiedId === row.apiId ? <Check size={15} /> : <Copy size={15} />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Role in App */}
                    <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <RoleBadge role={row.role} />
                    </td>

                    {/* Updated By */}
                    <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #03A1FE 0%, #006AB3 100%)" }}>
                          <User size={13} className="text-white" />
                        </div>
                        <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap" }}>
                          {row.updatedBy}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setEditingUser(row)}
                          className="transition-all duration-200"
                          style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                          aria-label="Edit user"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
                          <Pencil size={15} />
                        </button>
                        {canDeleteRow(row) && (
                          <button type="button" onClick={() => row.apiId && handleDelete(row.apiId)}
                            className="transition-all duration-200"
                            style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                            aria-label="Delete user"
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
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

      <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />

      <AddAppUserForm
        isOpen={isModalOpen || editingUser !== null}
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
        onAdd={editingUser ? (ui) => handleEditUser({ ...ui, apiId: editingUser.apiId }) : handleAddUser}
        editItem={editingUser ?? undefined}
        projectName={projectName}
      />
    </div>
  );
}

// ── Full Standalone Page ──────────────────────────────────────────────────────

export default function AppUsersPage() {
  const [activeTab, setActiveTab] = useState<string>("App Users");

  return (
    <div className="min-h-screen w-full text-white" style={{ background: "linear-gradient(180deg, #0D2238 0%, #06111F 100%)", fontFamily: "Poppins, sans-serif" }}>
      <header className="sticky top-0 z-50 flex w-full items-center justify-between bg-[#071421] px-8 md:px-16" style={{ height: "100px", boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)" }}>
        <BrandLogo />
        <button type="button" aria-label="User profile" className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10" style={{ width: "42px", height: "42px", background: "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.15)" }}>
          <User size={20} className="text-white" />
        </button>
      </header>

      <div className="px-8 md:px-16">
        <nav className="flex items-center gap-1 pt-8 pb-4" aria-label="Breadcrumb">
          <span className="text-sm text-gray-400" style={{ fontFamily: "Poppins, sans-serif" }}>Projects</span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>E-Commerce Platform</span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>App Users</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3 pb-6">
          <h1 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: "Poppins, sans-serif" }}>E-Commerce Platform</h1>
          <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: "rgba(34,197,94,0.85)", fontFamily: "Poppins, sans-serif" }}>Active</span>
        </div>

        <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="flex items-end gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className="relative flex-shrink-0 px-4 pb-3 pt-2 text-sm transition-all duration-200"
                  style={{ fontFamily: "Poppins, sans-serif", color: isActive ? "#03A1FE" : "rgba(255,255,255,0.45)", fontWeight: isActive ? 600 : 500, background: "transparent", border: "none", cursor: "pointer", borderBottom: isActive ? "2px solid #03A1FE" : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
                >{tab}</button>
              );
            })}
          </div>
        </div>

        {activeTab === "App Users" ? (
          <AppUsersTabContent />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Plus size={28} className="text-[#03A1FE]" style={{ transform: "rotate(45deg)" }} />
            </div>
            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.40)" }}>{activeTab} coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
