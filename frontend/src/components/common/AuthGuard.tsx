"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Client-side route guard. Redirects to /login when there is no active
 * session. While auth state is hydrating from sessionStorage it renders a
 * lightweight placeholder to avoid a flash of protected content.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center text-white"
        style={{
          background: "linear-gradient(180deg, #0D2238 0%, #06111F 100%)",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px" }}>
          Loading…
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
