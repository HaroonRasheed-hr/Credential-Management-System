"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Lock, Pencil, Trash2 } from "lucide-react";
import type { ApiOrgMember, UpdateMemberInput } from "@/hooks/useTeamDetail";

const POPPINS = "Poppins, sans-serif";

const AVATAR_COLORS = [
  "linear-gradient(135deg, #03A1FE 0%, #006AB3 100%)",
  "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
];

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: 36,
        height: 36,
        background: AVATAR_COLORS[index % AVATAR_COLORS.length],
        fontFamily: POPPINS,
        fontSize: 13,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function RoleBadge({ role }: { role: "ADMIN" | "DEVELOPER" }) {
  const styles = {
    ADMIN: { bg: "rgba(168,85,247,0.20)", color: "#d8b4fe" },
    DEVELOPER: { bg: "rgba(59,130,246,0.18)", color: "#03A1FE" },
  };
  const s = styles[role];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: s.bg,
        color: s.color,
        fontFamily: POPPINS,
        whiteSpace: "nowrap",
      }}
    >
      {role === "ADMIN" ? "Admin" : "Developer"}
    </span>
  );
}

// ── Edit Member Modal ──────────────────────────────────────────────────────────

const fieldBase =
  "w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:ring-2";
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontFamily: POPPINS,
};

function EditMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: ApiOrgMember;
  onClose: () => void;
  onSave: (memberId: string, input: UpdateMemberInput) => Promise<void>;
}) {
  const [role, setRole] = useState<"ADMIN" | "DEVELOPER">(member.role);
  const [email, setEmail] = useState(member.user.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (password && password.length < 8)
      next.password = "Password must be at least 8 characters.";
    return next;
  };

  const handleSave = async () => {
    const next = validate();
    if (Object.keys(next).length > 0) { setErrors(next); return; }
    setSaving(true);
    try {
      const input: UpdateMemberInput = { role, email: email.trim() };
      if (password) input.password = password;
      await onSave(member.id, input);
      onClose();
    } catch {
      setErrors({ submit: "Failed to update member. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const clearError = (field: string) =>
    setErrors((p) => ({ ...p, [field]: "" }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border px-8 py-8"
        style={{
          background: "#0b1b2b",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        }}
      >
        <h3 className="mb-1 text-lg font-bold text-white" style={{ fontFamily: POPPINS }}>
          Edit Member
        </h3>
        <p className="mb-5 text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
          Editing <span className="text-white/70">{member.user.username}</span>.
        </p>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
              className={fieldBase}
              style={fieldStyle}
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                placeholder="Leave blank to keep current"
                className={fieldBase}
                style={{ ...fieldStyle, paddingRight: "3rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", lineHeight: 0, padding: 4 }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>
              Role
            </label>
            <div className="flex gap-3">
              {(["ADMIN", "DEVELOPER"] as const).map((r) => {
                const isActive = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-all duration-200"
                    style={{
                      fontFamily: POPPINS,
                      border: isActive ? "none" : "1px solid rgba(255,255,255,0.12)",
                      background: isActive ? "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)" : "rgba(255,255,255,0.05)",
                      color: isActive ? "#ffffff" : "rgba(255,255,255,0.50)",
                      cursor: "pointer",
                    }}
                  >
                    {r === "ADMIN" ? "Admin" : "Developer"}
                  </button>
                );
              })}
            </div>
          </div>

          {errors.submit && <p className="text-xs text-red-400">{errors.submit}</p>}
        </div>

        <div className="mt-6 flex gap-3">
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
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-full py-2.5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-60"
            style={{ fontFamily: POPPINS, background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)", border: "none", cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Table ─────────────────────────────────────────────────────────────────

const TABLE_COLS = ["Name", "Email", "Password", "Role", "Actions"];

interface Props {
  members: ApiOrgMember[];
  canManage: boolean;
  onDelete: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, input: UpdateMemberInput) => Promise<void>;
  onRevealPassword: (memberId: string) => Promise<string>;
}

export default function MembersTable({
  members,
  canManage,
  onDelete,
  onUpdateRole,
  onRevealPassword,
}: Props) {
  const [editingMember, setEditingMember] = useState<ApiOrgMember | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [revealing, setRevealing] = useState<Set<string>>(new Set());
  const [revealErrors, setRevealErrors] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reset the "copied" indicator 1.5s after a copy, clearing the timer on
  // unmount / re-copy so it can't fire into an unmounted component.
  useEffect(() => {
    if (copiedId === null) return;
    const t = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedId]);

  const handleReveal = async (memberId: string) => {
    if (revealed.has(memberId)) {
      setRevealed((prev) => { const n = new Map(prev); n.delete(memberId); return n; });
      return;
    }
    if (revealErrors.has(memberId)) {
      setRevealErrors((prev) => { const n = new Set(prev); n.delete(memberId); return n; });
      return;
    }
    setRevealing((prev) => new Set(prev).add(memberId));
    try {
      const password = await onRevealPassword(memberId);
      if (password) {
        setRevealed((prev) => new Map(prev).set(memberId, password));
      } else {
        setRevealErrors((prev) => new Set(prev).add(memberId));
      }
    } catch {
      setRevealErrors((prev) => new Set(prev).add(memberId));
    } finally {
      setRevealing((prev) => { const n = new Set(prev); n.delete(memberId); return n; });
    }
  };

  const handleDelete = async (memberId: string) => {
    setDeleting(memberId);
    try {
      await onDelete(memberId);
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <>
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={onUpdateRole}
        />
      )}

      <div
        className="w-full overflow-hidden rounded-2xl border"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col}
                    className="px-6 py-4 text-left text-xs font-bold uppercase"
                    style={{
                      fontFamily: POPPINS,
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
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={TABLE_COLS.length}
                    className="px-6 py-12 text-center"
                    style={{
                      fontFamily: POPPINS,
                      fontSize: "14px",
                      color: "rgba(255,255,255,0.38)",
                    }}
                  >
                    No members in this team yet.
                    {canManage ? ' Click "Add Member" to get started.' : ""}
                  </td>
                </tr>
              )}

              {members.map((member, index) => {
                const isEven = index % 2 === 0;
                const isRevealed = revealed.has(member.id);
                const isRevealing = revealing.has(member.id);
                const hasRevealError = revealErrors.has(member.id);
                const passwordValue = revealed.get(member.id) ?? "••••••••";
                const isConfirmingDelete = confirmDeleteId === member.id;
                const isDeletingThis = deleting === member.id;

                return (
                  <tr
                    key={member.id}
                    className="transition-all duration-200 hover:bg-white/5"
                    style={{
                      background: isEven
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Name */}
                    <td
                      className="px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={member.user.username} index={index} />
                        <span
                          className="text-sm font-semibold text-white"
                          style={{ fontFamily: POPPINS, whiteSpace: "nowrap" }}
                        >
                          {member.user.username}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td
                      className="px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      {canManage ? (
                        <span
                          style={{
                            fontFamily: POPPINS,
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.55)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {member.user.email}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Lock
                            size={13}
                            style={{ color: "rgba(255,255,255,0.35)" }}
                          />
                          <span
                            style={{
                              fontFamily: POPPINS,
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.35)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ••••@••••.com
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Password */}
                    <td
                      className="px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          {hasRevealError ? (
                            <span style={{ fontFamily: POPPINS, fontSize: "12px", color: "rgba(255,255,255,0.30)", fontStyle: "italic" }}>
                              Not available
                            </span>
                          ) : (
                            <>
                              <span
                                style={{
                                  fontFamily: isRevealed ? "'Courier New', Courier, monospace" : POPPINS,
                                  fontSize: "13px",
                                  color: isRevealed ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.35)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {passwordValue}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleReveal(member.id)}
                                disabled={isRevealing}
                                className="flex-shrink-0 transition-all duration-200 hover:text-[#03A1FE] disabled:opacity-50"
                                style={{
                                  color: "rgba(255,255,255,0.35)",
                                  background: "none",
                                  border: "none",
                                  cursor: isRevealing ? "not-allowed" : "pointer",
                                  padding: "2px",
                                  lineHeight: 0,
                                }}
                                aria-label={isRevealed ? "Hide password" : "Show password"}
                              >
                                {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                              {isRevealed && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(passwordValue);
                                      setCopiedId(member.id);
                                    } catch { /* clipboard unavailable */ }
                                  }}
                                  className="flex-shrink-0 transition-all duration-200"
                                  style={{
                                    color: copiedId === member.id ? "#4ade80" : "rgba(255,255,255,0.35)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "2px",
                                    lineHeight: 0,
                                  }}
                                  aria-label={copiedId === member.id ? "Copied" : "Copy password"}
                                >
                                  {copiedId === member.id ? <Check size={15} /> : <Copy size={15} />}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <span
                          className="flex items-center gap-2"
                          style={{ cursor: "not-allowed" }}
                        >
                          <Lock
                            size={13}
                            style={{ color: "rgba(255,255,255,0.35)" }}
                          />
                          <span
                            style={{
                              fontFamily: POPPINS,
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            ••••••••
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td
                      className="px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <RoleBadge role={member.role} />
                    </td>

                    {/* Actions */}
                    <td
                      className="px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      {canManage ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingMember(member)}
                            className="transition-all duration-200"
                            style={{
                              color: "rgba(255,255,255,0.40)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              lineHeight: 0,
                            }}
                            aria-label={`Edit ${member.user.username}`}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.color = "#03A1FE";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.color = "rgba(255,255,255,0.40)";
                            }}
                          >
                            <Pencil size={15} />
                          </button>

                          {member.role !== "ADMIN" && (isConfirmingDelete ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDelete(member.id)}
                                disabled={isDeletingThis}
                                className="rounded px-2 py-0.5 text-xs font-semibold text-red-400 transition-all duration-150 hover:bg-red-500/15 disabled:opacity-50"
                                style={{
                                  fontFamily: POPPINS,
                                  background: "none",
                                  border: "1px solid rgba(239,68,68,0.40)",
                                  cursor: isDeletingThis ? "not-allowed" : "pointer",
                                }}
                              >
                                {isDeletingThis ? "…" : "Yes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded px-2 py-0.5 text-xs font-semibold transition-all duration-150 hover:bg-white/10"
                                style={{
                                  fontFamily: POPPINS,
                                  color: "rgba(255,255,255,0.45)",
                                  background: "none",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  cursor: "pointer",
                                }}
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(member.id)}
                              className="transition-all duration-200"
                              style={{
                                color: "rgba(255,255,255,0.40)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                lineHeight: 0,
                              }}
                              aria-label={`Delete ${member.user.username}`}
                              onMouseEnter={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.color = "#ef4444";
                              }}
                              onMouseLeave={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.color = "rgba(255,255,255,0.40)";
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Lock
                          size={15}
                          style={{ color: "rgba(255,255,255,0.25)" }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
