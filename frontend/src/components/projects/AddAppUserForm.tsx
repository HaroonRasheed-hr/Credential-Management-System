"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Eye, EyeOff, Loader2, X } from "lucide-react";

interface AppUser {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  updatedBy: string;
}

interface FormErrors {
  username?: string;
  email?: string;
  passwordOrToken?: string;
  roleInApp?: string;
}

interface AddAppUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: AppUser) => void | Promise<void>;
  projectName?: string;
  editItem?: AppUser;
}

export default function AddAppUserForm({
  isOpen,
  onClose,
  onAdd,
  projectName = "E-Commerce Platform",
  editItem,
}: AddAppUserFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [passwordOrToken, setPasswordOrToken] = useState("");
  const [roleInApp, setRoleInApp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && editItem) {
      setUsername(editItem.username);
      setEmail(editItem.email);
      setPasswordOrToken(editItem.password);
      setRoleInApp(editItem.role);
    }
  }, [isOpen, editItem]);

  if (!isOpen) return null;

  const isEditing = !!editItem;

  function isValidEmail(val: string): boolean {
    return val.includes("@");
  }

  function resetForm() {
    setUsername("");
    setEmail("");
    setPasswordOrToken("");
    setRoleInApp("");
    setShowPassword(false);
    setErrors({});
    setSubmitError(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: FormErrors = {};
    if (!username.trim()) newErrors.username = "This field is required.";
    if (!passwordOrToken.trim()) newErrors.passwordOrToken = "This field is required.";
    if (!roleInApp.trim()) newErrors.roleInApp = "This field is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onAdd({
        id: editItem?.id ?? Date.now(),
        username: username.trim(),
        email: email.trim(),
        password: passwordOrToken.trim(),
        role: roleInApp.trim(),
        updatedBy: "Haroon",
      });
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputBase =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-[#57C8E7] focus:ring-2 focus:ring-[#57C8E7]/30 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative w-full max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 px-4 py-8 sm:max-w-[640px] sm:rounded-2xl sm:px-8 sm:py-10 md:px-10"
        style={{
          background: "#1a1a1a",
          boxShadow: "0px 24px 64px 0px rgba(0,0,0,0.6)",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 mb-4">
          <span className="text-white/40 text-xs">Projects</span>
          <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-white/40 text-xs">{projectName}</span>
          <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-white/40 text-xs">App Users</span>
          <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-white text-xs font-medium">{isEditing ? "Edit App User" : "Add App User"}</span>
        </nav>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-1">{isEditing ? "Edit App User" : "Add App User"}</h2>
        <p className="text-white/50 text-sm mb-8">
          {isEditing ? "Update this application user's details." : "Record a Django application user created for this project."}
        </p>

        {/* API error banner */}
        {submitError && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
            <p className="text-sm text-red-300" style={{ fontFamily: "Poppins, sans-serif" }}>{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-6">

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Username <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. john_doe"
                value={username}
                disabled={isSubmitting}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username)
                    setErrors((p) => ({ ...p, username: undefined }));
                }}
              />
              {errors.username && (
                <p className="mt-1.5 text-xs text-red-400">{errors.username}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Email <span className="text-white/40 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                className={inputBase}
                placeholder="e.g. john.doe@xis.ai"
                value={email}
                disabled={isSubmitting}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email)
                    setErrors((p) => ({ ...p, email: undefined }));
                }}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
              )}
              {!errors.email && email.trim() && !isValidEmail(email.trim()) && (
                <p className="mt-1.5 text-xs text-orange-400">
                  Please enter a valid email address.
                </p>
              )}
            </div>

            {/* Password / Token */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Password / Token{" "}
                <span className="text-red-400 font-semibold">*</span>
              </label>
              <p className="text-xs text-white/40 italic mb-2">
                This value will be encrypted and stored securely.
              </p>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={inputBase + " pr-12"}
                  placeholder="Enter password or access token"
                  value={passwordOrToken}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setPasswordOrToken(e.target.value);
                    if (errors.passwordOrToken)
                      setErrors((p) => ({ ...p, passwordOrToken: undefined }));
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-all duration-200"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.passwordOrToken && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.passwordOrToken}
                </p>
              )}
            </div>

            {/* Role in App */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Role in App{" "}
                <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. Admin"
                value={roleInApp}
                disabled={isSubmitting}
                onChange={(e) => {
                  setRoleInApp(e.target.value);
                  if (errors.roleInApp)
                    setErrors((p) => ({ ...p, roleInApp: undefined }));
                }}
              />
              {errors.roleInApp && (
                <p className="mt-1.5 text-xs text-red-400">{errors.roleInApp}</p>
              )}
            </div>

          </div>

          {/* Actions */}
          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full rounded-[20px] border border-white/20 bg-transparent px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] px-8 py-3 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              style={{
                background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting
                ? isEditing ? "Updating…" : "Saving…"
                : isEditing ? "Update App User" : "Save App User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
