"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  ShieldOff,
  UserCircle,
  Users,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isAdmin, type Role } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";

// ── Shared styling ────────────────────────────────────────────────────────────

const CARD =
  "rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]";
const INPUT =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-1 focus:ring-[#03A1FE]";
const GRADIENT_BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-[20px] px-8 py-3 font-semibold text-white shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] transition-all duration-200 hover:brightness-110 disabled:opacity-60 sm:w-auto";
const GRADIENT_BG = "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)";

const ROLE_BADGE: Record<Role, string> = {
  Admin: "bg-purple-500/20 text-purple-300",
  Developer: "bg-blue-500/20 text-[#03A1FE]",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.substring(0, 2) ?? "??").toUpperCase();
}

type Strength = { pct: number; label: string; bar: string; text: string } | null;

function scorePassword(pw: string): Strength {
  if (!pw) return null;
  const mixed =
    /[a-z]/.test(pw) && /[A-Z0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw);
  if (pw.length >= 10 && mixed)
    return { pct: 100, label: "Strong", bar: "bg-green-500", text: "text-green-400" };
  if (pw.length >= 6)
    return { pct: 60, label: "Fair", bar: "bg-orange-400", text: "text-orange-300" };
  return { pct: 30, label: "Weak", bar: "bg-red-500", text: "text-red-400" };
}

// ── Small building blocks ─────────────────────────────────────────────────────

