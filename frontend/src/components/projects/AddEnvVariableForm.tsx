"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronRight, Loader2, Paperclip, Upload, X } from "lucide-react";

type Environment = "Development" | "Staging" | "Production";

interface AttachedFile {
  name: string;
  dataUrl: string;
}

interface EnvVariable {
  id: number;
  key: string;
  value?: string;
  environment: Environment;
  updatedBy: string;
  updatedAt: string;
  attachedFile?: AttachedFile;
}

interface FormErrors {
  key?: string;
  attachedFile?: string;
}

interface AddEnvVariableFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (variable: EnvVariable) => void | Promise<void>;
  projectName?: string;
  editItem?: EnvVariable;
}

const ENVIRONMENTS: Environment[] = ["Development", "Staging", "Production"];

/**
 * Pull a human-readable message out of an API error. Prefers the backend's
 * field-level validation errors (e.g. a duplicate-name message) over the
 * generic "Request failed with status code …" axios text.
 */
function extractErrorMessage(err: unknown): string {
  const fallback = "Failed to save. Please try again.";
  if (err && typeof err === "object") {
    const data = (err as { response?: { data?: unknown } }).response?.data as
      | { message?: string; errors?: Record<string, string | string[]> }
      | undefined;
    if (data) {
      if (data.errors && typeof data.errors === "object") {
        const first = Object.values(data.errors)[0];
        const text = Array.isArray(first) ? first[0] : first;
        if (typeof text === "string" && text.trim()) return text;
      }
      if (typeof data.message === "string" && data.message.trim()) return data.message;
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function AddEnvVariableForm({
  isOpen,
  onClose,
  onAdd,
  projectName = "E-Commerce Platform",
  editItem,
}: AddEnvVariableFormProps) {
  const [key, setKey] = useState("");
  const [environment, setEnvironment] = useState<Environment>("Development");
  const [errors, setErrors] = useState<FormErrors>({});
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && editItem) {
      setKey(editItem.key);
      setEnvironment(editItem.environment);
      setAttachedFile(editItem.attachedFile ?? null);
    }
  }, [isOpen, editItem]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachedFile({ name: file.name, dataUrl: ev.target?.result as string });
      setErrors((p) => ({ ...p, attachedFile: undefined }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!isOpen) return null;

  const isEditing = !!editItem;

  function resetForm() {
    setKey("");
    setEnvironment("Development");
    setErrors({});
    setAttachedFile(null);
    setSubmitError(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();

    const newErrors: FormErrors = {};
    if (!key.trim()) newErrors.key = "This field is required.";
    if (!attachedFile) newErrors.attachedFile = "This field is required.";

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
        key: key.trim(),
        environment,
        updatedBy: "—",
        updatedAt: "Just now",
        attachedFile: attachedFile ?? undefined,
      });
      handleClose();
    } catch (err: unknown) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputBase =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-2 focus:ring-[#03A1FE]/30";

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
          <span className="text-white/40 text-xs">Environment Variables</span>
          <ChevronRight size={12} className="text-white/30 flex-shrink-0" />
          <span className="text-white text-xs font-medium">
            {isEditing ? "Edit Variable" : "Add Variable"}
          </span>
        </nav>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-1">
          {isEditing ? "Edit Environment Variable" : "Add Environment Variable"}
        </h2>
        <p className="text-white/50 text-sm mb-8">
          {isEditing
            ? "Update this configuration value."
            : "Add a new configuration value for this project."}
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
            {/* Key */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Name <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder=".env or .env.local"
                value={key}
                disabled={isSubmitting}
                onChange={(e) => {
                  setKey(e.target.value);
                  if (errors.key) setErrors((p) => ({ ...p, key: undefined }));
                }}
              />
              {errors.key && (
                <p className="mt-1.5 text-xs text-red-400">{errors.key}</p>
              )}
            </div>

            {/* Attach File */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Attach File <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {attachedFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <Paperclip size={15} className="shrink-0 text-[#03A1FE]" />
                  <span className="flex-1 truncate text-sm text-white/80">
                    {attachedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    disabled={isSubmitting}
                    className="shrink-0 text-white/30 transition-colors hover:text-red-400 disabled:pointer-events-none"
                    aria-label="Remove file"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 font-semibold transition-all duration-200 hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                  style={{
                    borderRadius: "20px",
                    border: "1px solid rgba(3, 161, 254,0.40)",
                    background: "rgba(3, 161, 254,0.08)",
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "14px",
                    cursor: "pointer",
                    padding: "10px 24px",
                    color: "#03A1FE",
                  }}
                >
                  <Upload size={16} />
                  Upload File
                </button>
              )}
              {errors.attachedFile && (
                <p className="mt-1.5 text-xs text-red-400">{errors.attachedFile}</p>
              )}
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Environment <span className="text-red-400 font-semibold">*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {ENVIRONMENTS.map((option) => {
                  const isSelected = environment === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setEnvironment(option)}
                      disabled={isSubmitting}
                      className={`px-6 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-60 ${
                        isSelected
                          ? "border-transparent text-white"
                          : "bg-white/5 border-white/10 text-white/50 hover:border-[#03A1FE]/60 hover:text-white/80"
                      }`}
                      style={
                        isSelected
                          ? {
                              background:
                                "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
                            }
                          : {}
                      }
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
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
                : isEditing ? "Update Variable" : "Save Variable"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
