"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Eye, EyeOff, Globe, Loader2, X } from "lucide-react";

interface AdminCredential {
  id: number;
  panelName: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  updatedBy: string;
  updatedAt: string;
}

interface FormErrors {
  panelName?: string;
  adminPanelUrl?: string;
  username?: string;
  password?: string;
}

interface AddAdminCredentialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (credential: AdminCredential) => void | Promise<void>;
  projectName?: string;
  editItem?: AdminCredential;
}

export default function AddAdminCredentialForm({
  isOpen,
  onClose,
  onAdd,
  projectName = "E-Commerce Platform",
  editItem,
}: AddAdminCredentialFormProps) {
  const [panelName, setPanelName] = useState("");
  const [adminPanelUrl, setAdminPanelUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && editItem) {
      setPanelName(editItem.panelName);
      setAdminPanelUrl(editItem.url);
      setUsername(editItem.username);
      setPassword(editItem.password);
      setNotes(editItem.notes);
    }
  }, [isOpen, editItem]);

  if (!isOpen) return null;

  const isEditing = !!editItem;

  function isValidUrl(url: string): boolean {
    return url.startsWith("http://") || url.startsWith("https://");
  }

  function resetForm() {
    setPanelName("");
    setAdminPanelUrl("");
    setUsername("");
    setPassword("");
    setNotes("");
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
    if (!panelName.trim()) newErrors.panelName = "This field is required.";
    if (!adminPanelUrl.trim()) newErrors.adminPanelUrl = "This field is required.";
    if (!username.trim()) newErrors.username = "This field is required.";
    if (!password.trim()) newErrors.password = "This field is required.";

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
        panelName: panelName.trim(),
        url: adminPanelUrl.trim(),
        username: username.trim(),
        password: password.trim(),
        notes: notes.trim(),
        updatedBy: "Haroon",
        updatedAt: "just now",
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
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-2 focus:ring-[#03A1FE]/30 disabled:opacity-60 disabled:cursor-not-allowed";

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
          background: "#0b1b2b",
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
          <span className="text-white/40 text-xs">Admin Credentials</span>
          <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-white text-xs font-medium">{isEditing ? "Edit Admin Credential" : "Add Admin Credential"}</span>
        </nav>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-1">{isEditing ? "Edit Admin Credential" : "Add Admin Credential"}</h2>
        <p className="text-white/50 text-sm mb-8">
          {isEditing ? "Update this admin panel access credential." : "Securely store admin panel access details for this project."}
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

            {/* Panel Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Panel Name <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. Django Admin Panel"
                value={panelName}
                disabled={isSubmitting}
                onChange={(e) => {
                  setPanelName(e.target.value);
                  if (errors.panelName)
                    setErrors((p) => ({ ...p, panelName: undefined }));
                }}
              />
              {errors.panelName && (
                <p className="mt-1.5 text-xs text-red-400">{errors.panelName}</p>
              )}
            </div>

            {/* Admin Panel URL */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Admin Panel URL <span className="text-red-400 font-semibold">*</span>
              </label>
              <div className="relative">
                <Globe
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  type="url"
                  className={inputBase + " pl-11"}
                  placeholder="e.g. https://admin.example.com"
                  value={adminPanelUrl}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setAdminPanelUrl(e.target.value);
                    if (errors.adminPanelUrl)
                      setErrors((p) => ({ ...p, adminPanelUrl: undefined }));
                  }}
                />
              </div>
              {errors.adminPanelUrl && (
                <p className="mt-1.5 text-xs text-red-400">{errors.adminPanelUrl}</p>
              )}
              {!errors.adminPanelUrl &&
                adminPanelUrl.trim() &&
                !isValidUrl(adminPanelUrl.trim()) && (
                  <p className="mt-1.5 text-xs text-orange-400">
                    URL should start with http:// or https://
                  </p>
                )}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Username <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. admin@example.com"
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

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Password <span className="text-red-400 font-semibold">*</span>
              </label>
              <p className="text-xs text-white/40 italic mb-2">
                This value will be encrypted and stored securely.
              </p>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={inputBase + " pr-12"}
                  placeholder="Enter the admin password"
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((p) => ({ ...p, password: undefined }));
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
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Notes{" "}
                <span className="text-white/30 font-normal text-xs">(optional)</span>
              </label>
              <textarea
                rows={4}
                className={inputBase + " resize-none"}
                placeholder="Add any additional notes, instructions, or context about this admin panel..."
                value={notes}
                disabled={isSubmitting}
                onChange={(e) => setNotes(e.target.value)}
              />
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
                background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting
                ? isEditing ? "Updating…" : "Saving…"
                : isEditing ? "Update Credential" : "Save Admin Credential"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
