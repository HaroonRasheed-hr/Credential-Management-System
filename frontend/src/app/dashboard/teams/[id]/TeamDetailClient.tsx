"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Code2,
  ShieldCheck,
  Plus,
  AlertCircle,
  CheckCircle,
  ShieldOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useTeamDetail, type NewMemberInput, type UpdateMemberInput } from "@/hooks/useTeamDetail";
import MembersTable from "@/components/teams/MembersTable";
import AddMemberModal from "@/components/teams/AddMemberModal";

const POPPINS = "Poppins, sans-serif";

const TYPE_PRESET = {
  AI_RESEARCH: { icon: "brain"  as const, bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)" },
  ENGINEERING:  { icon: "code"   as const, bg: "linear-gradient(135deg, #57C8E7 0%, #3E5FAA 100%)" },
  ADMIN:        { icon: "shield" as const, bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" },
};

function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, showToast: setToast };
}

function SkeletonTable() {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-2xl border"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b px-6 py-4"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div
            className="h-9 w-9 flex-shrink-0 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-3 w-40 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TeamDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const [teamId, setTeamId] = useState("");

  useEffect(() => {
    // useParams() returns the static-export placeholder "_" in Next.js static exports;
    // window.location.pathname always reflects the real browser URL.
    const parts = window.location.pathname.replace(/\/$/, "").split("/");
    setTeamId(parts[parts.length - 1] ?? "");
  }, [pathname]);

  const { data: team, loading, error, createAndAddMember, updateMember, removeMember, revealPassword } =
    useTeamDetail(teamId);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const { toast, showToast } = useToast();
  const { query } = useSearch();

  const filteredMembers = (team?.members ?? []).filter((m) =>
    matchesQuery(query, m.user.username, m.user.email)
  );

  const is403 =
    error?.includes("403") || error?.toLowerCase().includes("forbidden");

  const preset = team
    ? (TYPE_PRESET[team.team_type as keyof typeof TYPE_PRESET] ?? TYPE_PRESET.AI_RESEARCH)
    : TYPE_PRESET.AI_RESEARCH;

  const handleAddMember = async (input: NewMemberInput) => {
    await createAndAddMember(input);
    showToast({ message: "Member added successfully.", type: "success" });
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember(memberId);
      showToast({ message: "Member removed.", type: "success" });
    } catch {
      showToast({ message: "Failed to remove member.", type: "error" });
      throw new Error("remove failed");
    }
  };

  const handleUpdateRole = async (memberId: string, input: UpdateMemberInput) => {
    try {
      await updateMember(memberId, input);
      showToast({ message: "Member updated.", type: "success" });
    } catch {
      showToast({ message: "Failed to update member.", type: "error" });
      throw new Error("update failed");
    }
  };

  return (
    <>
      {addMemberOpen && canManage && team && (
        <AddMemberModal
          teamName={team.name}
          teamType={team.team_type}
          onClose={() => setAddMemberOpen(false)}
          onSubmit={handleAddMember}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed right-5 top-5 z-[100]">
          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{
              background: "#1a1a1a",
              borderColor:
                toast.type === "success"
                  ? "rgba(16,185,129,0.40)"
                  : "rgba(239,68,68,0.40)",
              boxShadow: "0px 12px 40px 0px rgba(0,0,0,0.55)",
              animation: "pcmp-toast-in 220ms ease-out",
              fontFamily: POPPINS,
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle size={16} style={{ color: "#10b981", flexShrink: 0 }} />
            ) : (
              <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
            )}
            <span className="text-sm text-white">{toast.message}</span>
          </div>
        </div>
      )}

      <style>{`@keyframes pcmp-toast-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      <div className="px-4 py-6 sm:px-8 md:px-12 md:py-8 lg:px-16">
        <button
          type="button"
          onClick={() => router.push("/dashboard/teams")}
          className="mb-6 flex items-center gap-2 text-sm transition-all duration-200"
          style={{
            fontFamily: POPPINS,
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
          Back to Teams
        </button>

        {is403 && (
          <div className="flex flex-col items-center justify-center py-24">
            <ShieldOff size={48} style={{ color: "rgba(255,255,255,0.15)", marginBottom: 16 }} />
            <p className="text-base font-semibold" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.40)" }}>
              Access Restricted
            </p>
            <p className="mt-1 text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.25)" }}>
              You don&apos;t have permission to view this team.
            </p>
          </div>
        )}

        {error && !is403 && !loading && (
          <div
            className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span className="text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.70)" }}>
              {error}
            </span>
          </div>
        )}

        {loading && (
          <>
            <div className="mb-8 flex animate-pulse items-center gap-4">
              <div className="h-12 w-12 flex-shrink-0 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="space-y-2">
                <div className="h-5 w-40 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="h-3 w-20 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            </div>
            <SkeletonTable />
          </>
        )}

        {!loading && !error && team && (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex flex-shrink-0 items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, background: preset.bg }}
                >
                  {preset.icon === "brain"  && <Brain       size={24} className="text-white" />}
                  {preset.icon === "code"   && <Code2       size={24} className="text-white" />}
                  {preset.icon === "shield" && <ShieldCheck size={24} className="text-white" />}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white md:text-3xl" style={{ fontFamily: POPPINS }}>
                    {team.name}
                  </h1>
                  <p className="text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
                    {team.member_count}{" "}{team.member_count === 1 ? "member" : "members"}
                  </p>
                </div>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(true)}
                  className="flex w-full items-center justify-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95 sm:w-auto"
                  style={{
                    borderRadius: "20px",
                    background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)",
                    boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.55)",
                    fontFamily: POPPINS,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                    padding: "12px 28px",
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add Member
                </button>
              )}
            </div>

            {team.description && (
              <p className="mb-6 text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
                {team.description}
              </p>
            )}

            <MembersTable
              members={filteredMembers}
              canManage={canManage}
              onDelete={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
              onRevealPassword={revealPassword}
            />
          </>
        )}
      </div>
    </>
  );
}
