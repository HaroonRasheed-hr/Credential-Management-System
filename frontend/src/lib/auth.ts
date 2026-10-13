// Auth utility — token storage + session helpers.
// JWT tokens are stored in localStorage (internal tool; no public users).

export type Role = "Admin" | "Developer";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// ── Legacy keys kept so existing localStorage data isn't orphaned ──────────────
export const SESSION_KEY = "pcmp_session";
export const USERS_KEY = "pcmp_users";

// ── JWT token keys ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY = "pcmp_access";
const REFRESH_TOKEN_KEY = "pcmp_refresh";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ── Token storage ──────────────────────────────────────────────────────────────

export function saveTokens(access: string, refresh: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function loadAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function loadRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Session cache (in-memory representation of the logged-in user) ─────────────

export function saveSession(user: SessionUser | null): void {
  if (!isBrowser()) return;
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_KEY);
}

export function loadSession(): SessionUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function mapRole(backendRole: string): Role {
  return backendRole === "ADMIN" ? "Admin" : "Developer";
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === "Admin";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Legacy account type (kept for admin team-management localStorage features) ─
export interface Account {
  id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export function loadAccounts(): Account[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: Account[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
  } catch {
    // storage unavailable
  }
}
