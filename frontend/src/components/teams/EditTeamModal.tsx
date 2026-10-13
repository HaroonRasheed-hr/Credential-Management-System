"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ApiTeam } from "@/hooks/useTeams";

const POPPINS = "Poppins, sans-serif";

const fieldBase =
  "w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:ring-2";
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontFamily: POPPINS,
};

interface Props {
  team: ApiTeam;
  onClose: () => void;
  onSubmit: (id: string, name: string, description: string) => Promise<void>;
}

export default function EditTeamModal({ team, onClose, onSubmit }: Props) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Team name is required.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(team.id, name.trim(), description.trim());
      onClose();
    } catch {
      setErrors({ submit: "Failed to update team. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border px-4 py-6 sm:max-w-[90vw] sm:rounded-2xl sm:px-8 sm:py-10 lg:max-w-[480px]"
        style={{
          background: "#0b1b2b",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10 sm:right-5 sm:top-5"
          style={{
            width: 32,
            height: 32,
            color: "rgba(255,255,255,0.50)",
            background: "none",
            border: "none",
            cursor: "pointer",
            lineHeight: 0,
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h3
          className="mb-1 text-xl font-bold text-white"
          style={{ fontFamily: POPPINS }}
        >
          Edit Team
        </h3>
        <p
          className="mb-6 text-xs"
          style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}
        >
          Update details for <strong className="text-white/70">{team.name}</strong>.
        </p>

        <div className="space-y-5">
          {/* Team Name */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}
            >
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="e.g. Backend Team"
              className={fieldBase}
              style={fieldStyle}
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}
            >
              Description{" "}
              <span style={{ color: "rgba(255,255,255,0.35)" }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this team's purpose..."
              rows={3}
              className={fieldBase}
              style={{ ...fieldStyle, resize: "none" }}
            />
          </div>

          {errors.submit && (
            <p className="text-sm text-red-400">{errors.submit}</p>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full text-sm font-semibold text-white transition-all duration-200 hover:bg-white/5 sm:w-auto"
            style={{
              fontFamily: POPPINS,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.20)",
              borderRadius: "20px",
              padding: "12px 40px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full text-sm font-bold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-60 sm:w-auto"
            style={{
              fontFamily: POPPINS,
              background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
              boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              border: "none",
              borderRadius: "20px",
              padding: "12px 40px",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
