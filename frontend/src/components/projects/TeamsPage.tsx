"use client";
import { useEffect, useState } from "react";
import {
  Brain,
  Code2,
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSearch, matchesQuery } from "@/context/SearchContext";
import { isAdmin, normalizeEmail } from "@/lib/auth";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberRole = "Admin" | "Developer" | "Viewer";

interface Member {
  id: number;
  name: string;
  email: string;
  password: string;
  role: MemberRole;
  color: string;
}

interface Team {
  id: number;
  name: string;
  icon: "brain" | "code";
  iconBg: string;
  members: Member[];
}

interface FormData {
  name: string;
  email: string;
  password: string;
  role: MemberRole;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "linear-gradient(135deg, #03A1FE 0%, #006AB3 100%)",
  "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
];

// Client-side-only persistence (no backend). Org teams + their members live in
// sessionStorage so they survive refreshes and are mirrored across tabs/logins in
// the same browser profile. (Cross-profile sync would require a real backend.)
const TEAMS_KEY = "pcmp_teams";


// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function maskEmail(): string {
  return "••••••@••••.com";
}

const POPPINS = "Poppins, sans-serif";

// ── Sub-components ────────────────────────────────────────────────────────────

function InitialsAvatar({
  member,
  size = 40,
  ring = false,
}: {
  member: Member;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: member.color,
        fontFamily: POPPINS,
        fontSize: size * 0.36,
        border: ring ? "2px solid #0b1b2b" : "none",
      }}
      title={member.name}
    >
      {getInitials(member.name)}
    </div>
  );
}

function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, { bg: string; color: string }> = {
    Admin: { bg: "rgba(168,85,247,0.20)", color: "#d8b4fe" },
    Developer: { bg: "rgba(59,130,246,0.18)", color: "#03A1FE" },
    Viewer: { bg: "rgba(255,255,255,0.10)", color: "#d1d5db" },
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
      {role}
    </span>
  );
}

function TeamIcon({ icon, bg }: { icon: "brain" | "code"; bg: string }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: 48, height: 48, background: bg }}
    >
      {icon === "brain" ? (
        <Brain size={24} className="text-white" />
      ) : (
        <Code2 size={24} className="text-white" />
      )}
    </div>
  );
}

// ── Edit Team Member Modal ────────────────────────────────────────────────────

function EditMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (updated: Member) => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [password, setPassword] = useState(member.password);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "This field is required.";
    if (!email.trim()) next.email = "This field is required.";
    if (!password.trim()) next.password = "This field is required.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSave({ ...member, name: name.trim(), email: email.trim(), password: password.trim(), role });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
          style={{ width: 32, height: 32, color: "rgba(255,255,255,0.50)", background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <h3 className="mb-1 text-xl font-bold text-white" style={{ fontFamily: POPPINS }}>Edit Team Member</h3>
        <p className="mb-6 text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
          Update details for {member.name}.
        </p>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>Name</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }} placeholder="e.g. Jordan Lee" className={fieldBase} style={fieldStyle} />
            {errors.name && <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>Email</label>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: "" })); }} placeholder="user@example.com" className={fieldBase} style={fieldStyle} />
            {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: "" })); }} placeholder="Password" className={fieldBase + " pr-11"} style={fieldStyle} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-200 hover:text-white/70">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>Role</label>
            <div className="flex gap-3">
              {(["Admin", "Developer", "Viewer"] as MemberRole[]).map((r) => {
                const isActive = role === r;
                return (
                  <button key={r} type="button" onClick={() => setRole(r)} className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-all duration-200"
                    style={{ fontFamily: POPPINS, border: isActive ? "none" : "1px solid rgba(255,255,255,0.12)", background: isActive ? "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)" : "rgba(255,255,255,0.05)", color: isActive ? "#ffffff" : "rgba(255,255,255,0.50)", cursor: "pointer" }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "#03A1FE"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                  >{r}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="w-full text-sm font-semibold text-white transition-all duration-200 hover:bg-white/5 sm:w-auto"
            style={{ fontFamily: POPPINS, background: "transparent", border: "1px solid rgba(255,255,255,0.20)", borderRadius: "20px", padding: "12px 40px", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="w-full text-sm font-bold text-white transition-all duration-200 hover:brightness-110 sm:w-auto"
            style={{ fontFamily: POPPINS, background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", border: "none", borderRadius: "20px", padding: "12px 40px", cursor: "pointer" }}>
            Update Member
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Team Member Modal ─────────────────────────────────────────────────────

const fieldBase =
  "w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:ring-2";
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontFamily: POPPINS,
};

function AddMemberModal({
  teamName,
  onClose,
  onAdd,
}: {
  teamName: string;
  onClose: () => void;
  onAdd: (data: FormData) => { ok: boolean; error?: string };
}) {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    role: "Developer",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const update = (key: keyof FormData, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: "" }));
  };

  const handleSubmit = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "This field is required.";
    if (!form.email.trim()) next.email = "This field is required.";
    if (!form.password.trim()) next.password = "This field is required.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const result = onAdd(form);
    if (!result.ok) {
      setErrors({
        email:
          result.error === "already_on_team"
            ? "This user is already on the team."
            : result.error === "email_exists"
              ? "An account with this email already exists."
              : "Could not add this member.",
      });
      return;
    }
    onClose();
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
        {/* Close */}
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

        {/* Title */}
        <h3
          className="mb-1 text-xl font-bold text-white"
          style={{ fontFamily: POPPINS }}
        >
          Add Team Member
        </h3>
        <p
          className="mb-6 text-xs"
          style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}
        >
          Add a new member to {teamName}.
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
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Jordan Lee"
              className={fieldBase}
              style={fieldStyle}
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>
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
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="user@example.com"
              className={fieldBase}
              style={fieldStyle}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
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
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Set a password"
                className={fieldBase + " pr-11"}
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-200 hover:text-white/70"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
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
            <div className="flex gap-3">
              {(["Admin", "Developer", "Viewer"] as MemberRole[]).map((r) => {
                const isActive = form.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => update("role", r)}
                    className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-all duration-200"
                    style={{
                      fontFamily: POPPINS,
                      border: isActive
                        ? "none"
                        : "1px solid rgba(255,255,255,0.12)",
                      background: isActive
                        ? "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)"
                        : "rgba(255,255,255,0.05)",
                      color: isActive ? "#ffffff" : "rgba(255,255,255,0.50)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLButtonElement).style.borderColor =
                          "#03A1FE";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLButtonElement).style.borderColor =
                          "rgba(255,255,255,0.12)";
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
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
            className="w-full text-sm font-bold text-white transition-all duration-200 hover:brightness-110 sm:w-auto"
            style={{
              fontFamily: POPPINS,
              background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
              boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              border: "none",
              borderRadius: "20px",
              padding: "12px 40px",
              cursor: "pointer",
            }}
          >
            Add Member
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Team Card (list view) ─────────────────────────────────────────────────────

function TeamCard({ team, onOpen }: { team: Team; onOpen: () => void }) {
  const visible = team.members.slice(0, 4);
  const overflow = team.members.length - visible.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col items-start gap-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: "16px",
        boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: "24px",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#03A1FE";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
      }}
    >
      {/* Header: icon + name */}
      <div className="flex items-center gap-4">
        <TeamIcon icon={team.icon} bg={team.iconBg} />
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
            {team.members.length} members
          </p>
        </div>
      </div>

      {/* Overlapping avatars */}
      <div className="flex items-center -space-x-2">
        {visible.map((m) => (
          <InitialsAvatar key={m.id} member={m} size={34} ring />
        ))}
        {overflow > 0 && (
          <div
            className="flex items-center justify-center rounded-full text-xs font-bold text-white"
            style={{
              width: 34,
              height: 34,
              background: "rgba(255,255,255,0.12)",
              border: "2px solid #0b1b2b",
              fontFamily: POPPINS,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Members Table (detail view) ───────────────────────────────────────────────

const TABLE_COLS = ["Name", "Email", "Password", "Role", "Actions"];

function MembersTable({
  team,
  canManage,
  onDelete,
  onEdit,
}: {
  team: Team;
  canManage: boolean;
  onDelete: (id: number) => void;
  onEdit: (member: Member) => void;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const toggleReveal = (id: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.10)",
        boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
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
            {team.members.length === 0 && (
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
                  {canManage
                    ? ' Click "Add Team Member" to get started.'
                    : ""}
                </td>
              </tr>
            )}
            {team.members.map((member, index) => {
              const isRevealed = revealed.has(member.id);
              const isEven = index % 2 === 0;
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
                      <InitialsAvatar member={member} size={36} />
                      <span
                        className="text-sm font-semibold text-white"
                        style={{ fontFamily: POPPINS, whiteSpace: "nowrap" }}
                      >
                        {member.name}
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
                        {member.email}
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
                          {maskEmail()}
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
                        <span
                          style={{
                            fontFamily: isRevealed
                              ? "'Courier New', Courier, monospace"
                              : POPPINS,
                            fontSize: "13px",
                            color: isRevealed
                              ? "rgba(255,255,255,0.82)"
                              : "rgba(255,255,255,0.35)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isRevealed ? member.password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleReveal(member.id)}
                          className="flex-shrink-0 transition-all duration-200 hover:text-[#03A1FE]"
                          style={{
                            color: "rgba(255,255,255,0.35)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px",
                            lineHeight: 0,
                          }}
                          aria-label={
                            isRevealed ? "Hide password" : "Show password"
                          }
                        >
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
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
                          className="transition-all duration-200"
                          style={{
                            color: "rgba(255,255,255,0.40)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            lineHeight: 0,
                          }}
                          onClick={() => onEdit(member)}
                          aria-label={`Edit ${member.name}`}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "#03A1FE";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "rgba(255,255,255,0.40)";
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        {member.role !== "Admin" && (
                          <button
                            type="button"
                            onClick={() => onDelete(member.id)}
                            className="transition-all duration-200"
                            style={{
                              color: "rgba(255,255,255,0.40)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              lineHeight: 0,
                            }}
                            aria-label={`Delete ${member.name}`}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color =
                                "#ef4444";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color =
                                "rgba(255,255,255,0.40)";
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
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
  );
}

// ── Add Team Modal ────────────────────────────────────────────────────────────

const TEAM_ICONS: { value: "brain" | "code"; label: string; bg: string }[] = [
  { value: "brain", label: "AI / Research", bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)" },
  { value: "code",  label: "Engineering",   bg: "linear-gradient(135deg, #03A1FE 0%, #006AB3 100%)" },
];

function AddTeamModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, icon: "brain" | "code", bg: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<(typeof TEAM_ICONS)[0]>(TEAM_ICONS[0]);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) { setError("Team name is required."); return; }
    onAdd(name.trim(), selected.value, selected.bg);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border px-4 py-6 sm:max-w-[90vw] sm:rounded-2xl sm:px-8 sm:py-10 lg:max-w-[480px]"
        style={{ background: "#0b1b2b", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10 sm:right-5 sm:top-5"
          style={{ width: 32, height: 32, color: "rgba(255,255,255,0.50)", background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h3 className="mb-1 text-xl font-bold text-white" style={{ fontFamily: POPPINS }}>Create Team</h3>
        <p className="mb-6 text-xs" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}>
          Add a new team to your organisation.
        </p>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Backend Team"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:ring-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", fontFamily: POPPINS }}
            />
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.65)" }}>Icon</label>
            <div className="flex gap-3">
              {TEAM_ICONS.map((opt) => {
                const isActive = selected.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelected(opt)}
                    className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
                    style={{
                      background: isActive ? "rgba(3, 161, 254,0.10)" : "rgba(255,255,255,0.04)",
                      border: isActive ? "1px solid #03A1FE" : "1px solid rgba(255,255,255,0.10)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: opt.bg }}>
                      {opt.value === "brain" ? <Brain size={18} className="text-white" /> : <Code2 size={18} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-white" style={{ fontFamily: POPPINS }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="w-full text-sm font-semibold text-white transition-all duration-200 hover:bg-white/5 sm:w-auto"
            style={{ fontFamily: POPPINS, background: "transparent", border: "1px solid rgba(255,255,255,0.20)", borderRadius: "20px", padding: "12px 40px", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="w-full text-sm font-bold text-white transition-all duration-200 hover:brightness-110 sm:w-auto"
            style={{ fontFamily: POPPINS, background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)", boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)", border: "none", borderRadius: "20px", padding: "12px 40px", cursor: "pointer" }}>
            Create Team
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const { user, accounts, createUser, removeUser } = useAuth();
  const { query } = useSearch();
  // Mirror the rest of the app: only Admins may manage members.
  // Developers (and anyone else) get read-only, masked views.
  const canManage = isAdmin(user?.role);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage on mount (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEAMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Team[];
        if (Array.isArray(parsed)) setTeams(parsed);
      }
    } catch {
      // corrupt/unavailable storage — keep empty default
    }
    setHydrated(true);
  }, []);

  // Persist after hydration so we never overwrite stored data with defaults.
  // Guard the write so a value mirrored in from another tab's `storage` event
  // doesn't bounce straight back out and cause a write/event ping-pong loop.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const serialized = JSON.stringify(teams);
      if (window.localStorage.getItem(TEAMS_KEY) !== serialized) {
        window.localStorage.setItem(TEAMS_KEY, serialized);
      }
    } catch {
      // ignore
    }
  }, [teams, hydrated]);


  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  // Header search: in the list view match a team by its name or any member's
  // name/email; in the detail view filter the member rows themselves.
  const filteredTeams = teams.filter(
    (t) =>
      matchesQuery(query, t.name) ||
      t.members.some((m) => matchesQuery(query, m.name, m.email, m.role))
  );
  const filteredMembers = selectedTeam
    ? selectedTeam.members.filter((m) =>
        matchesQuery(query, m.name, m.email, m.role)
      )
    : [];

  const {
    currentPage: membersPage,
    setCurrentPage: setMembersPage,
    pageItems: pageMembers,
    totalItems: totalMembersItems,
    itemsPerPage: membersPerPage,
  } = usePagination(filteredMembers, `${selectedTeamId}|${query}`, 8);

  const handleAddMember = (data: FormData): { ok: boolean; error?: string } => {
    if (!selectedTeam || !canManage) return { ok: false, error: "forbidden" };

    // Don't add the same person to this team twice.
    const emailKey = normalizeEmail(data.email);
    if (selectedTeam.members.some((m) => normalizeEmail(m.email) === emailKey)) {
      return { ok: false, error: "already_on_team" };
    }

    // Provision (or reuse) a real login account so this person can sign in with
    // the email + password set here. "Viewer" has no login tier, so it maps to
    // the lowest real role (Developer). Their access then follows their role.
    const loginRole = data.role === "Admin" ? "Admin" : "Developer";
    const existing = accounts.find(
      (a) => normalizeEmail(a.email) === emailKey
    );

    let memberId: number;
    let memberName: string;
    let memberPassword: string;
    if (existing) {
      // Reuse the existing account; its credentials/role stay authoritative.
      memberId = existing.id;
      memberName = existing.name;
      memberPassword = existing.password;
    } else {
      const result = createUser({
        name: data.name,
        email: data.email,
        password: data.password,
        role: loginRole,
      });
      if (!result.ok || result.userId == null) {
        return { ok: false, error: result.error };
      }
      memberId = result.userId;
      memberName = data.name;
      memberPassword = data.password;
    }

    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeam.id
          ? {
              ...t,
              members: [
                ...t.members,
                {
                  id: memberId,
                  name: memberName,
                  email: data.email,
                  password: memberPassword,
                  role: data.role,
                  color: AVATAR_COLORS[t.members.length % AVATAR_COLORS.length],
                },
              ],
            }
          : t
      )
    );
    return { ok: true };
  };

  const handleDeleteMember = (memberId: number) => {
    if (!selectedTeam || !canManage) return;
    const target = selectedTeam.members.find((m) => m.id === memberId);
    if (!target || target.role === "Admin") return;
    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeam.id
          ? { ...t, members: t.members.filter((m) => m.id !== memberId) }
          : t
      )
    );
    removeUser(memberId);
  };

  const handleEditMember = (updated: Member) => {
    if (!selectedTeam || !canManage) return;
    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeam.id
          ? { ...t, members: t.members.map((m) => (m.id === updated.id ? updated : m)) }
          : t
      )
    );
  };

  const handleCreateTeam = (name: string, icon: "brain" | "code", bg: string) => {
    if (!canManage) return;
    const newId = teams.length > 0 ? Math.max(...teams.map((t) => t.id)) + 1 : 1;
    setTeams((prev) => [...prev, { id: newId, name, icon, iconBg: bg, members: [] }]);
  };

  return (
    <>
      {isAddTeamModalOpen && canManage && (
        <AddTeamModal
          onClose={() => setIsAddTeamModalOpen(false)}
          onAdd={handleCreateTeam}
        />
      )}
      {isAddModalOpen && selectedTeam && canManage && (
        <AddMemberModal
          teamName={selectedTeam.name}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddMember}
        />
      )}
      {editingMember && canManage && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleEditMember}
        />
      )}

      {/* ── Page Body ──────────────────────────────────────────────────── */}
      <div className="px-4 py-6 sm:px-8 md:px-12 md:py-8 lg:px-16">
        {selectedTeam === null ? (
          /* ── Teams List View ─────────────────────────────────────────── */
          <>
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1
                  className="text-3xl font-bold text-white md:text-4xl"
                  style={{ fontFamily: POPPINS }}
                >
                  Teams
                </h1>
                <p
                  className="mt-1 text-sm"
                  style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}
                >
                  Manage organization teams and their members.
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsAddTeamModalOpen(true)}
                  className="flex items-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
                  style={{
                    borderRadius: "20px",
                    background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                    boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                    fontFamily: POPPINS,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                    padding: "14px 32px",
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add Team
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onOpen={() => setSelectedTeamId(team.id)}
                />
              ))}
            </div>
            {filteredTeams.length === 0 && (
              <p
                className="mt-2 text-sm"
                style={{ fontFamily: POPPINS, color: "rgba(255,255,255,0.45)" }}
              >
                {teams.length === 0
                  ? canManage
                    ? 'No teams yet. Click "Add Team" to create one.'
                    : "No teams have been created yet."
                  : `No teams match "${query.trim()}".`}
              </p>
            )}
          </>
        ) : (
          /* ── Team Detail View ────────────────────────────────────────── */
          <>
            {/* Back link */}
            <button
              type="button"
              onClick={() => setSelectedTeamId(null)}
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
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.50)";
              }}
            >
              <ArrowLeft size={16} />
              Back to Teams
            </button>

            {/* Team header row */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <TeamIcon icon={selectedTeam.icon} bg={selectedTeam.iconBg} />
                <div>
                  <h1
                    className="text-2xl font-bold text-white md:text-3xl"
                    style={{ fontFamily: POPPINS }}
                  >
                    {selectedTeam.name}
                  </h1>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: POPPINS,
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {selectedTeam.members.length} members
                  </p>
                </div>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex w-full items-center justify-center gap-2 font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95 sm:w-auto"
                  style={{
                    borderRadius: "20px",
                    background:
                      "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                    boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                    fontFamily: POPPINS,
                    fontSize: "14px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    padding: "14px 32px",
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add Team Member
                </button>
              )}
            </div>

            {/* Members table (rows filtered by the header search) */}
            <MembersTable
              team={{ ...selectedTeam, members: pageMembers }}
              canManage={canManage}
              onDelete={handleDeleteMember}
              onEdit={setEditingMember}
            />
            <Pagination
              currentPage={membersPage}
              totalItems={totalMembersItems}
              itemsPerPage={membersPerPage}
              onPageChange={setMembersPage}
            />
          </>
        )}
      </div>
    </>
  );
}
