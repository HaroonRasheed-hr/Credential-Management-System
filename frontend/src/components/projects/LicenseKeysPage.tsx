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
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import AddLicenseKeyForm from "./AddLicenseKeyForm";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useLicenseKeys } from "@/hooks/useLicenseKeys";
import type { LicenseKey as ApiLicenseKey } from "@/hooks/useLicenseKeys";

// ── UI-layer type ─────────────────────────────────────────────────────────────

interface UiLicenseKey {
  id: number;
  apiId?: string;
  name: string;
  vendor: string;
  key: string;
  expiryDate: Date;
  updatedBy: string;
  updatedById?: string;
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

const today = new Date();

// ── Helpers ───────────────────────────────────────────────────────────────────

type ExpiryStatus = "expired" | "near" | "normal";

function getExpiryStatus(date: Date): ExpiryStatus {
  const diffMs = date.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "near";
  return "normal";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapApiLicense(l: ApiLicenseKey, index: number): UiLicenseKey {
  return {
    id: index,
    apiId: l.id,
    name: l.license_name,
    vendor: l.vendor,
    key: l.license_key,
    expiryDate: l.expiry_date ? new Date(l.expiry_date) : new Date(Date.now() + 365 * 24 * 3600 * 1000),
    updatedBy: l.updated_by?.username ?? "—",
    updatedById: l.updated_by?.id,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExpiryCell({ date }: { date: Date }) {
  const status = getExpiryStatus(date);
  const label = formatDate(date);

  if (status === "normal") {
    return (
      <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
        {label}
      </span>
    );
  }

  if (status === "near") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{
          background: "rgba(251,146,60,0.12)",
          border: "1px solid rgba(251,146,60,0.25)",
          color: "#fb923c",
          fontFamily: "Poppins, sans-serif",
          fontSize: "12px",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        <AlertTriangle size={12} strokeWidth={2.5} />
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
      style={{
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#f87171",
        fontFamily: "Poppins, sans-serif",
        fontSize: "12px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <AlertCircle size={12} strokeWidth={2.5} />
      {label}
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

// ── License Keys Table ────────────────────────────────────────────────────────

interface LicenseKeysTabContentProps {
  projectId?: number | string;
  projectName?: string;
  readOnly?: boolean;
}

export function LicenseKeysTabContent({
  projectId,
  projectName = "E-Commerce Platform",
  readOnly = false,
}: LicenseKeysTabContentProps) {
  const { user } = useAuth();
  const canDeleteRow = (row: UiLicenseKey): boolean => {
    if (readOnly) return false;
    if (isAdmin(user?.role)) return true;
    if (row.updatedById != null && row.updatedById === user?.id) return true;
    if (row.updatedBy !== "—" && user?.name != null && row.updatedBy === user.name) return true;
    return false;
  };
  const { query } = useSearch();
  const pid = projectId != null ? String(projectId) : "";

  const {
    data: apiKeys,
    loading,
    error,
    createLicenseKey,
    updateLicenseKey,
    deleteLicenseKey,
    revealLicenseKey,
  } = useLicenseKeys(pid);

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<UiLicenseKey | null>(null);

  const licenses: UiLicenseKey[] = apiKeys.map(mapApiLicense);

  const filtered = licenses.filter((l) =>
    matchesQuery(query, l.name, l.vendor, l.updatedBy)
  );

  const { currentPage, setCurrentPage, pageItems, totalItems, itemsPerPage } =
    usePagination(filtered, query);

  const handleDeleteLicense = async (apiId: string) => {
    try {
      await deleteLicenseKey(apiId);
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
      await revealLicenseKey(apiId);
      setRevealedIds((prev) => new Set(prev).add(apiId));
    } catch {
      // silently ignore
    }
  };

  const handleCopy = async (apiId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(apiId);
      setTimeout(() => setCopiedId((curr) => (curr === apiId ? null : curr)), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleAddLicense = async (ui: UiLicenseKey) => {
    try {
      await createLicenseKey({
        license_name: ui.name,
        license_key: ui.key,
        vendor: ui.vendor,
        expiry_date: ui.expiryDate ? ui.expiryDate.toISOString().split("T")[0] : null,
      });
    } catch {
      // silently ignore
    }
  };

  const handleEditLicense = async (ui: UiLicenseKey) => {
    if (!ui.apiId) return;
    try {
      await updateLicenseKey(ui.apiId, {
        license_name: ui.name,
        // Masked placeholder (a run of bullets) means the user didn't retype it — keep existing.
        license_key: /^•+$/.test(ui.key) ? undefined : ui.key,
        vendor: ui.vendor,
        expiry_date: ui.expiryDate ? ui.expiryDate.toISOString().split("T")[0] : null,
      } as Parameters<typeof updateLicenseKey>[1]);
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
          License Keys
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{
              borderRadius: "20px",
              background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)",
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
            Add License Key
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
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                {["License Name", "Vendor", "License Key", "Expiry Date", "Updated By", "Actions"].map((col) => (
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
                    colSpan={6}
                    className="px-6 py-12 text-center"
                    style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.38)" }}
                  >
                    {query.trim() && licenses.length > 0
                      ? `No license keys match "${query.trim()}".`
                      : 'No license keys yet. Click "Add License Key" to get started.'}
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((row, index) => {
                  const apiRow = apiKeys.find((k) => k.id === row.apiId);
                  const isRevealed = row.apiId ? revealedIds.has(row.apiId) : false;
                  const displayKey = isRevealed ? (apiRow?.license_key ?? row.key) : "••••••••••••";
                  const isEven = index % 2 === 0;

                  return (
                    <tr
                      key={row.apiId ?? row.id}
                      className="transition-all duration-200 hover:bg-white/5"
                      style={{ background: isEven ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)" }}
                    >
                      {/* License Name */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.92)", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {row.name}
                        </span>
                      </td>

                      {/* Vendor */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.50)", whiteSpace: "nowrap" }}>
                          {row.vendor}
                        </span>
                      </td>

                      {/* License Key */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              fontFamily: isRevealed ? "'Courier New', Courier, monospace" : "Poppins, sans-serif",
                              fontSize: "13px",
                              color: isRevealed ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.35)",
                              maxWidth: "220px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                          >
                            {displayKey}
                          </span>
                          <button
                            type="button"
                            onClick={() => row.apiId && handleReveal(row.apiId)}
                            className="flex-shrink-0 transition-all duration-200"
                            style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                            aria-label={isRevealed ? "Hide key" : "Show key"}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#57C8E7"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          {isRevealed && (
                            <button
                              type="button"
                              onClick={() => row.apiId && handleCopy(row.apiId, displayKey)}
                              className="flex-shrink-0 transition-all duration-200 hover:text-[#57C8E7]"
                              style={{
                                color: copiedId === row.apiId ? "#4ade80" : "rgba(255,255,255,0.35)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "2px",
                                lineHeight: 0,
                              }}
                              aria-label={copiedId === row.apiId ? "Copied" : "Copy key"}
                            >
                              {copiedId === row.apiId ? <Check size={15} /> : <Copy size={15} />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <ExpiryCell date={row.expiryDate} />
                      </td>

                      {/* Updated By */}
                      <td className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                            style={{ background: "linear-gradient(135deg, #57C8E7 0%, #3E5FAA 100%)" }}
                          >
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
                          <button
                            type="button"
                            onClick={() => setEditingLicense(row)}
                            className="transition-all duration-200"
                            style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                            aria-label="Edit license"
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#57C8E7"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.40)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            <Pencil size={15} />
                          </button>
                          {canDeleteRow(row) && (
                            <button
                              type="button"
                              onClick={() => row.apiId && handleDeleteLicense(row.apiId)}
                              className="transition-all duration-200"
                              style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", lineHeight: 0 }}
                              aria-label="Delete license"
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

      <AddLicenseKeyForm
        isOpen={isModalOpen || editingLicense !== null}
        onClose={() => { setIsModalOpen(false); setEditingLicense(null); }}
        onAdd={editingLicense ? (ui) => handleEditLicense({ ...ui, apiId: editingLicense.apiId }) : handleAddLicense}
        editItem={editingLicense ?? undefined}
        projectName={projectName}
      />
    </div>
  );
}

// ── Full Standalone Page ──────────────────────────────────────────────────────

export default function LicenseKeysPage() {
  const [activeTab, setActiveTab] = useState<string>("License Keys");

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ background: "linear-gradient(180deg, #212121 0%, #000000 100%)", fontFamily: "Poppins, sans-serif" }}
    >
      <header
        className="sticky top-0 z-50 flex w-full items-center justify-between bg-black px-8 md:px-16"
        style={{ height: "100px", boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)" }}
      >
        <span className="text-xl font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>xis.ai</span>
        <button
          type="button"
          aria-label="User profile"
          className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10"
          style={{ width: "42px", height: "42px", background: "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.15)" }}
        >
          <User size={20} className="text-white" />
        </button>
      </header>

      <div className="px-8 md:px-16">
        <nav className="flex items-center gap-1 pt-8 pb-4" aria-label="Breadcrumb">
          <span className="text-sm text-gray-400" style={{ fontFamily: "Poppins, sans-serif" }}>Projects</span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>E-Commerce Platform</span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>License Keys</span>
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
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative flex-shrink-0 px-4 pb-3 pt-2 text-sm transition-all duration-200"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    color: isActive ? "#57C8E7" : "rgba(255,255,255,0.45)",
                    fontWeight: isActive ? 600 : 500,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderBottom: isActive ? "2px solid #57C8E7" : "2px solid transparent",
                    marginBottom: "-1px",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "License Keys" ? (
          <LicenseKeysTabContent />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Plus size={28} className="text-[#57C8E7]" style={{ transform: "rotate(45deg)" }} />
            </div>
            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.40)" }}>{activeTab} coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
