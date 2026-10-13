"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Eye, EyeOff, Loader2, X } from "lucide-react";
import type { Project } from "@/data/projects";

interface FormErrors {
  projectName?: string;
  password?: string;
}

interface AddProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (project: Project) => void | Promise<void>;
  editItem?: Project;
}

export default function AddProjectForm({ isOpen, onClose, onAdd, editItem }: AddProjectFormProps) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Archived">("Active");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && editItem) {
      setProjectName(editItem.name);
      setDescription(editItem.description);
      setStatus(editItem.status);
    }
  }, [isOpen, editItem]);

  if (!isOpen) return null;

  const isEditing = !!editItem;

  function resetForm() {
    setProjectName("");
    setDescription("");
    setStatus("Active");
    setPassword("");
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
    if (!projectName.trim()) newErrors.projectName = "This field is required.";
    if (!isEditing && !password.trim()) newErrors.password = "This field is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onAdd({
        ...(editItem ?? {
          id: Date.now(),
          envVariables: 0,
          licenseKeys: 0,
          adminCredentials: 0,
          teamMembers: 0,
          createdDate: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          createdBy: "Haroon",
        }),
        name: projectName.trim(),
        description: description.trim() || "No description provided.",
        longDescription: description.trim() || "No description provided.",
        status,
        ...(isEditing ? {} : { password: password.trim() }),
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
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 px-4 py-8 sm:max-w-[640px] sm:rounded-2xl sm:px-8 sm:py-10 md:px-10"
        style={{
          background: "#1a1a1a",
          boxShadow: "0px 24px 64px 0px rgba(0,0,0,0.6)",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        {/* Close button */}
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
        <nav className="flex items-center gap-1 mb-4" aria-label="Breadcrumb">
          <span className="text-white/50 text-sm">Projects</span>
          <ChevronRight size={14} className="text-white/40" />
          <span className="text-white text-sm font-medium">{isEditing ? "Edit Project" : "Add Project"}</span>
        </nav>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-1">{isEditing ? "Edit Project" : "Add New Project"}</h2>
        <p className="text-white/50 text-sm mb-8">
          {isEditing ? "Update this project's details." : "Fill in the details below to create a new project."}
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
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Project Name{" "}
                <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                placeholder="e.g. E-Commerce Platform"
                value={projectName}
                disabled={isSubmitting}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (errors.projectName)
                    setErrors((prev) => ({ ...prev, projectName: undefined }));
                }}
              />
              {errors.projectName && (
                <p className="mt-1.5 text-xs text-red-400">{errors.projectName}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Description
              </label>
              <textarea
                rows={4}
                className={inputBase + " resize-none"}
                placeholder="Briefly describe what this project is about..."
                value={description}
                disabled={isSubmitting}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Project Status */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Project Status{" "}
                <span className="text-red-400 font-semibold">*</span>
              </label>
              <div className="flex gap-3">
                {(["Active", "Archived"] as const).map((option) => {
                  const isSelected = status === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setStatus(option)}
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

            {/* Password (add only) */}
            {!isEditing && <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Password{" "}
                <span className="text-red-400 font-semibold">*</span>
              </label>
              <p className="text-xs text-white/40 italic mb-2">
                Set a master password for this project&apos;s credential vault.
              </p>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={inputBase + " pr-12"}
                  placeholder="Enter a strong password"
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: undefined }));
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
            </div>}
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
                ? isEditing ? "Updating…" : "Creating…"
                : isEditing ? "Update Project" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
