"use client";
import { useState, useMemo } from "react";
import {
  ChevronRight,
  Plus,
  User,
  AlertCircle,
  Users,
  Trash2,
  X,
  Search,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useOrgMembers, type OrgMember } from "@/hooks/useOrgMembers";

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
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
];

const POPPINS = "Poppins, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "ADMIN" | "DEVELOPER" }) {
  const styles = {
    ADMIN: { bg: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.30)" },
    DEVELOPER: { bg: "rgba(87,200,231,0.15)", color: "#57C8E7", border: "1px solid rgba(87,200,231,0.30)" },
  };
  const s = styles[role];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: s.border, fontFamily: POPPINS, whiteSpace: "nowrap" }}
    >
      {role === "ADMIN" ? "Admin" : "Developer"}
    </span>
  );
}

function TeamTag({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "rgba(255,255,255,0.60)",
        fontFamily: POPPINS,
        whiteSpace: "nowrap",
      }}
    >
      <Users size={10} style={{ flexShrink: 0 }} />
      {name}
    </span>
  );
}

function InitialsAvatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontFamily: POPPINS, fontSize: size * 0.34 }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Add Team Member Modal ─────────────────────────────────────────────────────

interface AddTeamMemberModalProps {
  availableMembers: OrgMember[];
  onClose: () => void;
  onAdd: (userId: string, role: "ADMIN" | "DEVELOPER") => Promise<void>;
}

