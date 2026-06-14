import {
  bearer,
  DBUser,
  EMAIL_REUSE_LIMIT,
  Env,
  err,
  hashPassword,
  json,
  loadCurrentUser,
  newId,
  normalizeUsername,
  Role,
  toPublicUser,
} from '../../_lib/auth';

interface CreateUserBody {
  name: string;
  email: string;
  username?: string | null;
  password: string;
  role: Role;
  assignedPO?: string | null;
  phone?: string | null;
}

const ROLES: Role[] = ['Admin', 'Foreman', 'Delivery Driver', 'Employee'];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await loadCurrentUser(env, bearer(request));
  if (!me) return err(401, 'Not signed in.');
  if (me.role !== 'Admin') return err(403, 'Admin only.');

  const result = await env.insultrac.prepare(`SELECT * FROM users ORDER BY created_at ASC`).all<DBUser>();
  return json({ users: (result.results || []).map(toPublicUser) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await loadCurrentUser(env, bearer(request));
  if (!me) return err(401, 'Not signed in.');
  if (me.role !== 'Admin') return err(403, 'Admin only.');

  const body = (await request.json().catch(() => null)) as CreateUserBody | null;
  if (!body?.name || !body.email || !body.password || !body.role) {
    return err(400, 'Name, email, password, and role are required.');
  }
  if (body.password.length < 8) {
    return err(400, 'Password must be at least 8 characters.');
  }
  if (!ROLES.includes(body.role)) {
    return err(400, 'Invalid role.');
  }

  const email = body.email.trim().toLowerCase();

  let username: string | null = null;
  if (body.username) {
    username = normalizeUsername(body.username);
    if (!username) {
      return err(400, 'Username must be 3–32 chars: letters, numbers, dot, underscore, hyphen.');
    }
    const taken = await env.insultrac
      .prepare(`SELECT id FROM users WHERE username = ?`)
      .bind(username)
      .first();
    if (taken) return err(409, 'That username is already taken.');
  }

  const reuse = await env.insultrac
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE email = ?`)
    .bind(email)
    .first<{ c: number }>();
  if ((reuse?.c ?? 0) >= EMAIL_REUSE_LIMIT) {
    return err(409, `That email has already been used ${EMAIL_REUSE_LIMIT} times.`);
  }

  const id = newId('u');
  const now = new Date().toISOString();
  const { hash, salt } = await hashPassword(body.password);

  await env.insultrac
    .prepare(
      `INSERT INTO users (id, name, username, email, password_hash, password_salt, role, assigned_po, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      body.name.trim(),
      username,
      email,
      hash,
      salt,
      body.role,
      body.assignedPO?.trim() || null,
      body.phone?.trim() || null,
      now,
    )
    .run();

  return json({
    user: toPublicUser({
      id,
      name: body.name.trim(),
      username,
      email,
      password_hash: hash,
      password_salt: salt,
      role: body.role,
      assigned_po: body.assignedPO?.trim() || null,
      phone: body.phone?.trim() || null,
      created_at: now,
      updated_at: null,
    }),
  });
};
