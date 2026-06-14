import { Env, err, hashPassword, json, newId, newSessionToken, normalizeUsername, sessionExpiry, toPublicUser, Role } from '../../_lib/auth';

interface SetupBody {
  name: string;
  email: string;
  username?: string | null;
  password: string;
}

// One-shot bootstrap: create the first Admin user.
// Returns 410 Gone once any users exist.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const count = await env.insultrac.prepare(`SELECT COUNT(*) AS c FROM users`).first<{ c: number }>();
  if ((count?.c ?? 0) > 0) {
    return err(410, 'Setup already complete. Use /api/auth/login.');
  }

  const body = (await request.json().catch(() => null)) as SetupBody | null;
  if (!body?.name || !body.email || !body.password) {
    return err(400, 'Name, email, and password are required.');
  }
  if (body.password.length < 8) {
    return err(400, 'Password must be at least 8 characters.');
  }

  const email = body.email.trim().toLowerCase();

  let username: string | null = null;
  if (body.username) {
    username = normalizeUsername(body.username);
    if (!username) {
      return err(400, 'Username must be 3–32 chars: letters, numbers, dot, underscore, hyphen.');
    }
  }

  const id = newId('u');
  const now = new Date().toISOString();
  const { hash, salt } = await hashPassword(body.password);

  await env.insultrac
    .prepare(
      `INSERT INTO users (id, name, username, email, password_hash, password_salt, role, assigned_po, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Admin', NULL, NULL, ?)`,
    )
    .bind(id, body.name.trim(), username, email, hash, salt, now)
    .run();

  const token = newSessionToken();
  await env.insultrac
    .prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(token, id, now, sessionExpiry())
    .run();

  return json({
    token,
    user: toPublicUser({
      id,
      name: body.name.trim(),
      username,
      email,
      password_hash: hash,
      password_salt: salt,
      role: 'Admin' as Role,
      assigned_po: null,
      phone: null,
      created_at: now,
      updated_at: null,
    }),
  });
};

// Check if setup is needed (returns { needed: boolean }).
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const count = await env.insultrac.prepare(`SELECT COUNT(*) AS c FROM users`).first<{ c: number }>();
  return json({ needed: (count?.c ?? 0) === 0 });
};
