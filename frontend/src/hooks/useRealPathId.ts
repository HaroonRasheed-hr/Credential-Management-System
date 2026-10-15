"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const subscribeToPathname = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};

const getPathIdSnapshot = () => {
  const parts = window.location.pathname.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] ?? "";
};

const getServerPathIdSnapshot = () => "";

export function useRealPathId(): string {
  // Also re-read the external snapshot when Next performs a client-side route change.
  usePathname();
  return useSyncExternalStore(
    subscribeToPathname,
    getPathIdSnapshot,
    getServerPathIdSnapshot
  );
}
