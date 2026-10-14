import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LicenseKey {
  id: string;
  license_name: string;
  license_key: string;
  vendor: string;
  expiry_date: string | null;
  updated_by: { id: string; username: string } | null;
  created_at: string;
  updated_at: string;
}

interface UseLicenseKeysReturn {
  data: LicenseKey[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createLicenseKey: (payload: {
    license_name: string;
    license_key: string;
    vendor: string;
    expiry_date: string | null;
  }) => Promise<LicenseKey>;
  updateLicenseKey: (
    id: string,
    payload: Partial<Pick<LicenseKey, "license_name" | "license_key" | "vendor" | "expiry_date">>
  ) => Promise<LicenseKey>;
  deleteLicenseKey: (id: string) => Promise<void>;
  revealLicenseKey: (id: string) => Promise<string>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLicenseKeys(projectId: string): UseLicenseKeysReturn {
  const [data, setData] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId;

  const fetchKeys = useCallback(async () => {
    if (!pid) return null;
    const res = await api.get(`/api/v1/projects/${pid}/license-keys/`);
    const body = res.data;
    const results = body.data?.results ?? body.data ?? [];
    return Array.isArray(results) ? results : [];
  }, [pid]);

  useEffect(() => {
    let active = true;
    fetchKeys()
      .then((result) => {
        if (!active || !result) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load license keys");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchKeys]);

  const refetch = useCallback(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    return fetchKeys()
      .then((result) => {
        if (result) setData(result);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load license keys");
      })
      .finally(() => setLoading(false));
  }, [fetchKeys, pid]);

  const createLicenseKey = async (payload: {
    license_name: string;
    license_key: string;
    vendor: string;
    expiry_date: string | null;
  }): Promise<LicenseKey> => {
    const res = await api.post(`/api/v1/projects/${pid}/license-keys/`, payload);
    const item = res.data.data;
    setData((prev) => [item, ...prev]);
    return item;
  };

  const updateLicenseKey = async (
    id: string,
    payload: Partial<Pick<LicenseKey, "license_name" | "license_key" | "vendor" | "expiry_date">>
  ): Promise<LicenseKey> => {
    const res = await api.patch(`/api/v1/projects/${pid}/license-keys/${id}/`, payload);
    const item = res.data.data;
    setData((prev) => prev.map((k) => (k.id === id ? item : k)));
    return item;
  };

  const deleteLicenseKey = async (id: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${pid}/license-keys/${id}/`);
    setData((prev) => prev.filter((k) => k.id !== id));
  };

  const revealLicenseKey = async (id: string): Promise<string> => {
    const res = await api.get(`/api/v1/projects/${pid}/license-keys/${id}/reveal/`);
    const data = res.data.data ?? res.data;
    const plaintext: string = data?.license_key ?? data?.value ?? "";
    setData((prev) =>
      prev.map((k) => (k.id === id ? { ...k, license_key: plaintext } : k))
    );
    return plaintext;
  };

  return {
    data,
    loading,
    error,
    refetch,
    createLicenseKey,
    updateLicenseKey,
    deleteLicenseKey,
    revealLicenseKey,
  };
}
