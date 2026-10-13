"use client";

import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import type { NewMemberInput } from "@/hooks/useTeamDetail";

const POPPINS = "Poppins, sans-serif";

const fieldBase =
  "w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:ring-2";
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontFamily: POPPINS,
};

type MemberRole = "ADMIN" | "DEVELOPER";

interface Props {
  teamName: string;
  teamType?: "AI_RESEARCH" | "ENGINEERING" | "ADMIN";
  onClose: () => void;
  onSubmit: (input: NewMemberInput) => Promise<void>;
}

export default function AddMemberModal({ teamName, teamType, onClose, onSubmit }: Props) {
  const isAdminTeam = teamType === "ADMIN";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<MemberRole>(isAdminTeam ? "ADMIN" : "DEVELOPER");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    return next;
  };

  const handleSubmit = async () => {
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), password, role });
      onClose();
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: unknown } })?.response?.data;
      const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const fieldErrors = data?.errors && typeof data.errors === "object"
        ? (data.errors as Record<string, unknown>)
        : null;
      const generalMsg =
        typeof data?.message === "string"
          ? data.message
          : "Failed to add member. Please try again.";

      if (fieldErrors) {
        const mapped: Record<string, string> = {};
        const FIELD_MAP: Record<string, string> = { name: "name", email: "email", password: "password" };
        let hasFieldError = false;
        for (const [key, val] of Object.entries(fieldErrors)) {
          const formField = FIELD_MAP[key];
          const msg = Array.isArray(val) ? String(val[0]) : String(val);
          if (formField) {
            mapped[formField] = msg;
            hasFieldError = true;
          }
        }
        if (hasFieldError) {
          setErrors(mapped);
        } else {
          setErrors({ submit: generalMsg });
        }
      } else {
        setErrors({ submit: generalMsg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const clearError = (field: string) =>
    setErrors((p) => ({ ...p, [field]: "" }));

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
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <h3
          className="mb-1 text-xl font-bold text-white"
          style={{ fontFamily: POPPINS }}
        >
          Add Member
        </h3>
        <p
          className="mb-6 text-xs"
          style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}
        >
          Create a new user and add them to{" "}
          <strong className="text-white/70">{teamName}</strong>.
        </p>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError("name"); }}
              placeholder="e.g. Jane Smith"
              className={fieldBase}
              style={fieldStyle}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
              placeholder="e.g. jane@example.com"
              className={fieldBase}
              style={fieldStyle}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                placeholder="Min. 8 characters"
                className={fieldBase}
                style={{ ...fieldStyle, paddingRight: "3rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.35)",
                  lineHeight: 0,
                  padding: 4,
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}
            >
              Role
            </label>
            {isAdminTeam ? (
              /* Admin team — role is locked to Admin */
              <div>
                <div
                  className="flex items-center gap-2 rounded-full px-5 py-2.5"
                  style={{
                    background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                    display: "inline-flex",
                  }}
                >
                  <span className="text-sm font-semibold text-white" style={{ fontFamily: POPPINS }}>Admin</span>
                </div>
                <p className="mt-1.5 text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.35)" }}>
                  Admin teams only accept Admin users.
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                {(["ADMIN", "DEVELOPER"] as MemberRole[]).map((r) => {
                  const isActive = role === r;
                  const label = r === "ADMIN" ? "Admin" : "Developer";
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-all duration-200"
                      style={{
                        fontFamily: POPPINS,
                        border: isActive ? "none" : "1px solid rgba(255,255,255,0.12)",
                        background: isActive
                          ? "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)"
                          : "rgba(255,255,255,0.05)",
                        color: isActive ? "#ffffff" : "rgba(255,255,255,0.50)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "#03A1FE";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
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
            {submitting ? "Adding…" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}
