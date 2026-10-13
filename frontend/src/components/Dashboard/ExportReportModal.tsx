"use client";

import { useState } from "react";
import { Calendar, Download, FileText, FolderOpen, Loader2, X } from "lucide-react";
import { useExportReport } from "@/hooks/useExportReport";
import { useApiProjects } from "@/hooks/useProjects";

// Sentinel value for the "all projects" option in the project dropdown.
const ALL_PROJECTS = "";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fortyEightHoursAgoISO(): string {
  const d = new Date();
  d.setHours(d.getHours() - 48);
  return d.toISOString().slice(0, 10);
}

export default function ExportReportModal({ isOpen, onClose }: Props) {
  const [fromDate, setFromDate] = useState(fortyEightHoursAgoISO);
  const [toDate, setToDate] = useState(todayISO);
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { exportReport, isExporting, exportError } = useExportReport();
  const { data: projects, loading: projectsLoading } = useApiProjects();

  const selectedProject = projects.find((p) => p.id === projectId);

  if (!isOpen) return null;

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isExporting) onClose();
  }

  async function handleExport() {
    setValidationError(null);

    if (!fromDate || !toDate) {
      setValidationError("Please select both start and end dates.");
      return;
    }

    if (fromDate > toDate) {
      setValidationError("Start date must be on or before the end date.");
      return;
    }

    const days =
      (new Date(toDate).getTime() - new Date(fromDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days > 366) {
      setValidationError("Date range cannot exceed 365 days.");
      return;
    }

    // An empty projectId means "all projects" — send undefined so the hook
    // omits the filter and the backend falls back to its original behaviour.
    await exportReport({
      fromDate,
      toDate,
      projectId: projectId || undefined,
    });
    // On success the file downloads automatically — close the modal
    if (!exportError) onClose();
  }

  const error = validationError ?? exportError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{
          background: "#1a1a1a",
          boxShadow: "0px 24px 64px 0px rgba(0,0,0,0.6)",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        {/* Close */}
        {!isExporting && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-all duration-200 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}

        {/* Header */}
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#03A1FE]/15">
          <FileText size={22} className="text-[#03A1FE]" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-white">Export Activity Report</h2>
        <p className="mt-1 text-sm text-gray-400">
          Download a full PDF report of all admin and developer activity across
          every project for the selected date range.
        </p>

        {/* Project selector */}
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-white/70">
            Project
          </label>
          <div className="relative">
            <FolderOpen
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <select
              value={projectId}
              disabled={isExporting}
              onChange={(e) => {
                setProjectId(e.target.value);
                setValidationError(null);
              }}
              className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-9 pr-9 text-sm text-white outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-2 focus:ring-[#03A1FE]/30 disabled:opacity-50 [color-scheme:dark]"
            >
              <option value={ALL_PROJECTS} style={{ background: "#1a1a1a", color: "#ffffff" }}>
                {projectsLoading ? "Loading projects…" : "All Projects"}
              </option>
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  style={{ background: "#1a1a1a", color: "#ffffff" }}
                >
                  {p.name}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Date inputs */}
        <div className="mt-4 space-y-4">
          {/* From date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              From Date
            </label>
            <div className="relative">
              <Calendar
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="date"
                value={fromDate}
                max={toDate || todayISO()}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-9 text-sm text-white outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-2 focus:ring-[#03A1FE]/30 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* To date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              To Date
            </label>
            <div className="relative">
              <Calendar
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                max={todayISO()}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-9 text-sm text-white outline-none transition-all duration-200 focus:border-[#03A1FE] focus:ring-2 focus:ring-[#03A1FE]/30 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Report preview info */}
        {fromDate && toDate && !validationError && (
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-gray-400">
              The PDF will include{" "}
              <span className="font-semibold text-white">
                all activities (CREATED, ADDED, UPDATED, DELETED, REVEALED)
              </span>{" "}
              by all admins and developers for{" "}
              <span className="font-semibold text-white">
                {selectedProject ? selectedProject.name : "every project"}
              </span>
              , organised by project with full timestamps, user roles, and
              action descriptions.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="w-full rounded-[20px] border border-white/20 bg-transparent px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-white/5 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || !fromDate || !toDate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            style={{
              background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
              boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
            }}
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating PDF…
              </>
            ) : (
              <>
                <Download size={16} />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
