"use client";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  User,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import AddAdminCredentialForm from "./AddAdminCredentialForm";
import BrandLogo from "@/components/common/BrandLogo";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useAdminCredentials } from "@/hooks/useAdminCredentials";
import type { AdminCredential as ApiAdminCredential } from "@/hooks/useAdminCredentials";

// ── UI-layer type ─────────────────────────────────────────────────────────────

interface UiAdminCredential {
  id: number;
  apiId?: string;
  panelName: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  updatedBy: string;
  updatedById?: string;
  updatedAt: string;
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

const TABLE_COLS = ["Admin Panel", "Username", "Password", "Notes", "Updated By", "Updated At", "Actions"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapApiCred(c: ApiAdminCredential, index: number): UiAdminCredential {
  return {
    id: index,
    apiId: c.id,
    panelName: c.admin_panel_url,
    url: c.admin_panel_url,
    username: c.username,
    password: c.password,
    notes: c.notes,
    updatedBy: c.updated_by?.username ?? "—",
    updatedById: c.updated_by?.id,
    updatedAt: new Date(c.updated_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="h-4 w-full animate-pulse rounded-xl bg-white/5" />
        </td>
      ))}
    </tr>
  );
}

// ── Admin Credentials Table ───────────────────────────────────────────────────

interface AdminCredentialsTabContentProps {
  projectId?: number | string;
  projectName?: string;
  readOnly?: boolean;
}

