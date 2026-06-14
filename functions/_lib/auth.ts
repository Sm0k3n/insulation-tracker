// Shared auth utilities for Pages Functions.
// PBKDF2-SHA256, 100000 iterations, 16-byte salt (industry baseline for Workers).

const ITERATIONS = 100_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;

export type Role = 'Admin' | 'Foreman' | 'Delivery Driver' | 'Employee';

export interface DBUser {
  id: string;
  name: string;
  username: string | null;
  email: string;
  password_hash: string;
  password_salt: string;
  role: Role;
  assigned_po: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PublicUser {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: Role;
  assignedPO: string | null;
  phone: string | null;
}

export function toPublicUser(u: DBUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    assignedPO: u.assigned_po,
    phone: u.phone,
  };
}

// Each email may be used at most 4 times (one per role, for testing).
export const EMAIL_REUSE_LIMIT = 4;

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i;
export function normalizeUsername(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return USERNAME_RE.test(v) ? v : null;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr.buffer;
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt);
  return { hash: bufToHex(hash), salt: bufToHex(salt.buffer) };
}

export async function verifyPassword(password: string, hashHex: string, saltHex: string): Promise<boolean> {
  const salt = new Uint8Array(hexToBuf(saltHex));
  const hash = await pbkdf2(password, salt);
  return bufToHex(hash) === hashHex;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    HASH_BYTES * 8,
  );
}

export function newId(prefix = 'u'): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}-${Date.now().toString(36)}-${bufToHex(r.buffer).slice(0, 10)}`;
}

export function newSessionToken(): string {
  const r = crypto.getRandomValues(new Uint8Array(32));
  return bufToHex(r.buffer);
}

const SESSION_TTL_DAYS = 30;

export function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export interface Env {
  insultrac: D1Database;
}

export async function loadCurrentUser(env: Env, token: string | null): Promise<DBUser | null> {
  if (!token) return null;
  const row = await env.insultrac
    .prepare(
      `SELECT u.*, s.expires_at AS _exp FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    )
    .bind(token)
    .first<DBUser & { _exp: string }>();
  if (!row) return null;
  if (new Date(row._exp).getTime() < Date.now()) return null;
  return row;
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export function err(status: number, message: string): Response {
  return json({ error: message }, { status });
}