function AddTeamMemberModal({ availableMembers, onClose, onAdd }: AddTeamMemberModalProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const filtered = availableMembers.filter((m) =>
    matchesQuery(search, m.username, m.email, ...m.teams.map((t) => t.name))
  );

  const selected = availableMembers.find((m) => m.userId === selectedId) ?? null;

  const handleAdd = async () => {
    if (!selected) { setError("Please select a member to add."); return; }
    setAdding(true);
    setError("");
    try {
      // Role comes from the member's existing team role — no picker needed
      await onAdd(selected.userId, selected.role);
      onClose();
    } catch {
      setError("Failed to add member. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-[520px] flex-col rounded-2xl border"
        style={{ background: "#1a1a1a", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.70)", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b px-8 py-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <h3 className="text-xl font-bold text-white" style={{ fontFamily: POPPINS }}>Add Team Member</h3>
            <p className="mt-0.5 text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
              Select a member from your teams to add to this project.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10"
            style={{ width: 32, height: 32, color: "rgba(255,255,255,0.50)", background: "none", border: "none", cursor: "pointer", lineHeight: 0, flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or team…"
              className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontFamily: POPPINS }}
            />
          </div>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {availableMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <UserPlus size={32} style={{ color: "rgba(255,255,255,0.18)", marginBottom: 10 }} />
              <p className="text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.35)" }}>
                All team members are already in this project.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.35)" }}>
              No members match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            filtered.map((member, idx) => {
              const isSelected = selectedId === member.userId;
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => { setSelectedId(member.userId); setError(""); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150"
                  style={{
                    background: isSelected ? "rgba(87,200,231,0.10)" : "transparent",
                    border: isSelected ? "1px solid rgba(87,200,231,0.30)" : "1px solid transparent",
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <InitialsAvatar name={member.username} color={AVATAR_COLORS[idx % AVATAR_COLORS.length]} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white" style={{ fontFamily: POPPINS }}>{member.username}</p>
                    <p className="truncate text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>{member.email}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap gap-1.5 justify-end items-center">
                    {member.teams.map((t) => <TeamTag key={t.id} name={t.name} />)}
                    <RoleBadge role={member.role} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t px-8 py-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white"
              style={{ fontFamily: POPPINS, background: "transparent", border: "1px solid rgba(255,255,255,0.20)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !selected}
              className="flex-1 rounded-full py-2.5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
              style={{ fontFamily: POPPINS, background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)", border: "none", cursor: adding || !selected ? "not-allowed" : "pointer" }}
            >
              {adding ? "Adding…" : "Add to Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Merged row type ───────────────────────────────────────────────────────────

interface DisplayRow {
  key: string;
  username: string;
  email: string;
  role: "ADMIN" | "DEVELOPER";
  teams: { id: string; name: string }[];
  isAutoAdmin: boolean;
  memberId: string | null;
  userId: string;
}

// ── Team Tab Content ──────────────────────────────────────────────────────────

interface TeamTabContentProps {
  projectId?: number | string;
  projectName?: string;
  readOnly?: boolean;
}

export function TeamTabContent({ projectId, readOnly = false }: TeamTabContentProps = {}) {
  const { user } = useAuth();
  const { query } = useSearch();
  const canAdd = !readOnly;
  const canRemove = isAdmin(user?.role) && !readOnly;
  const pid = projectId != null ? String(projectId) : "";

  const { data: projectMembers, loading: pmLoading, error: pmError, addMember, removeMember } = useTeamMembers(pid);
  const { data: orgMembers, loading: orgLoading } = useOrgMembers();

  const [showModal, setShowModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // userId → org member (for team tags)
  const orgByUserId = useMemo(() => {
    const map = new Map<string, OrgMember>();
    orgMembers.forEach((m) => map.set(m.userId, m));
    return map;
  }, [orgMembers]);

  // userId set of explicitly added project members
  const projectUserIds = useMemo(
    () => new Set(projectMembers.map((m) => m.user.id)),
    [projectMembers]
  );

  // Org members with ADMIN role that are NOT already explicit project members
  const autoAdmins = useMemo(
    () => orgMembers.filter((m) => m.role === "ADMIN" && !projectUserIds.has(m.userId)),
    [orgMembers, projectUserIds]
  );

  // Non-admin org members not yet in project (available to add via modal)
  const availableToAdd = useMemo(
    () => orgMembers.filter((m) => m.role !== "ADMIN" && !projectUserIds.has(m.userId)),
    [orgMembers, projectUserIds]
  );

  // Build merged display list: explicit project members + auto-admins
  const allRows = useMemo<DisplayRow[]>(() => {
    const explicit: DisplayRow[] = projectMembers.map((m) => ({
      key: m.id,
      username: m.user.username,
      email: m.user.email,
      role: m.role,
      teams: orgByUserId.get(m.user.id)?.teams ?? [],
      isAutoAdmin: false,
      memberId: m.id,
      userId: m.user.id,
    }));

    const admins: DisplayRow[] = autoAdmins.map((m) => ({
      key: `auto-${m.userId}`,
      username: m.username,
      email: m.email,
      role: "ADMIN" as const,
      teams: m.teams,
      isAutoAdmin: true,
      memberId: null,
      userId: m.userId,
    }));

    return [...explicit, ...admins];
  }, [projectMembers, autoAdmins, orgByUserId]);

  const displayRows = allRows.filter((r) =>
    matchesQuery(query, r.username, r.email, r.role, ...r.teams.map((t) => t.name))
  );

  const { currentPage, setCurrentPage, pageItems, totalItems, itemsPerPage } =
    usePagination(displayRows, query);

  const loading = pmLoading || orgLoading;

  const handleAdd = async (userId: string, role: "ADMIN" | "DEVELOPER") => {
    await addMember(userId, role);
  };

  const handleRemove = async (memberId: string, userId: string) => {
    setRemovingId(memberId);
    try {
      await removeMember(userId);
    } finally {
      setRemovingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="py-8">
      {showModal && canAdd && (
        <AddTeamMemberModal
          availableMembers={availableToAdd}
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}

      {/* Section Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: POPPINS }}>
            Team Members
          </h2>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "rgba(87,200,231,0.15)", color: "#57C8E7", border: "1px solid rgba(87,200,231,0.25)", fontFamily: POPPINS }}
          >
            {allRows.length}
          </span>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{ borderRadius: "20px", background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", fontFamily: POPPINS, fontSize: "14px", border: "none", cursor: "pointer", padding: "12px 28px" }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Team Member
          </button>
        )}
      </div>

      {/* Error banner */}
      {pmError && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-300" style={{ fontFamily: POPPINS }}>{pmError}</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="w-full overflow-hidden rounded-2xl border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded-xl bg-white/5" />
                <div className="h-3 w-1/2 animate-pulse rounded-xl bg-white/5" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-white/5" />
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      {!loading && (
        <div
          className="w-full overflow-hidden rounded-2xl border"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
        >
          {displayRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                <User size={24} className="text-[#57C8E7]" />
              </div>
              <p style={{ fontFamily: POPPINS, fontSize: "14px", color: "rgba(255,255,255,0.38)" }}>
                {query.trim() && allRows.length > 0
                  ? `No members match "${query.trim()}".`
                  : 'No members yet. Click "Add Team Member" to get started.'}
              </p>
            </div>
          ) : (
            (pageItems as DisplayRow[]).map((row, index) => {
              const isConfirming = confirmId === row.key;
              const isRemoving = removingId === row.memberId;

              return (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-all duration-200 hover:bg-white/5"
                  style={{ borderBottom: index < pageItems.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                >
                  {/* Left: avatar + info */}
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <InitialsAvatar
                      name={row.username}
                      color={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                      size={42}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white" style={{ fontFamily: POPPINS }}>{row.username}</p>
                      <p className="truncate text-xs" style={{ color: "rgba(255,255,255,0.45)", fontFamily: POPPINS }}>{row.email}</p>
                    </div>
                  </div>

                  {/* Right: team tags + role badge + actions */}
                  <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                    {row.teams.map((t) => <TeamTag key={t.id} name={t.name} />)}
                    <RoleBadge role={row.role} />

                    {/* Auto-admins: lock icon, no remove */}
                    {row.isAutoAdmin && (
                      <span
                        title="Admins are automatically members of all projects"
                        style={{ color: "rgba(255,255,255,0.25)", lineHeight: 0, padding: "4px" }}
                      >
                        <ShieldCheck size={15} />
                      </span>
                    )}

                    {/* Explicit members: remove button (admin only) */}
                    {!row.isAutoAdmin && canRemove && (
                      isConfirming ? (
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRemove(row.memberId!, row.userId)}
                            disabled={isRemoving}
                            className="rounded px-2 py-0.5 text-xs font-semibold text-red-400 transition-all duration-150 hover:bg-red-500/15 disabled:opacity-50"
                            style={{ fontFamily: POPPINS, background: "none", border: "1px solid rgba(239,68,68,0.40)", cursor: isRemoving ? "not-allowed" : "pointer" }}
                          >
                            {isRemoving ? "…" : "Yes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded px-2 py-0.5 text-xs font-semibold transition-all duration-150 hover:bg-white/10"
                            style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)", background: "none", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(row.key)}
                          className="transition-all duration-200"
                          style={{ color: "rgba(255,255,255,0.32)", background: "none", border: "none", cursor: "pointer", padding: "4px", lineHeight: 0 }}
                          aria-label={`Remove ${row.username}`}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.32)"; }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

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

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<string>("Team");

  return (
    <div className="min-h-screen w-full text-white" style={{ background: "linear-gradient(180deg, #212121 0%, #000000 100%)", fontFamily: POPPINS }}>
      <header className="sticky top-0 z-50 flex w-full items-center justify-between bg-black px-8 md:px-16" style={{ height: "100px", boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)" }}>
        <span className="text-xl font-bold text-white" style={{ fontFamily: POPPINS }}>xis.ai</span>
        <button type="button" aria-label="User profile" className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10" style={{ width: "42px", height: "42px", background: "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.15)" }}>
          <User size={20} className="text-white" />
        </button>
      </header>

      <div className="px-8 md:px-16">
        <nav className="flex items-center gap-1 pt-8 pb-4" aria-label="Breadcrumb">
          <span className="text-sm text-gray-400" style={{ fontFamily: POPPINS }}>Projects</span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: POPPINS }}>E-Commerce Platform</span>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white" style={{ fontFamily: POPPINS }}>Team</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3 pb-6">
          <h1 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: POPPINS }}>E-Commerce Platform</h1>
          <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: "rgba(34,197,94,0.85)", fontFamily: POPPINS }}>Active</span>
        </div>

        <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="flex items-end gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className="relative flex-shrink-0 px-4 pb-3 pt-2 text-sm transition-all duration-200"
                  style={{ fontFamily: POPPINS, color: isActive ? "#57C8E7" : "rgba(255,255,255,0.45)", fontWeight: isActive ? 600 : 500, background: "transparent", border: "none", cursor: "pointer", borderBottom: isActive ? "2px solid #57C8E7" : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
                >{tab}</button>
              );
            })}
          </div>
        </div>

        {activeTab === "Team" ? (
          <TeamTabContent />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Plus size={28} className="text-[#57C8E7]" style={{ transform: "rotate(45deg)" }} />
            </div>
            <p style={{ fontFamily: POPPINS, fontSize: "15px", color: "rgba(255,255,255,0.40)" }}>{activeTab} coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
