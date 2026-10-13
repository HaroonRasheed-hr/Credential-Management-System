"use client";

import { useState } from "react";
import { loadAccessToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface ExportOptions {
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  projectId?: string; // optional — scope report to a single project; omit for all
}

interface UseExportReportReturn {
  exportReport: (opts: ExportOptions) => Promise<void>;
  isExporting: boolean;
  exportError: string | null;
}

export function useExportReport(): UseExportReportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportReport({ fromDate, toDate, projectId }: ExportOptions): Promise<void> {
    setIsExporting(true);
    setExportError(null);

    try {
      const token = loadAccessToken();
      let url = `${API_BASE}/api/v1/reports/activity/?from_date=${fromDate}&to_date=${toDate}`;
      if (projectId) {
        url += `&project_id=${encodeURIComponent(projectId)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
        },
      });

      if (!response.ok) {
        let message = "Failed to generate report.";
        try {
          const json = await response.json();
          message = json?.message ?? message;
        } catch {
          // ignore parse errors
        }
        setExportError(message);
        return;
      }

      const blob = await response.blob();
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^"]+)"?/)?.[1] ??
        `credential_management_activity_report_${fromDate}_to_${toDate}.pdf`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setExportError("Network error. Please check your connection and try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return { exportReport, isExporting, exportError };
}
