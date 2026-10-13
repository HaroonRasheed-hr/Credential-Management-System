const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, unknown>;
  retry_after?: number;
}

interface LoginResponseData {
  access: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: 'ADMIN' | 'DEVELOPER';
  };
}

interface MeResponseData {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'DEVELOPER';
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
}

async function post<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  return json as ApiResponse<T>;
}

async function get<T>(path: string, token: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  return json as ApiResponse<T>;
}

export async function apiLogin(email: string, password: string) {
  return post<LoginResponseData>('/api/v1/auth/login/', { email, password });
}

export async function apiLogout(refresh: string, access: string) {
  return post('/api/v1/auth/logout/', { refresh }, access);
}

export async function apiMe(access: string) {
  return get<MeResponseData>('/api/v1/auth/me/', access);
}

export async function apiRefresh(refresh: string) {
  return post<{ access: string; refresh: string }>('/api/v1/auth/refresh/', { refresh });
}