export function AdminCredentialsTabContent({
  projectId,
  projectName = "E-Commerce Platform",
  readOnly = false,
}: AdminCredentialsTabContentProps) {
  const { user } = useAuth();
  const canDeleteRow = (row: UiAdminCredential): boolean => {
    if (readOnly) return false;
    if (isAdmin(user?.role)) return true;
    if (row.updatedById != null && row.updatedById === user?.id) return true;
    if (row.updatedBy !== "—" && user?.name != null && row.updatedBy === user.name) return true;
    return false;
  };
  const { query } = useSearch();
  const pid = projectId != null ? String(projectId) : "";

  const {
    data: apiCreds,
    loading,
    error,
    createAdminCredential,
    updateAdminCredential,
    deleteAdminCredential,
    revealAdminCredential,
  } = useAdminCredentials(pid);

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reset the "copied" indicator 1.5s after a copy, clearing the timer on
  // unmount / re-copy so it can't fire into an unmounted component.
  useEffect(() => {
    if (copiedId === null) return;
    const t = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedId]);
  const [editingCred, setEditingCred] = useState<UiAdminCredential | null>(null);

  const credentials: UiAdminCredential[] = apiCreds.map(mapApiCred);

  const filtered = credentials.filter((c) =>
    matchesQuery(query, c.panelName, c.url, c.username, c.notes, c.updatedBy)
  );

  const { currentPage, setCurrentPage, pageItems, totalItems, itemsPerPage } =
    usePagination(filtered, query);

  const handleDelete = async (apiId: string) => {
    try {
      await deleteAdminCredential(apiId);
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
      await revealAdminCredential(apiId);
      setRevealedIds((prev) => new Set(prev).add(apiId));
    } catch {
      // silently ignore
    }
  };

  const handleCopy = async (apiId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(apiId);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleAddCredential = async (ui: UiAdminCredential) => {
    try {
      await createAdminCredential({
        admin_panel_url: ui.url,
        username: ui.username,
        password: ui.password,
        notes: ui.notes,
      });
    } catch {
      // silently ignore
    }
  };

  const handleEditCredential = async (ui: UiAdminCredential) => {
    if (!ui.apiId) return;
    try {
      await updateAdminCredential(ui.apiId, {
        admin_panel_url: ui.url,
        username: ui.username,
        // Masked placeholder (a run of bullets) means the user didn't retype it — keep existing.
        password: /^•+$/.test(ui.password) ? undefined : ui.password,
        notes: ui.notes,
      } as Parameters<typeof updateAdminCredential>[1]);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="py-8">
      {/* Section Header Row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2
          className="text-2xl font-semibold text-white"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          Admin Credentials
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
            Add Admin Credential
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
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                {TABLE_COLS.map((col) => (
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
                    colSpan={7}
                    className="px-6 py-12 text-center"
                    style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.38)" }}
                  >
                    {query.trim() && credentials.length > 0
                      ? `No admin credentials match "${query.trim()}".`
                      : 'No admin credentials yet. Click "Add Admin Credential" to get started.'}
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((row, index) => {
                  const apiRow = apiCreds.find((c) => c.id === row.apiId);
                  const isRevealed = row.apiId ? revealedIds.has(row.apiId) : false;
                  const displayPwd = isRevealed ? (apiRow?.password ?? row.password) : "••••••••";
                  const isEven = index % 2 === 0;

                  return (
                    <tr
                      key={row.apiId ?? row.id}
                      className="transition-all duration-200 hover:bg-white/5"
                      style={{ background: isEven ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)" }}
                    >
                      {/* Admin Panel URL */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: "220px" }}>
                        <div className="flex flex-col gap-0.5">
                          <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.90)", fontWeight: 500, whiteSpace: "nowrap" }}>
                            Admin Panel
                          </span>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 transition-all duration-200 hover:opacity-80"
                            style={{
                              color: "#03A1FE",
                              fontFamily: "Poppins, sans-serif",
                              fontSize: "11px",
                              textDecoration: "none",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "200px",
                            }}
                            title={row.url}
                          >
                            <ExternalLink size={11} className="flex-shrink-0" />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.url}
                            </span>
                          </a>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <code style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: "12px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)", padding: "3px 9px", borderRadius: "6px", whiteSpace: "nowrap", border: "1px solid rgba(255,255,255,0.10)" }}>
                          {row.username}
                        </code>
                      </td>

                      {/* Password */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              fontFamily: isRevealed ? "'Courier New', Courier, monospace" : "Poppins, sans-serif",
                              fontSize: "13px",
                              color: isRevealed ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.35)",
                              maxWidth: "160px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                          >
                            {displayPwd}
                          </span>
                          <button
                            type="button"
                            onClick={() => row.apiId && handleReveal(row.apiId)}
                            className="transition-all duration-200"
                            style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                            aria-label={isRevealed ? "Hide password" : "Show password"}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          {isRevealed && (
                            <button
                              type="button"
                              onClick={() => row.apiId && handleCopy(row.apiId, displayPwd)}
                              style={{
                                color: copiedId === row.apiId ? "#4ade80" : "rgba(255,255,255,0.35)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "2px",
                                lineHeight: 0,
                              }}
                              aria-label={copiedId === row.apiId ? "Copied" : "Copy password"}
                            >
                              {copiedId === row.apiId ? <Check size={15} /> : <Copy size={15} />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: "240px" }}>
                        <span title={row.notes} style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.45)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px", cursor: "default" }}>
                          {row.notes || "—"}
                        </span>
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

                      {/* Updated At */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {row.updatedAt}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingCred(row)}
                            className="transition-all duration-200"
                            style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                            aria-label="Edit credential"
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#03A1FE"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            <Pencil size={15} />
                          </button>
                          {canDeleteRow(row) && (
                            <button
                              type="button"
                              onClick={() => row.apiId && handleDelete(row.apiId)}
                              className="transition-all duration-200"
                              style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                              aria-label="Delete credential"
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
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

      <AddAdminCredentialForm
        key={editingCred?.id ?? "new"}
        isOpen={isModalOpen || editingCred !== null}
        onClose={() => { setIsModalOpen(false); setEditingCred(null); }}
        onAdd={editingCred ? (ui) => handleEditCredential({ ...ui, apiId: editingCred.apiId }) : handleAddCredential}
        editItem={editingCred ?? undefined}
        projectName={projectName}
      />
    </div>
  );
}

// ── Full Standalone Page ──────────────────────────────────────────────────────

export default function AdminCredentialsPage() {
  const [activeTab, setActiveTab] = useState<string>("Admin Credentials");

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
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>Admin Credentials</span>
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

        {activeTab === "Admin Credentials" ? (
          <AdminCredentialsTabContent />
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
