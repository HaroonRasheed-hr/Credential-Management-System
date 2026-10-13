"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Account,
  type Role,
  type SessionUser,
  USERS_KEY,
  SESSION_KEY,
  clearTokens,
  loadAccessToken,
  loadAccounts,
  loadRefreshToken,
  loadSession,
  mapRole,
  normalizeEmail,
  saveAccounts,
  saveSession,
  saveTokens,
} from "@/lib/auth";
import { apiLogin, apiLogout, apiMe } from "@/lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthResult {
  ok: boolean;
  error?: "user_not_found" | "invalid_password" | "account_locked" | "email_exists" | "network_error";
  message?: string;
  retryAfter?: number;
  userId?: number;
}

interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

interface AuthContextValue {
  user: SessionUser | null;
  accounts: Account[];
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  createUser: (input: NewUserInput) => AuthResult;
  removeUser: (id: number) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from cached tokens → /me
  useEffect(() => {
    async function restore() {
      // Try session cache first (fastest path — no network)
      const cached = loadSession();
      const access = loadAccessToken();

      if (cached && access) {
        setUser(cached);
        setLoading(false);
        return;
      }

      // No cached session — validate stored access token against /me
      if (access) {
        try {
          const res = await apiMe(access);
          if (res.success && res.data) {
            const sessionUser: SessionUser = {
              id: res.data.id,
              name: res.data.username,
              email: res.data.email,
              role: mapRole(res.data.role),
            };
            setUser(sessionUser);
            saveSession(sessionUser);
          } else {
            clearTokens();
          }
        } catch {
          clearTokens();
        }
      }

      setAccounts(loadAccounts());
      setLoading(false);
    }

    restore();
  }, []);

  // Cross-tab sync for the legacy localStorage accounts list
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USERS_KEY) setAccounts(loadAccounts());
      if (e.key === SESSION_KEY) setUser(loadSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await apiLogin(email, password);

        if (res.success && res.data) {
          const { access, refresh, user: backendUser } = res.data;

          const sessionUser: SessionUser = {
            id: backendUser.id,
            name: backendUser.username,
            email: backendUser.email,
            role: mapRole(backendUser.role),
          };

          saveTokens(access, refresh);
          saveSession(sessionUser);
          setUser(sessionUser);

          return { ok: true };
        }

        // Map backend error codes to frontend error types
        if (res.code === "account_locked") {
          return {
            ok: false,
            error: "account_locked",
            message: res.message,
            retryAfter: (res as { retry_after?: number }).retry_after,
          };
        }

        if (res.code === "invalid_credentials") {
          // Distinguish "email not found" vs "wrong password" from message text
          return { ok: false, error: "invalid_password", message: res.message };
        }

        return { ok: false, error: "invalid_password", message: res.message };
      } catch {
        return { ok: false, error: "network_error", message: "Cannot reach the server. Is the backend running?" };
      }
    },
    []
  );

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    const access = loadAccessToken();
    const refresh = loadRefreshToken();

    if (access && refresh) {
      try {
        await apiLogout(refresh, access);
      } catch {
        // Network failure — still clear local state
      }
    }

    clearTokens();
    setUser(null);
  }, []);

  // ── Admin helpers (localStorage-based until user management API is built) ──

  const createUser = useCallback(
    ({ name, email, password, role }: NewUserInput): AuthResult => {
      const exists = accounts.some(
        (a) => normalizeEmail(a.email) === normalizeEmail(email)
      );
      if (exists) return { ok: false, error: "email_exists" };

      const newAccount: Account = {
        id: Date.now(),
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      };
      const next = [...accounts, newAccount];
      setAccounts(next);
      saveAccounts(next);
      return { ok: true, userId: newAccount.id };
    },
    [accounts]
  );

  const removeUser = useCallback(
    (id: number) => {
      const next = accounts.filter((a) => a.id !== id);
      setAccounts(next);
      saveAccounts(next);
    },
    [accounts]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, accounts, loading, login, logout, createUser, removeUser }),
    [user, accounts, loading, login, logout, createUser, removeUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
