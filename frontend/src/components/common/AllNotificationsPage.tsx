"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, BellOff, ArrowLeft, Loader2 } from "lucide-react";
import { MODULE_CONFIG } from "@/data/notifications";
import { timeAgo } from "@/context/ActivityContext";
import { useRecentActivities } from "@/hooks/useRecentActivities";

const PAGE_SIZE = 10;
// Poll interval so the feed updates live without a manual refresh.
const REFRESH_MS = 15000;

export default function AllNotificationsPage() {
  // Same data source as the dashboard's Recent Activity feed (backend), so the
  // entries shown here match the dashboard. We pull a generous limit and
  // paginate client-side at PAGE_SIZE per page.
  const { data: activities, loading, refetch } = useRecentActivities(200);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));

  // Live updates: poll periodically and refetch when the tab regains focus.
  // A single AbortController scoped to this effect cancels any in-flight
  // poll/focus request on unmount so it can't resolve into a gone component.
  useEffect(() => {
    const controller = new AbortController();
    const id = window.setInterval(() => refetch(controller.signal), REFRESH_MS);
    const onFocus = () => refetch(controller.signal);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      controller.abort();
    };
  }, [refetch]);

  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () =>
      activities.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [activities, currentPage]
  );

  return (
    <>
      {/* ── Page Body ──────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[860px] px-8 md:px-16">
        {/* Back to dashboard */}
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors duration-200 hover:text-white"
          style={{ textDecoration: "none" }}
        >
          <ArrowLeft size={16} className="flex-shrink-0" />
          Back to Dashboard
        </Link>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 pt-4 pb-4" aria-label="Breadcrumb">
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 transition-colors duration-200 hover:text-white"
            style={{ textDecoration: "none" }}
          >
            Dashboard
          </Link>
          <ChevronRight size={15} className="flex-shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-white">Recent Activity</span>
        </nav>

        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Recent Activity
            </h1>
            {activities.length > 0 && (
              <span
                className="rounded-full px-3 py-1 text-sm font-semibold"
                style={{
                  background: "rgba(3, 161, 254,0.15)",
                  color: "#03A1FE",
                  border: "1px solid rgba(3, 161, 254,0.25)",
                }}
              >
                {activities.length}
              </span>
            )}
          </div>
        </div>

        {/* List card */}
        <div
          className="w-full overflow-hidden rounded-2xl border border-white/10"
          style={{
            background: "rgba(255,255,255,0.04)",
            boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
          }}
        >
          {loading && activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 size={28} className="mb-3 animate-spin text-gray-500" />
              <p className="text-sm text-gray-400">Loading activity…</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellOff size={34} className="mb-3 text-gray-500" />
              <p className="text-sm text-gray-400">No activity</p>
            </div>
          ) : (
            <ul>
              {pageItems.map((n, index) => {
                const cfg = MODULE_CONFIG[n.module] ?? MODULE_CONFIG.Project;
                const { icon: Icon, bg } = cfg;
                const isLast = index === pageItems.length - 1;
                return (
                  <li
                    key={n.id}
                    className={`relative flex gap-4 px-5 py-4 transition-all duration-200 hover:bg-white/5 ${
                      isLast ? "" : "border-b border-white/5"
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: bg }}
                    >
                      <Icon size={18} className="text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-white">
                        <span className="font-semibold">{n.userName}</span>{" "}
                        {n.description}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {n.projectName} · {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {activities.length > PAGE_SIZE && (
          <div className="mb-12 mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, activities.length)} of{" "}
              {activities.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                Previous
              </button>
              <span className="text-sm font-medium text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacer when pagination isn't shown */}
        {activities.length <= PAGE_SIZE && <div className="pb-12" />}
      </div>
    </>
  );
}
