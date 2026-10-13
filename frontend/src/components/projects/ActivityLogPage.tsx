"use client";
import { useState } from "react";
import { ChevronRight, User, AlertCircle } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { useActivityLog } from "@/hooks/useActivityLog";
import type { ActivityLogEntry } from "@/hooks/useActivityLog";
import { useSearch, matchesQuery } from "@/context/SearchContext";

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

const AVATAR_COLORS = [
  "linear-gradient(135deg, #57C8E7 0%, #3E5FAA 100%)",
  "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgoStr(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

type ModuleKey = string;

const MODULE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  Project: { bg: "rgba(87,200,231,0.14)", color: "#57C8E7", border: "1px solid rgba(87,200,231,0.28)" },
  "Env Variables": { bg: "rgba(59,130,246,0.14)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.28)" },
  "License Keys": { bg: "rgba(251,146,60,0.14)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.28)" },
  "Admin Credentials": { bg: "rgba(168,85,247,0.14)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.28)" },
  "App Users": { bg: "rgba(20,184,166,0.14)", color: "#2dd4bf", border: "1px solid rgba(20,184,166,0.28)" },
  Team: { bg: "rgba(236,72,153,0.14)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.28)" },
  _default: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.14)" },
};

function ModuleBadge({ module }: { module: ModuleKey }) {
  const s = MODULE_STYLES[module] ?? MODULE_STYLES._default;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: s.border, fontFamily: "Poppins, sans-serif", whiteSpace: "nowrap" }}
    >
      {module}
    </span>
  );
}

function ActionBadge({ action }: { action: ActivityLogEntry["action"] }) {
  const styles: Record<ActivityLogEntry["action"], { bg: string; color: string }> = {
    CREATED: { bg: "rgba(34,197,94,0.12)", color: "#4ade80" },
    ADDED: { bg: "rgba(34,197,94,0.12)", color: "#4ade80" },
    UPDATED: { bg: "rgba(87,200,231,0.12)", color: "#57C8E7" },
    DELETED: { bg: "rgba(239,68,68,0.12)", color: "#f87171" },
    REVEALED: { bg: "rgba(251,146,60,0.12)", color: "#fb923c" },
  };
  const s = styles[action];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.color, fontFamily: "Poppins, sans-serif", whiteSpace: "nowrap" }}
    >
      {action}
    </span>
  );
}

// ── Activity Log Feed ─────────────────────────────────────────────────────────

interface ActivityLogTabContentProps {
  projectId?: number | string;
}

export function ActivityLogTabContent({ projectId }: ActivityLogTabContentProps = {}) {
  const { query } = useSearch();
  const pid = projectId != null ? String(projectId) : "";
  const { data: entries, loading, error } = useActivityLog(pid);

  const filtered = entries.filter((e) =>
    matchesQuery(query, e.description, e.user?.username ?? "", e.module_name, e.action)
  );

  const { currentPage, setCurrentPage, pageItems, totalItems, itemsPerPage } =
    usePagination(filtered, query);

  return (
    <div className="py-8">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
          Activity Log
        </h2>
        <p className="mt-1 text-sm" style={{ fontFamily: "Poppins, sans-serif", color: "rgba(255,255,255,0.42)" }}>
          A complete record of all changes made to this project.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-300" style={{ fontFamily: "Poppins, sans-serif" }}>{error}</p>
        </div>
      )}

      {/* Timeline Card */}
      <div
        className="w-full rounded-2xl border px-6 py-6"
        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
      >
        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-white/5 flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-2/3 animate-pulse rounded-xl bg-white/5" />
                  <div className="h-3 w-1/3 animate-pulse rounded-xl bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }}>
              <User size={22} className="text-[#57C8E7]" />
            </div>
            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.38)" }}>
              {query.trim() && entries.length > 0
                ? `No activity matches "${query.trim()}".`
                : "No activity yet. Changes to this project will appear here."}
            </p>
          </div>
        )}

        {!loading && pageItems.length > 0 && (
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[19px] top-0 h-full w-px" style={{ background: "rgba(255,255,255,0.08)" }} aria-hidden="true" />

            <div className="flex flex-col gap-1">
              {pageItems.map((entry, index) => (
                <div
                  key={entry.id}
                  className="group relative flex items-start gap-4 rounded-xl px-3 py-4 transition-all duration-200 hover:bg-white/5"
                >
                  {/* Avatar */}
                  <div
                    className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                  >
                    <User size={16} className="text-white" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-1.5">
                    <p className="text-sm leading-relaxed" style={{ fontFamily: "Poppins, sans-serif", color: "rgba(255,255,255,0.72)" }}>
                      <span className="font-semibold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
                        {entry.user?.username ?? "System"}
                      </span>{" "}
                      {entry.description}
                    </p>

                    {/* Meta row */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ModuleBadge module={entry.module_name} />
                      <ActionBadge action={entry.action} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Poppins, sans-serif" }}>
                        {timeAgoStr(entry.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Row separator */}
                  {index < pageItems.length - 1 && (
                    <div
                      className="absolute bottom-0 left-[52px] right-3"
                      style={{ height: "1px", background: "rgba(255,255,255,0.05)" }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

// ── Full Standalone Page ──────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const [activeTab, setActiveTab] = useState<string>("Activity Log");

  return (
    <div className="min-h-screen w-full text-white" style={{ background: "linear-gradient(180deg, #212121 0%, #000000 100%)", fontFamily: "Poppins, sans-serif" }}>
      <header className="sticky top-0 z-50 flex w-full items-center justify-between bg-black px-8 md:px-16" style={{ height: "100px", boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)" }}>
        <span className="text-xl font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>xis.ai</span>
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
          <span className="text-sm font-medium text-white" style={{ fontFamily: "Poppins, sans-serif" }}>Activity Log</span>
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
                  style={{ fontFamily: "Poppins, sans-serif", color: isActive ? "#57C8E7" : "rgba(255,255,255,0.45)", fontWeight: isActive ? 600 : 500, background: "transparent", border: "none", cursor: "pointer", borderBottom: isActive ? "2px solid #57C8E7" : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
                >{tab}</button>
              );
            })}
          </div>
        </div>

        {activeTab === "Activity Log" ? (
          <ActivityLogTabContent />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.40)" }}>
              {activeTab} coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
