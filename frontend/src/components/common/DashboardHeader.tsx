"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import BrandLogo from "@/components/common/BrandLogo";
import ProfileDropdown from "@/components/common/ProfileDropdown";
import { useSearch } from "@/context/SearchContext";
import { useAuth } from "@/context/AuthContext";

interface NavLink {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
  // Links restricted to non-developer roles (e.g. Admin-only areas).
  adminOnly?: boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    isActive: (p) => p === "/dashboard",
    adminOnly: true,
  },
  {
    label: "Projects",
    href: "/dashboard/projects",
    isActive: (p) => p.startsWith("/dashboard/projects"),
  },
  {
    label: "Teams",
    href: "/dashboard/teams",
    isActive: (p) => p.startsWith("/dashboard/teams"),
  },
  {
    label: "Devices",
    href: "/dashboard/devices",
    isActive: (p) => p.startsWith("/dashboard/devices"),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    isActive: (p) => p.startsWith("/dashboard/settings"),
    adminOnly: true,
  },
];

function searchPlaceholder(pathname: string): string {
  if (pathname.startsWith("/dashboard/teams")) return "Search teams...";
  if (/^\/dashboard\/projects\/[^/]+/.test(pathname))
    return "Search this project...";
  if (pathname.startsWith("/dashboard/notifications"))
    return "Search activity...";
  return "Search projects...";
}

function SearchBar({
  pathname,
  className = "",
}: {
  pathname: string;
  className?: string;
}) {
  const { query, setQuery } = useSearch();

  useEffect(() => {
    setQuery("");
  }, [pathname, setQuery]);

  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 transition-all duration-200 focus-within:bg-white/15 ${className}`}
    >
      <Search size={18} className="shrink-0 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQuery("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={searchPlaceholder(pathname)}
        aria-label="Search"
        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-gray-400 outline-none"
      />
    </div>
  );
}

export default function DashboardHeader() {
  // `trailingSlash: true` (next.config) makes usePathname() return e.g.
  // "/dashboard/". Strip the trailing slash so exact-match checks like
  // `pathname === "/dashboard"` work for the active state and search-hiding.
  const rawPathname = usePathname() ?? "";
  const pathname =
    rawPathname.length > 1 && rawPathname.endsWith("/")
      ? rawPathname.slice(0, -1)
      : rawPathname;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Developers don't have access to the Dashboard or Settings areas.
  const navLinks =
    user?.role === "Developer"
      ? NAV_LINKS.filter((link) => !link.adminOnly)
      : NAV_LINKS;

  // Close drawer whenever the route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Close on outside click (must be outside both header and drawer)
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        headerRef.current &&
        !headerRef.current.contains(target) &&
        drawerRef.current &&
        !drawerRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMenuOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isMenuOpen]);

  return (
    <>
      {/* ── Main header bar ──────────────────────────────────────────────── */}
      <header
        ref={headerRef}
        className="sticky top-0 z-50 w-full bg-[#071421]"
        style={{ boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)" }}
      >
        <div className="flex h-[100px] items-center justify-between gap-4 px-4 sm:px-8 md:px-12 lg:px-16">
          {/* Left: Logo + desktop nav links */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href={user?.role === "Developer" ? "/dashboard/projects" : "/dashboard"}>
              <BrandLogo />
            </Link>

            {/* Nav links — desktop only (lg+) */}
            <nav className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    link.isActive(pathname)
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                  style={{ textDecoration: "none" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: search (lg+) + bell (sm+) + avatar (sm+) + hamburger (<lg) */}
          <div className="flex items-center gap-3">
            {/* Search bar — desktop only (lg+), hidden on admin dashboard */}
            {pathname !== "/dashboard" && !pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/devices") && (
              <div className="hidden lg:block">
                <SearchBar pathname={pathname} className="w-36 lg:w-52" />
              </div>
            )}

            {/* User avatar — tablet and desktop */}
            <div className="hidden sm:block">
              <ProfileDropdown />
            </div>

            {/* Hamburger / close button — mobile + tablet, hidden on desktop */}
            <button
              type="button"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((p) => !p)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-white/10 hover:text-white active:bg-white/10 lg:hidden"
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hamburger drawer — mobile + tablet ───────────────────────────── */}
      <div
        ref={drawerRef}
        className={`fixed left-0 right-0 top-[100px] z-40 overflow-hidden border-b border-white/10 transition-all duration-300 lg:hidden ${
          isMenuOpen
            ? "max-h-[600px] opacity-100 pointer-events-auto"
            : "max-h-0 opacity-0 pointer-events-none"
        }`}
        style={{
          background: "rgba(0,0,0,1)",
          boxShadow: "0px 4px 25px 0px rgba(0,0,0,0.25)",
        }}
        aria-hidden={!isMenuOpen}
      >
        <div className="px-4 py-5 sm:px-8">
          {/* Search bar — full width inside drawer, hidden on admin dashboard */}
          {pathname !== "/dashboard" && !pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/devices") && (
            <SearchBar pathname={pathname} className="mb-4 w-full" />
          )}

          {/* Nav links */}
          <nav aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex min-h-[56px] w-full items-center border-b border-white/10 text-base font-medium transition-all duration-200 last:border-b-0 ${
                  link.isActive(pathname)
                    ? "text-[#03A1FE]"
                    : "text-gray-400 active:text-white"
                }`}
                style={{ textDecoration: "none" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Avatar — mobile only (sm+ already shows it in the header) */}
          <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-4 sm:hidden">
            <span className="text-sm text-gray-400">Account</span>
            <div className="ml-auto flex items-center gap-3">
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
