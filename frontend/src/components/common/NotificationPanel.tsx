"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { MODULE_CONFIG } from "@/data/notifications";
import { useActivity, timeAgo } from "@/context/ActivityContext";

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationPanel() {
  const router = useRouter();
  const { activities, unreadCount, markAllRead, markRead } = useActivity();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  return (
    <div className="relative" ref={wrapperRef} style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* ── Bell button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((p) => !p)}
        className="relative flex items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-white/10 hover:text-white"
        style={{ width: "42px", height: "42px" }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{
              background: "#ef4444",
              boxShadow: "0 0 0 2px #000",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────────── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          className="fixed left-0 right-0 top-[100px] z-50 overflow-hidden border-b border-white/10 backdrop-blur-md sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[340px] sm:rounded-2xl sm:border md:w-[380px]"
          style={{
            background: "#1a1a1a",
            boxShadow: "0px 12px 40px 0px rgba(0,0,0,0.55)",
          }}
        >
          {/* Triangular pointer — desktop/tablet only */}
          <div
            className="absolute right-4 -top-1.5 hidden h-3 w-3 rotate-45 border-l border-t border-white/10 sm:block"
            style={{ background: "#1a1a1a" }}
            aria-hidden="true"
          />

          {/* Scroll region */}
          <div className="relative max-h-[70vh] overflow-y-auto sm:max-h-[480px]">
            {/* Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 p-4"
              style={{ background: "#1a1a1a" }}
            >
              <h3 className="text-base font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-[#03A9F4] transition-all duration-200 hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List or empty state */}
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <BellOff size={32} className="mb-3 text-gray-500" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {activities.map((n, index) => {
                  const { icon: Icon, bg } = MODULE_CONFIG[n.module];
                  const isLast = index === activities.length - 1;
                  return (
                    <li
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`relative flex cursor-pointer gap-3 p-4 transition-all duration-200 hover:bg-white/5 ${
                        isLast ? "" : "border-b border-white/5"
                      }`}
                      style={{
                        background: n.read ? "transparent" : "rgba(3,169,244,0.05)",
                      }}
                    >
                      {/* Unread dot on left edge */}
                      {!n.read && (
                        <span
                          className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#03A9F4]"
                          aria-hidden="true"
                        />
                      )}

                      {/* Module icon badge */}
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: bg }}
                      >
                        <Icon size={16} className="text-white" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm leading-snug ${
                            n.read ? "text-gray-400" : "text-white"
                          }`}
                        >
                          <span className="font-semibold">{n.userName}</span>{" "}
                          {n.message}
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

          {/* Footer */}
          {activities.length > 0 && (
            <div
              className="sticky bottom-0 border-t border-white/10 p-3 text-center"
              style={{ background: "#1a1a1a" }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard/notifications");
                }}
                className="text-xs font-bold text-[#03A9F4] transition-all duration-200 hover:underline"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
