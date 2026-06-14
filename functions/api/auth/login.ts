import { DBUser, Env, err, json, newSessionToken, sessionExpiry, toPublicUser, verifyPassword } from '../../_lib/auth';

interface LoginBody {
  identifier?: string;
  email?: string;
  username?: string;
  password: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const raw = (body?.identifier ?? body?.email ?? body?.username ?? '').trim();
  if (!raw || !body?.password) {
    return err(400, 'Email/username and password are required.');
  }

  const ident = raw.toLowerCase();
  // Match by either username OR email. If multiple accounts share the email,
  // the password lookup below identifies the right one.
  const result = await env.insultrac
    .prepare(`SELECT * FROM users WHERE username = ? OR email = ?`)
    .bind(ident, ident)
    .all<DBUser>();

  const candidates = result.results || [];
  if (candidates.length === 0) {
    return err(401, 'Invalid login.');
  }

  let user: DBUser | null = null;
  for (const c of candidates) {
    if (await verifyPassword(body.password, c.password_hash, c.password_salt)) {
      user = c;
      break;
    }
  }
  if (!user) {
    return err(401, 'Invalid login.');
  }

  const token = newSessionToken();
  await env.insultrac
    .prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(token, user.id, new Date().toISOString(), sessionExpiry())
    .run();

  return json({ token, user: toPublicUser(user) });
};
