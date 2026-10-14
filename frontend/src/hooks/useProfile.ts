import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface ProfileStats {
  total_projects: number;
  team_members: number;
  teams_managed: number;
}

export interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'DEVELOPER';
  role_display: string;
  full_name: string;
  joined: string;
  stats: ProfileStats;
  created_at: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface UseProfileReturn {
  profile: ProfileData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateProfile: (payload: UpdateProfilePayload) => Promise<ProfileData>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const res = await api.get('/api/v1/settings/profile/');
    return res.data.data ?? res.data;
  }, []);

  useEffect(() => {
    let active = true;
    fetchProfile()
      .then(setProfile)
      .then(() => {
        if (active) {
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to load profile.';
        setError(msg);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchProfile]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchProfile()
      .then(setProfile)
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to load profile.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [fetchProfile]);

  const updateProfile = async (payload: UpdateProfilePayload): Promise<ProfileData> => {
    const res = await api.patch('/api/v1/settings/profile/', payload);
    const updated: ProfileData = res.data.data ?? res.data;
    setProfile(updated);
    return updated;
  };

  const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
    await api.post('/api/v1/settings/change-password/', payload);
  };

  return { profile, loading, error, refetch, updateProfile, changePassword };
}
