// Frontend API client for the Pages Functions backend.

import type { Role, User } from './types';

const TOKEN_KEY = 'insultrac-session-token';

export function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function normalizeUser(u: any): User {
  return {
    ...u,
    assignedPO: u.assignedPO ?? undefined,
    username: u.username ?? undefined,
    phone: u.phone ?? '',
  } as User;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }
  const data = (await res.json()) as any;
  // Normalize user shapes from backend (null → undefined / '')
  if (data && typeof data === 'object') {
    if (data.user) data.user = normalizeUser(data.user);
    if (Array.isArray(data.users)) data.users = data.users.map(normalizeUser);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

export const api = {
  setupNeeded: () => request<{ needed: boolean }>('GET', '/api/auth/setup'),
  setup: (body: { name: string; email: string; username?: string | null; password: string }) =>
    request<{ token: string; user: User }>('POST', '/api/auth/setup', body),
  login: (body: { identifier: string; password: string }) =>
    request<{ token: string; user: User }>('POST', '/api/auth/login', body),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout'),
  me: () => request<{ user: User }>('GET', '/api/auth/me'),

  listUsers: () => request<{ users: User[] }>('GET', '/api/users'),
  createUser: (body: { name: string; email: string; username?: string | null; password: string; role: Role; assignedPO?: string | null; phone?: string | null }) =>
    request<{ user: User }>('POST', '/api/users', body),
  updateUser: (id: string, body: Partial<{ name: string; email: string; username: string | null; password: string; role: Role; assignedPO: string | null; phone: string | null }>) =>
    request<{ user: User }>('PATCH', `/api/users/${id}`, body),
  deleteUser: (id: string) => request<{ ok: true }>('DELETE', `/api/users/${id}`),
};
