"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/auth";

// ── Role badge styling ──────────────────────────────────────────────────────────

const ROLE_BADGE: Record<Role, string> = {
  Admin: "bg-purple-500/20 text-purple-300",
  Developer: "bg-blue-500/20 text-[#03A1FE]",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
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

  const handleAction = (href?: string) => {
    setIsOpen(false);
    if (href) router.push(href);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await logout();
    router.replace("/login");
  };

  if (!user) return null;

  // Developers don't have access to the Settings area.
  const menuItems = [
    ...(user.role === "Developer"
      ? []
      : [{ label: "Settings", icon: Settings, href: "/dashboard/settings" }]),
    { label: "Help & Support", icon: HelpCircle, href: undefined },
  ];

  return (
    <div
      className="relative"
      ref={wrapperRef}
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      {/* ── Avatar button ────────────────────────────────────────────────── */}
      <button
        type="button"
        aria-label="User menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-2 rounded-full p-1 transition-all duration-200 hover:bg-white/10"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
          }}
        >
          {getInitials(user.name)}
        </div>
        <ChevronDown
          size={16}
          className="text-gray-400 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────────── */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="fixed left-0 right-0 top-[100px] z-50 overflow-hidden border-b border-white/10 backdrop-blur-md sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[280px] sm:rounded-2xl sm:border"
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

          {/* Header — user info */}
          <div className="flex flex-col items-center gap-2 border-b border-white/10 p-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{
                background: "linear-gradient(180deg, #03A1FE 0%, #006AB3 100%)",
              }}
            >
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-white">{user.name}</p>
              <p className="truncate text-xs text-gray-400">{user.email}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_BADGE[user.role]}`}
            >
              {user.role}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-2">
            {menuItems.map(({ label, icon: Icon, href }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => handleAction(href)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-white/5"
              >
                <Icon size={18} className="flex-shrink-0 text-gray-400" />
                <span className="text-sm text-white/90">{label}</span>
              </button>
            ))}

            {/* Divider */}
            <div className="my-1 border-t border-white/10" />

            {/* Sign Out */}
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-red-400 transition-all duration-200 hover:bg-red-500/10"
            >
              <LogOut size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
