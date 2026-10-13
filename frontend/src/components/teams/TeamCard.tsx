"use client";

import { useState } from "react";
import { Brain, Code2, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ApiTeam, TeamType } from "@/hooks/useTeams";

const POPPINS = "Poppins, sans-serif";

const TYPE_PRESET: Record<TeamType, { bg: string; icon: "brain" | "code" | "shield" }> = {
  AI_RESEARCH: { bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", icon: "brain" },
  ENGINEERING: { bg: "linear-gradient(135deg, #57C8E7 0%, #3E5FAA 100%)", icon: "code" },
  ADMIN:       { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", icon: "shield" },
};

function TeamIcon({ teamType }: { teamType: TeamType }) {
  const { bg, icon } = TYPE_PRESET[teamType] ?? TYPE_PRESET.AI_RESEARCH;
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: 48, height: 48, background: bg }}
    >
      {icon === "brain"  && <Brain       size={24} className="text-white" />}
      {icon === "code"   && <Code2       size={24} className="text-white" />}
      {icon === "shield" && <ShieldCheck size={24} className="text-white" />}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: ApiTeam;
  index?: number;
  canManage: boolean;
  onEdit: (team: ApiTeam) => void;
  onDelete: (team: ApiTeam) => Promise<void>;
}

export default function TeamCard({
  team,
  canManage,
  onEdit,
  onDelete,
}: TeamCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDelete(team);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/dashboard/teams/${team.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          router.push(`/dashboard/teams/${team.id}`);
      }}
      className="group relative flex w-full cursor-pointer flex-col items-start gap-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: "16px",
        boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: "24px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#57C8E7";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.10)";
      }}
    >
      {/* ── Admin action buttons (top-right) ──────────────────────────── */}
      {canManage && (
        <div
          className="absolute right-4 top-4 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {confirmDelete ? (
            /* Inline delete confirmation */
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-400 transition-all duration-150 hover:bg-red-500/15 disabled:opacity-50"
                style={{
                  fontFamily: POPPINS,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                {deleting ? "…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 hover:bg-white/10"
                style={{
                  fontFamily: POPPINS,
                  color: "rgba(255,255,255,0.45)",
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </span>
          ) : (
            /* Normal edit/delete icons */
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(team);
                }}
                aria-label={`Edit ${team.name}`}
                className="flex items-center justify-center rounded-lg transition-all duration-200"
                style={{
                  width: 30,
                  height: 30,
                  color: "rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#57C8E7";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#57C8E7";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(87,200,231,0.10)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "rgba(255,255,255,0.35)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(255,255,255,0.10)";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.06)";
                }}
              >
                <Pencil size={13} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                aria-label={`Delete ${team.name}`}
                className="flex items-center justify-center rounded-lg transition-all duration-200"
                style={{
                  width: 30,
                  height: 30,
                  color: "rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(239,68,68,0.50)";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(239,68,68,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "rgba(255,255,255,0.35)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(255,255,255,0.10)";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.06)";
                }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4" style={{ paddingRight: canManage ? 80 : 0 }}>
        <TeamIcon teamType={team.team_type ?? "AI_RESEARCH"} />
        <div>
          <h3
            className="text-lg font-bold text-white"
            style={{ fontFamily: POPPINS }}
          >
            {team.name}
          </h3>
          <p
            className="text-xs"
            style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}
          >
            {team.member_count} {team.member_count === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      {team.description && (
        <p
          className="line-clamp-2 text-sm"
          style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.40)" }}
        >
          {team.description}
        </p>
      )}
    </div>
  );
}
