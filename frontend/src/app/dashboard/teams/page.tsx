"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Users, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSearch } from "@/context/SearchContext";
import { isAdmin } from "@/lib/auth";
import { useTeams, type ApiTeam, type TeamType } from "@/hooks/useTeams";
import TeamCard from "@/components/teams/TeamCard";
import AddTeamModal from "@/components/teams/AddTeamModal";
import EditTeamModal from "@/components/teams/EditTeamModal";

const POPPINS = "Poppins, sans-serif";

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

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl border p-6"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 flex-shrink-0 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-3 w-20 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const { data: teams, loading, error, createTeam, updateTeam, deleteTeam } = useTeams();

  const { query: searchInput } = useSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredTeams = debouncedSearch
    ? teams.filter((t) => t.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : teams;

  const handleCreateTeam = useCallback(
    async (name: string, description: string, team_type: TeamType) => {
      await createTeam({ name, description, team_type });
      showToast({ message: `Team "${name}" created successfully.`, type: "success" });
    },
    [createTeam, showToast]
  );

  const handleUpdateTeam = useCallback(
    async (id: string, name: string, description: string) => {
      await updateTeam(id, { name, description });
      showToast({ message: "Team updated successfully.", type: "success" });
    },
    [updateTeam, showToast]
  );

  const handleDeleteTeam = useCallback(
    async (team: ApiTeam) => {
      try {
        await deleteTeam(team.id);
        showToast({ message: `Team "${team.name}" deleted.`, type: "success" });
      } catch {
        showToast({ message: `Failed to delete "${team.name}".`, type: "error" });
        throw new Error("delete failed");
      }
    },
    [deleteTeam, showToast]
  );

  return (
    <>
      {addModalOpen && canManage && (
        <AddTeamModal onClose={() => setAddModalOpen(false)} onSubmit={handleCreateTeam} />
      )}

      {editingTeam && canManage && (
        <EditTeamModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSubmit={handleUpdateTeam}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed right-5 top-5 z-[100]">
          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{
              background: "#1a1a1a",
              borderColor: toast.type === "success" ? "rgba(16,185,129,0.40)" : "rgba(239,68,68,0.40)",
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
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: POPPINS }}>
              Teams
            </h1>
            <p className="mt-1 text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
              Manage organisation teams and their members.
            </p>
          </div>

          <div className="flex items-center gap-3">
            

            {canManage && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
                style={{
                  borderRadius: "20px",
                  background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)",
                  boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                  fontFamily: POPPINS,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  padding: "12px 28px",
                  whiteSpace: "nowrap",
                }}
              >
                <Plus size={18} strokeWidth={2.5} />
                Add Team
              </button>
            )}
          </div>
        </div>

        {error && !loading && (
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && !error && (
          filteredTeams.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredTeams.map((team, index) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  index={index}
                  canManage={canManage}
                  onEdit={setEditingTeam}
                  onDelete={handleDeleteTeam}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <Users size={48} style={{ color: "rgba(255,255,255,0.15)", marginBottom: 16 }} />
              <p className="text-base font-semibold" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.40)" }}>
                {debouncedSearch ? `No results for "${debouncedSearch}"` : "No teams yet"}
              </p>
              {!debouncedSearch && canManage && (
                <p className="mt-1 text-sm" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.25)" }}>
                  Click &quot;Add Team&quot; to create your first team.
                </p>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
