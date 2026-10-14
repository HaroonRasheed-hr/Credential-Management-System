"use client";

import { useState } from "react";
import { AlertCircle, ChevronRight, Eye, EyeOff, Calendar, Loader2, X } from "lucide-react";

interface LicenseKey {
  id: number;
  name: string;
  vendor: string;
  key: string;
  expiryDate: Date;
  updatedBy: string;
}

interface FormErrors {
  licenseName?: string;
  vendor?: string;
  licenseKey?: string;
  expiryDate?: string;
}

interface AddLicenseKeyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (license: LicenseKey) => void | Promise<void>;
  projectName?: string;
  editItem?: LicenseKey;
}

function toDateInputValue(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function AddLicenseKeyForm({
  isOpen,
  onClose,
  onAdd,
  projectName = "E-Commerce Platform",
  editItem,
}: AddLicenseKeyFormProps) {
  const [licenseName, setLicenseName] = useState(() => editItem?.name ?? "");
  const [vendor, setVendor] = useState(() => editItem?.vendor ?? "");
  const [licenseKey, setLicenseKey] = useState(() => editItem?.key ?? "");
  const [expiryDate, setExpiryDate] = useState(() =>
    editItem ? toDateInputValue(editItem.expiryDate) : ""
  );
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEditing = !!editItem;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function isPastDate(dateStr: string): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }

  function resetForm() {
    setLicenseName("");
    setVendor("");
    setLicenseKey("");
    setExpiryDate("");
    setShowLicenseKey(false);
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
    if (!licenseName.trim()) newErrors.licenseName = "This field is required.";
    if (!vendor.trim()) newErrors.vendor = "This field is required.";
    if (!licenseKey.trim()) newErrors.licenseKey = "This field is required.";
    if (!expiryDate) newErrors.expiryDate = "This field is required.";

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
        name: licenseName.trim(),
        vendor: vendor.trim(),
        key: licenseKey.trim(),
        expiryDate: new Date(expiryDate),
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
          <span className="text-white/40 text-xs">License Keys</span>
          <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-white text-xs font-medium">{isEditing ? "Edit License Key" : "Add License Key"}</span>
        </nav>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-1">{isEditing ? "Edit License Key" : "Add License Key"}</h2>
        <p className="text-white/50 text-sm mb-8">
          {isEditing ? "Update this license key's details." : "Add a new software or service license for this project."}
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

            {/* License Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                License Name <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. Adobe Creative Cloud"
                value={licenseName}
                disabled={isSubmitting}
                onChange={(e) => {
                  setLicenseName(e.target.value);
                  if (errors.licenseName)
                    setErrors((p) => ({ ...p, licenseName: undefined }));
                }}
              />
              {errors.licenseName && (
                <p className="mt-1.5 text-xs text-red-400">{errors.licenseName}</p>
              )}
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Vendor <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. Adobe Inc."
                value={vendor}
                disabled={isSubmitting}
                onChange={(e) => {
                  setVendor(e.target.value);
                  if (errors.vendor)
                    setErrors((p) => ({ ...p, vendor: undefined }));
                }}
              />
              {errors.vendor && (
                <p className="mt-1.5 text-xs text-red-400">{errors.vendor}</p>
              )}
            </div>

            {/* License Key */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                License Key <span className="text-red-400 font-semibold">*</span>
              </label>
              <p className="text-xs text-white/40 italic mb-2">
                This value will be encrypted and stored securely.
              </p>
              <div className="relative">
                <input
                  type={showLicenseKey ? "text" : "password"}
                  className={inputBase + " pr-12"}
                  placeholder="Enter the license key"
                  value={licenseKey}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setLicenseKey(e.target.value);
                    if (errors.licenseKey)
                      setErrors((p) => ({ ...p, licenseKey: undefined }));
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowLicenseKey((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-all duration-200"
                  tabIndex={-1}
                  aria-label={showLicenseKey ? "Hide key" : "Show key"}
                >
                  {showLicenseKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.licenseKey && (
                <p className="mt-1.5 text-xs text-red-400">{errors.licenseKey}</p>
              )}
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Expiry Date <span className="text-red-400 font-semibold">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  className={
                    inputBase +
                    " pr-12 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  }
                  value={expiryDate}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setExpiryDate(e.target.value);
                    if (errors.expiryDate)
                      setErrors((p) => ({ ...p, expiryDate: undefined }));
                  }}
                />
                <Calendar
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                />
              </div>
              {errors.expiryDate && (
                <p className="mt-1.5 text-xs text-red-400">{errors.expiryDate}</p>
              )}
              {!errors.expiryDate && expiryDate && isPastDate(expiryDate) && (
                <p className="mt-1.5 text-xs text-orange-400">
                  Warning: This date is in the past.
                </p>
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
                background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting
                ? isEditing ? "Updating…" : "Saving…"
                : isEditing ? "Update License Key" : "Save License Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