function CardHeader({
  icon,
  title,
  subtitle,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          danger ? "bg-red-500/10 text-red-400" : "bg-white/5 text-[#03A1FE]"
        }`}
      >
        {icon}
      </div>
      <div>
        <h2
          className={`text-lg font-semibold ${
            danger ? "text-orange-300" : "text-white"
          }`}
        >
          {title}
        </h2>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

function SuccessToast({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
      <CheckCircle size={18} />
      {message}
    </div>
  );
}

function ErrorToast({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <XCircle size={18} />
      {message}
    </div>
  );
}

function PasswordInput({
  label,
  value,
  show,
  onToggle,
  onChange,
  error,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-gray-300">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading: profileLoading, updateProfile, changePassword } = useProfile();

  const role: Role = user?.role ?? "Developer";

  // Developers don't have access to Settings — send them to Projects.
  useEffect(() => {
    if (user?.role === "Developer") {
      router.replace("/dashboard/projects");
    }
  }, [user?.role, router]);

  // ── Profile form ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailField, setEmailField] = useState("");
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Clear the "profile saved" confirmation after 3s, clearing the timer on
  // unmount so it can't fire into an unmounted component.
  useEffect(() => {
    if (!profileSaved) return;
    const t = setTimeout(() => setProfileSaved(false), 3000);
    return () => clearTimeout(t);
  }, [profileSaved]);

  // Pre-fill form once profile loads from API
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
    setUsername(profile.username);
    setEmailField(profile.email);
  }, [profile]);

  // ── Password form ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSaved, setPwSaved] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const strength = scorePassword(newPw);

  // ── Stats ──
  const stats = [
    {
      icon: <Briefcase className="text-[#03A1FE]" size={20} />,
      value: profile?.stats.total_projects ?? 0,
      label: "Total Projects",
    },
    {
      icon: <Users className="text-orange-400" size={20} />,
      value: profile?.stats.team_members ?? 0,
      label: "Team Members",
    },
    {
      icon: <ShieldCheck className="text-green-400" size={20} />,
      value: profile?.stats.teams_managed ?? 0,
      label: "Teams Managed",
    },
  ];

  // ── Handlers ──
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "This field is required.";
    if (!lastName.trim()) errs.lastName = "This field is required.";
    if (!username.trim()) errs.username = "This field is required.";
    if (!emailField.trim()) errs.email = "This field is required.";
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setProfileSaving(true);
    try {
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
        username,
        email: emailField,
      });
      setProfileSaved(true);
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { code?: string; message?: string } } })
        ?.response?.data;
      const newErrs: Record<string, string> = {};
      if (data?.code === "USERNAME_TAKEN") {
        newErrs.username = data.message ?? "This username is already taken.";
      } else if (data?.code === "EMAIL_TAKEN") {
        newErrs.email = data.message ?? "This email is already in use.";
      } else {
        newErrs._general = data?.message ?? "Failed to update profile. Please try again.";
      }
      setProfileErrors(newErrs);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPw) errs.current = "Current password is required.";
    if (!newPw) errs.new = "This field is required.";
    if (newPw && confirmPw !== newPw) errs.confirm = "Passwords do not match.";
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwSaving(true);
    try {
      await changePassword({
        current_password: currentPw,
        new_password: newPw,
        confirm_password: confirmPw,
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwSaved(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: unknown } })?.response;
      const raw = resp?.data;
      const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const code = typeof data?.code === "string" ? data.code : null;
      const msg = typeof data?.message === "string" ? data.message : null;
      const errors = data?.errors && typeof data.errors === "object"
        ? (data.errors as Record<string, unknown>)
        : null;
      const newErrs: Record<string, string> = {};
      if (code === "INVALID_CURRENT_PASSWORD") {
        newErrs.current = msg ?? "Your current password is incorrect.";
      } else if (code === "PASSWORD_MISMATCH") {
        newErrs.confirm = msg ?? "Passwords do not match.";
      } else if (code === "PASSWORD_SAME_AS_CURRENT") {
        newErrs.new = msg ?? "New password must be different from the current one.";
      } else if (code === "VALIDATION_ERROR" && errors) {
        const pwErr = errors.new_password;
        newErrs.new = Array.isArray(pwErr) ? String(pwErr[0]) : (msg ?? "Password does not meet requirements.");
      } else {
        newErrs._general = msg ?? "Failed to change password. Please try again.";
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwErrors(newErrs);
    } finally {
      setPwSaving(false);
    }
  }

  // ── Role guard ──
  if (!isAdmin(role)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <ShieldOff size={64} className="mb-5 text-gray-500" />
        <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
        <p className="mt-2 max-w-md text-sm text-gray-400">
          This page is only accessible to Admins.
        </p>
      </div>
    );
  }

  const displayName = profile?.full_name ?? profile?.username ?? user?.name ?? "User";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const displayJoined = profile ? `Joined ${profile.joined}` : "Joined …";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8 md:px-12 lg:px-16">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage your account settings and preferences.
        </p>
      </div>

      {/* Section 1 — Profile card */}
      <section className={CARD}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ background: GRADIENT_BG }}
          >
            {getInitials(displayName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-xl font-bold text-white">{displayName}</h2>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-medium ${ROLE_BADGE[role]}`}
              >
                {role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-gray-400">{displayEmail}</p>
            <p className="mt-0.5 text-xs italic text-gray-500">{displayJoined}</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                {s.icon}
              </div>
              <div>
                <p
                  className={`text-xl font-bold text-white ${
                    profileLoading ? "animate-pulse text-gray-500" : ""
                  }`}
                >
                  {s.value}
                </p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Edit profile */}
      <section className={CARD}>
        {profileSaved && (
          <SuccessToast message="Profile updated successfully!" />
        )}
        {profileErrors._general && (
          <ErrorToast message={profileErrors._general} />
        )}
        <CardHeader
          icon={<UserCircle size={20} />}
          title="Edit Profile"
          subtitle="Update your name, username, and email"
        />
        <form onSubmit={handleSaveProfile} noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">
                First Name
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT}
              />
              {profileErrors.firstName && (
                <p className="mt-1 text-xs text-red-400">
                  {profileErrors.firstName}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">
                Last Name
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT}
              />
              {profileErrors.lastName && (
                <p className="mt-1 text-xs text-red-400">
                  {profileErrors.lastName}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT}
              />
              {profileErrors.username && (
                <p className="mt-1 text-xs text-red-400">
                  {profileErrors.username}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-300">
                Email Address
              </label>
              <input
                type="email"
                value={emailField}
                onChange={(e) => setEmailField(e.target.value)}
                className={INPUT}
              />
              {profileErrors.email && (
                <p className="mt-1 text-xs text-red-400">
                  {profileErrors.email}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className={`${GRADIENT_BTN} mt-5`}
            style={{ background: GRADIENT_BG }}
          >
            {profileSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {profileSaving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </section>

      {/* Section 3 — Change password */}
      <section className={CARD}>
        {pwSaved && (
          <SuccessToast message="Password changed. Please log in again." />
        )}
        {pwErrors._general && <ErrorToast message={pwErrors._general} />}
        <CardHeader
          icon={<Lock size={20} />}
          title="Change Password"
          subtitle="Keep your account secure"
        />
        <form onSubmit={handleChangePassword} noValidate className="space-y-4">
          <PasswordInput
            label="Current Password"
            value={currentPw}
            show={showCurrent}
            onToggle={() => setShowCurrent((s) => !s)}
            onChange={setCurrentPw}
            error={pwErrors.current}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <PasswordInput
                label="New Password"
                value={newPw}
                show={showNew}
                onToggle={() => setShowNew((s) => !s)}
                onChange={setNewPw}
                error={pwErrors.new}
              />
              {strength && (
                <div className="mt-2">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${strength.bar}`}
                      style={{ width: `${strength.pct}%` }}
                    />
                  </div>
                  <p className={`mt-1 text-xs ${strength.text}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>
            <PasswordInput
              label="Confirm New Password"
              value={confirmPw}
              show={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              onChange={setConfirmPw}
              error={pwErrors.confirm}
            />
          </div>
          <button
            type="submit"
            disabled={pwSaving}
            className={GRADIENT_BTN}
            style={{ background: GRADIENT_BG }}
          >
            {pwSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Lock size={18} />
            )}
            {pwSaving ? "Changing…" : "Change Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
