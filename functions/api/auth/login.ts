import { DBUser, Env, err, json, newSessionToken, sessionExpiry, toPublicUser, verifyPassword } from '../../_lib/auth';

interface LoginBody {
  email: string;
  password: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return err(400, 'Email and password are required.');
  }

  const email = body.email.trim().toLowerCase();
  const user = await env.insultrac
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email)
    .first<DBUser>();

  if (!user) {
    return err(401, 'Invalid email or password.');
  }
  const ok = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!ok) {
    return err(401, 'Invalid email or password.');
  }

  const token = newSessionToken();
  await env.insultrac
    .prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(token, user.id, new Date().toISOString(), sessionExpiry())
    .run();

  return json({ token, user: toPublicUser(user) });
};
