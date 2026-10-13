"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, ChevronRight, Loader2, X } from "lucide-react";
import type { Project } from "@/data/projects";

interface FormErrors {
  projectName?: string;
}

interface EditProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Project) => void | Promise<void>;
  project: Project;
}

export default function EditProjectForm({
  isOpen,
  onClose,
  onSave,
  project,
}: EditProjectFormProps) {
  const [projectName, setProjectName] = useState(project.name);
  const [description, setDescription] = useState(project.longDescription);
  const [status, setStatus] = useState<"Active" | "Archived">(project.status);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [description, isOpen]);

  // Re-sync fields whenever a different project is passed in
  useEffect(() => {
    setProjectName(project.name);
    setDescription(project.longDescription);
    setStatus(project.status);
    setErrors({});
    setSubmitError(null);
  }, [project]);

  if (!isOpen) return null;

  function handleClose() {
    if (isSubmitting) return;
    setProjectName(project.name);
    setDescription(project.longDescription);
    setStatus(project.status);
    setErrors({});
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: FormErrors = {};
    if (!projectName.trim()) newErrors.projectName = "This field is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onSave({
        ...project,
        name: projectName.trim(),
        description: description.trim()
          ? description.trim().slice(0, 120)
          : project.description,
        longDescription: description.trim() || project.longDescription,
        status,
      });
      onClose();
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
        className="relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 px-8 py-10 md:px-10"
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
        <nav className="flex items-center gap-1 mb-4">
          <span className="text-white/40 text-sm">Projects</span>
          <ChevronRight size={14} className="text-white/30 flex-shrink-0" />
          <span className="text-white text-sm font-medium">Edit Project</span>
        </nav>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-1">Edit Project</h2>
        <p className="text-white/50 text-sm mb-8">
          Update the details below and save your changes.
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
                Project Name <span className="text-red-400 font-semibold">*</span>
              </label>
              <input
                type="text"
                className={inputBase}
                value={projectName}
                disabled={isSubmitting}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (errors.projectName)
                    setErrors((p) => ({ ...p, projectName: undefined }));
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
                ref={textareaRef}
                rows={1}
                className={inputBase + " resize-none overflow-hidden"}
                value={description}
                disabled={isSubmitting}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Project Status */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Project Status <span className="text-red-400 font-semibold">*</span>
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
                          : "bg-white/5 border-white/10 text-white/50 hover:border-[#57C8E7]/60 hover:text-white/80"
                      }`}
                      style={
                        isSelected
                          ? {
                              background:
                                "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)",
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
          <div className="flex items-center justify-end gap-4 mt-10">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-8 py-3 rounded-[20px] border border-white/20 bg-transparent text-white text-sm font-medium hover:bg-white/5 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 rounded-[20px] text-white font-bold text-sm transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: "linear-gradient(180deg, #57C8E7 0%, #3E5FAA 100%)",
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
