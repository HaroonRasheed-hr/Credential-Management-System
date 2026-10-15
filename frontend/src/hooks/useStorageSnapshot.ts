"use client";

import { useCallback, useSyncExternalStore } from "react";

type StorageType = "local" | "session";

function getStorage(type: StorageType): Storage {
  return type === "local" ? window.localStorage : window.sessionStorage;
}

export function useStorageSnapshot(
  key: string,
  type: StorageType
): string | null | undefined {
  const subscribe = useCallback(
    (callback: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key && event.storageArea === getStorage(type)) {
          callback();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    [key, type]
  );
  const getSnapshot = useCallback(() => {
    try {
      return getStorage(type).getItem(key);
    } catch {
      return null;
    }
  }, [key, type]);
  const getServerSnapshot = useCallback(() => undefined, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
